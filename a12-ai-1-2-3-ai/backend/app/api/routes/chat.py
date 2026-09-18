from __future__ import annotations

import json
import time
from collections.abc import Iterator
from dataclasses import dataclass, field
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.db.session import SessionLocal, get_db
from app.models.task import ChatMessage, CourseTask, UploadedFile
from app.schemas.chat import ChatHistoryResponse, ChatReference, ChatRequest, ChatResponse, MessageRead
from app.schemas.task import TaskRead
from app.services.agent_orchestrator import decide_next_step
from app.services.agent_state import AgentDecision, stage_label, action_label
from app.services.agent_session_adapter import build_frontend_agent_session, next_question_from_missing
from app.services.clarify_service import is_delegating
from app.services.dialogue import build_assistant_reply, stream_assistant_reply
from app.services.intent_service import update_task_intent_from_chat

router = APIRouter()


@dataclass
class PreparedTurn:
    task_id: int
    user_message: str
    history: list[dict[str, str]] = field(default_factory=list)
    file_count: int = 0
    file_names: list[str] = field(default_factory=list)
    task_context: dict[str, Any] = field(default_factory=dict)
    decision: AgentDecision | None = None
    references: list[dict[str, Any]] = field(default_factory=list)
    task_payload: dict[str, Any] | None = None
    requirement: dict[str, Any] | None = None
    session: dict[str, Any] | None = None
    completeness: float | None = None
    missing_fields: list[str] = field(default_factory=list)
    stage: str | None = None
    next_question: str | None = None
    transition: dict[str, Any] | None = None

    @property
    def is_clarifying(self) -> bool:
        return bool(self.decision and self.decision.next_action == "ask_clarifying_question" and self.decision.question)


def _load_recent_history(db: Session, task_id: int, limit: int = 8) -> list[dict[str, str]]:
    rows = (
        db.query(ChatMessage)
        .filter(ChatMessage.task_id == task_id)
        .order_by(desc(ChatMessage.created_at), desc(ChatMessage.id))
        .limit(limit)
        .all()
    )
    return [{"role": item.role, "content": item.content} for item in reversed(rows)]


def _previous_assistant_message(history: list[dict[str, str]]) -> str | None:
    for item in reversed(history):
        if item.get("role") == "assistant" and item.get("content", "").strip():
            return item["content"]
    return None


def _known_fields(task: CourseTask) -> dict[str, Any]:
    pairs = {
        "课程主题": task.teaching_topic or task.title,
        "授课对象": task.audience,
        "课时": f"{task.duration_minutes} 分钟" if task.duration_minutes else None,
    }
    return {key: value for key, value in pairs.items() if value}


def _prepare_turn(db: Session, task_id: int, payload: ChatRequest) -> PreparedTurn:
    task = db.get(CourseTask, task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")

    history = _load_recent_history(db, task_id)
    files = (
        db.query(UploadedFile)
        .filter(UploadedFile.task_id == task_id)
        .order_by(desc(UploadedFile.created_at))
        .limit(8)
        .all()
    )

    user_message = ChatMessage(task_id=task_id, role="user", content=payload.message)
    db.add(user_message)
    db.flush()

    update_task_intent_from_chat(task, payload.message, history)
    db.flush()

    known = _known_fields(task)
    decision = decide_next_step(
        task,
        payload.message,
        history=history,
        files=files,
        previous_assistant_message=_previous_assistant_message(history),
        known_fields=known,
    )

    task_context = {
        "title": task.title,
        "subject": task.subject,
        "audience": task.audience,
        "duration_minutes": f"{task.duration_minutes} 分钟" if task.duration_minutes else None,
        "requirement_summary": task.requirement_summary,
        "teaching_topic": task.teaching_topic,
        "knowledge_points": task.knowledge_points,
        "key_difficulties": task.key_difficulties,
        "interaction_design": task.interaction_design,
        "files": "、".join(file.file_name for file in files),
        "agent_stage": decision.stage,
        "agent_next_action": decision.next_action,
        "missing_fields": decision.missing_fields,
        "assumptions": decision.assumptions,
        "teacher_delegated": is_delegating(payload.message),
    }

    session_state, completeness, missing = build_frontend_agent_session(task)
    task_payload = json.loads(TaskRead.model_validate(task).model_dump_json())

    turn = PreparedTurn(
        task_id=task_id,
        user_message=payload.message,
        history=history,
        file_count=len(files),
        file_names=[file.file_name for file in files],
        task_context=task_context,
        decision=decision,
        task_payload=task_payload,
        requirement=session_state["requirement"],
        session=session_state,
        completeness=completeness,
        missing_fields=missing,
        stage=session_state["stage"],
        next_question=next_question_from_missing(missing),
        transition=session_state["control"].get("lastTransition"),
    )
    db.commit()
    return turn


def _finalize(db: Session, turn: PreparedTurn, assistant_text: str) -> ChatResponse:
    assistant_message = ChatMessage(task_id=turn.task_id, role="assistant", content=assistant_text)
    db.add(assistant_message)
    db.commit()
    db.refresh(assistant_message)

    return ChatResponse(
        task_id=turn.task_id,
        message=MessageRead.model_validate(assistant_message),
        references=[ChatReference.model_validate(reference) for reference in turn.references],
        thinking=_build_visible_thinking(turn),
        task=TaskRead.model_validate(turn.task_payload) if turn.task_payload else None,
        requirement=turn.requirement,
        session=turn.session,
        completeness=turn.completeness,
        missing_fields=turn.missing_fields,
        stage=turn.stage,
        next_question=turn.next_question,
        transition=turn.transition,
    )


@router.post("/{task_id}/chat", response_model=ChatResponse)
def send_chat_message(
    task_id: int,
    payload: ChatRequest,
    db: Session = Depends(get_db),
) -> ChatResponse:
    turn = _prepare_turn(db, task_id, payload)

    if turn.is_clarifying:
        assistant_text = turn.decision.question or ""
        turn.references = []
    else:
        assistant_text, references = build_assistant_reply(
            payload.message,
            task_context=turn.task_context,
            history=turn.history,
            context=payload.context,
        )
        turn.references = references

    return _finalize(db, turn, assistant_text)


@router.post("/{task_id}/chat/stream")
def stream_chat_message(task_id: int, payload: ChatRequest, db: Session = Depends(get_db)) -> StreamingResponse:
    turn = _prepare_turn(db, task_id, payload)
    return StreamingResponse(
        _sse_stream(turn, payload, db),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


def _sse(event: str, data: dict[str, Any]) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


def _chunk_text(text: str, size: int = 14) -> Iterator[str]:
    for index in range(0, len(text), size):
        yield text[index : index + size]


def _planning_steps(turn: PreparedTurn) -> list[tuple[str, str]]:
    """把真实的智能体动作整理成可视化思考步骤（step 标识 + 文案）。"""
    decision = turn.decision
    assert decision is not None
    missing = "、".join(decision.missing_fields) if decision.missing_fields else "无"
    steps: list[tuple[str, str]] = [
        ("intent", f"解析教师输入，更新教学意图字段（已上传资料 {turn.file_count} 份）"),
        ("fields", f"核对教学字段完整性：缺失 {missing}"),
        ("decide", f"决策本轮动作：{stage_label(decision.stage)} → {action_label(decision.next_action)}"),
    ]
    if decision.proactive:
        steps.append(("proactive", "教师已授权，切换为主动推进：生成默认假设清单并继续"))
    if turn.file_count:
        steps.append(("files", f"关联 {turn.file_count} 个参考资料：{'、'.join(turn.file_names[:3])}"))
    return steps


def _sse_stream(turn: PreparedTurn, payload: ChatRequest, db: Session) -> Iterator[str]:
    decision = turn.decision
    yield _sse("meta", {"task_id": turn.task_id, "stage": decision.stage if decision else None})

    try:
        for step, text in _planning_steps(turn):
            yield _sse("thinking", {"step": step, "text": text, "status": "done"})
            time.sleep(0.05)

        references: list[dict[str, Any]] = []
        collected: list[str] = []

        if turn.is_clarifying:
            yield _sse("thinking", {"step": "compose", "text": "组织本轮追问：结合已确认字段与上一轮说法，避免重复提问", "status": "done"})
            text = decision.question or ""
            collected.append(text)
            for piece in _chunk_text(text):
                yield _sse("delta", {"text": piece})
                time.sleep(0.012)
            yield _sse("thinking", {"step": "guard", "text": "已校验本轮追问未与上一轮回复重复", "status": "done"})
        else:
            yield _sse("thinking", {"step": "plan", "text": "规划回答结构：判断 → 依据 → 推进动作", "status": "done"})
            for chunk in stream_assistant_reply(
                turn.user_message,
                task_context=turn.task_context,
                history=turn.history,
                context=payload.context,
            ):
                chunk_type = chunk.get("type")
                if chunk_type == "references":
                    references = chunk.get("references") or []
                    if references:
                        yield _sse(
                            "thinking",
                            {
                                "step": "retrieve",
                                "text": f"检索本地知识库：命中 {len(references)} 条可引用片段",
                                "status": "done",
                            },
                        )
                elif chunk_type == "reasoning":
                    yield _sse("reasoning", {"text": chunk.get("text", "")})
                elif chunk_type == "error":
                    yield _sse("thinking", {"step": "llm", "text": f"模型流式异常，切换本地推进模式：{chunk.get('text', '')[:120]}", "status": "failed"})
                elif chunk_type == "delta":
                    text = chunk.get("text", "")
                    if text:
                        collected.append(text)
                        yield _sse("delta", {"text": text})

        turn.references = references
        answer = "".join(collected).strip()
        yield _sse("thinking", {"step": "finalize", "text": "整理最终回复并写入会话记录", "status": "done"})

        # 复用请求作用域的会话：SQLite 下并发连接写会触发 database is locked
        response = _finalize(db, turn, answer)

        yield _sse("done", json.loads(response.model_dump_json()))
    except Exception as exc:  # noqa: BLE001 - 流式过程中任何异常都要让前端可恢复
        db.rollback()
        yield _sse("error", {"detail": str(exc)})


@router.get("/{task_id}/messages", response_model=ChatHistoryResponse)
def list_chat_messages(task_id: int, db: Session = Depends(get_db)) -> ChatHistoryResponse:
    if db.get(CourseTask, task_id) is None:
        raise HTTPException(status_code=404, detail="Task not found")
    messages = (
        db.query(ChatMessage)
        .filter(ChatMessage.task_id == task_id)
        .order_by(ChatMessage.id.asc())
        .all()
    )
    return ChatHistoryResponse(
        task_id=task_id,
        messages=[MessageRead.model_validate(item) for item in messages],
    )


@router.get("/{task_id}/requirements")
def get_requirements(task_id: int, db: Session = Depends(get_db)) -> dict:
    task = db.get(CourseTask, task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    session, completeness, missing = build_frontend_agent_session(task)
    return {
        "task_id": task_id,
        "state": session["requirement"],
        "session": session,
        "stage": session["stage"],
        "next_question": next_question_from_missing(missing),
        "completeness": completeness,
        "missing_fields": missing,
    }


@router.get("/{task_id}/session")
def get_agent_session(task_id: int, db: Session = Depends(get_db)) -> dict:
    return get_requirements(task_id, db)


def _build_visible_thinking(turn: PreparedTurn) -> list[str]:
    """User-facing workflow summary, not raw model reasoning."""
    decision = turn.decision
    assert decision is not None
    steps = decision.visible_steps(reference_count=len(turn.references), file_count=turn.file_count)
    steps.extend(
        [
            "教学意图字段已较完整，可继续生成课件大纲或教案。"
            if not turn.missing_fields
            else "教学意图仍有缺口：智能体会按默认假设推进，同时保留一次低成本确认。",
            "已生成面向教师的最终回复，并保留可见工作流供核对。",
        ]
    )
    return steps
