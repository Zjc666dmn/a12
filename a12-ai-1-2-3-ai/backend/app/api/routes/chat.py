from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.task import ChatMessage, CourseTask, UploadedFile
from app.schemas.chat import ChatHistoryResponse, ChatReference, ChatRequest, ChatResponse, MessageRead
from app.schemas.task import TaskRead
from app.services.agent_orchestrator import decide_next_step
from app.services.agent_state import AgentDecision
from app.services.agent_session_adapter import build_frontend_agent_session, next_question_from_missing
from app.services.dialogue import build_assistant_reply
from app.services.intent_service import update_task_intent_from_chat

router = APIRouter()


@router.post("/{task_id}/chat", response_model=ChatResponse)
def send_chat_message(
    task_id: int,
    payload: ChatRequest,
    db: Session = Depends(get_db),
) -> ChatResponse:
    task = db.get(CourseTask, task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")

    recent_messages = (
        db.query(ChatMessage)
        .filter(ChatMessage.task_id == task_id)
        .order_by(desc(ChatMessage.created_at))
        .limit(8)
        .all()
    )
    history = [
        {"role": item.role, "content": item.content}
        for item in reversed(recent_messages)
    ]
    files = (
        db.query(UploadedFile)
        .filter(UploadedFile.task_id == task_id)
        .order_by(desc(UploadedFile.created_at))
        .limit(8)
        .all()
    )
    task_context = {
        "title": task.title,
        "subject": task.subject,
        "audience": task.audience,
        "duration_minutes": f"{task.duration_minutes} 分钟" if task.duration_minutes else None,
        "requirement_summary": task.requirement_summary,
        "files": "、".join(file.file_name for file in files),
    }

    user_message = ChatMessage(task_id=task_id, role="user", content=payload.message)
    db.add(user_message)
    db.flush()

    update_task_intent_from_chat(task, payload.message, history)
    db.flush()

    task_context.update(
        {
            "title": task.title,
            "audience": task.audience,
            "duration_minutes": f"{task.duration_minutes} 分钟" if task.duration_minutes else None,
            "requirement_summary": task.requirement_summary,
            "teaching_topic": task.teaching_topic,
            "knowledge_points": task.knowledge_points,
            "key_difficulties": task.key_difficulties,
            "interaction_design": task.interaction_design,
        }
    )

    decision = decide_next_step(task, payload.message, history=history, files=files)
    if decision.next_action == "ask_clarifying_question" and decision.question:
        assistant_text = decision.question
        references = []
    else:
        assistant_text, references = build_assistant_reply(
            payload.message,
            task_context={**task_context, "agent_stage": decision.stage, "agent_next_action": decision.next_action},
            history=history,
            context=payload.context,
        )
    assistant_message = ChatMessage(
        task_id=task_id,
        role="assistant",
        content=assistant_text,
    )
    db.add(assistant_message)
    db.commit()
    db.refresh(assistant_message)
    db.refresh(task)

    session, completeness, missing = build_frontend_agent_session(task)
    return ChatResponse(
        task_id=task_id,
        message=MessageRead.model_validate(assistant_message),
        references=[ChatReference.model_validate(reference) for reference in references],
        thinking=_build_visible_thinking(task, references, files, decision),
        task=TaskRead.model_validate(task),
        requirement=session["requirement"],
        session=session,
        completeness=completeness,
        missing_fields=missing,
        stage=session["stage"],
        next_question=next_question_from_missing(missing),
        transition=session["control"].get("lastTransition"),
    )


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


def _build_visible_thinking(
    task: CourseTask,
    references: list[dict],
    files: list[UploadedFile],
    decision: AgentDecision,
) -> list[str]:
    """User-facing workflow summary, not raw model reasoning."""
    steps = decision.visible_steps(reference_count=len(references), file_count=len(files))
    if task.intent_status == "confirmed":
        steps.append("教学意图字段已较完整，可继续生成课件大纲或教案。")
    else:
        steps.append("教学意图仍有缺口，回答中会优先追问关键缺失信息。")
    steps.append("已生成面向教师的最终回复，并保留可见工作流供核对。")
    return steps
