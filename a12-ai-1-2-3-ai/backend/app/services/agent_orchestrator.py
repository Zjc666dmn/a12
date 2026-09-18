from __future__ import annotations

import json
from typing import Any

from app.models.task import CourseTask, UploadedFile
from app.services.agent_state import AgentDecision, ToolLog, get_missing_fields
from app.services.clarify_service import build_clarifying_question
from app.services.llm_service import LLMServiceError, call_active_chat_model
from app.utils.data import parse_json_object


ORCHESTRATOR_SYSTEM_PROMPT = (
    "你是 TeachNova 的 Agent Orchestrator，负责决定教学智能体下一步动作。"
    "你不能输出原始思考过程，只能输出 JSON。"
    "你的决策必须服务于教师备课闭环：澄清需求、检索资料、生成大纲、生成产物、等待反馈、迭代修改。"
)


def decide_next_step(
    task: CourseTask,
    user_message: str,
    history: list[dict[str, str]] | None = None,
    files: list[UploadedFile] | None = None,
) -> AgentDecision:
    missing_fields = get_missing_fields(task)
    tool_logs = [
        ToolLog("intent_service", "success", "已抽取并沉淀课程主题、授课对象、课时、知识点等字段"),
        ToolLog("rule_field_checker", "success", _format_missing_detail(missing_fields)),
    ]

    if missing_fields:
        decision = _decide_with_rules(user_message, missing_fields)
        decision.tool_logs = tool_logs + [
            ToolLog("llm_orchestrator", "skipped", "关键字段未补齐，先用规则状态机快速追问，减少教师等待"),
            *decision.tool_logs,
        ]
        return decision

    model_decision = _decide_with_model(task, user_message, history or [], files or [], missing_fields)
    fallback = _decide_with_rules(user_message, missing_fields)
    decision = _merge_decision(model_decision, fallback)
    decision.tool_logs = tool_logs + decision.tool_logs
    if decision.next_action == "ask_clarifying_question" and not decision.question:
        decision.question = build_clarifying_question(decision.missing_fields, user_message)
    return decision


def _decide_with_model(
    task: CourseTask,
    user_message: str,
    history: list[dict[str, str]],
    files: list[UploadedFile],
    missing_fields: list[str],
) -> AgentDecision | None:
    prompt = _build_decision_prompt(task, user_message, history, files, missing_fields)
    try:
        content = call_active_chat_model(
            [{"role": "user", "content": prompt}],
            system=ORCHESTRATOR_SYSTEM_PROMPT,
            temperature=0.15,
            max_tokens=700,
            timeout=20,
        )
        data = parse_json_object(content)
    except (LLMServiceError, json.JSONDecodeError):
        return None

    if not data:
        return None

    stage = data.get("stage")
    next_action = data.get("next_action")
    valid_stages = {"clarify", "retrieve", "plan", "generate", "review", "iterate", "done"}
    valid_actions = {
        "ask_clarifying_question",
        "retrieve_knowledge",
        "answer_with_context",
        "generate_lesson_plan",
        "wait_for_feedback",
    }
    if stage not in valid_stages or next_action not in valid_actions:
        return None

    model_missing = data.get("missing_fields")
    normalized_missing = [str(item) for item in model_missing if str(item).strip()] if isinstance(model_missing, list) else missing_fields
    confidence = data.get("confidence")
    return AgentDecision(
        stage=stage,
        next_action=next_action,
        question=str(data.get("question") or "") or None,
        missing_fields=normalized_missing,
        confidence=float(confidence) if isinstance(confidence, int | float) else 0.6,
        reason=str(data.get("reason") or "已由模型决策下一步动作。"),
        tool_logs=[ToolLog("llm_orchestrator", "success", "已根据对话历史与任务状态选择下一步")],
    )


def _decide_with_rules(user_message: str, missing_fields: list[str]) -> AgentDecision:
    lowered = user_message.lower()
    wants_generate = any(keyword in user_message for keyword in ["生成", "课件", "大纲", "教案", "ppt", "PPT", "word", "Word"])
    wants_iterate = any(keyword in user_message for keyword in ["修改", "调整", "优化", "再生成", "换成", "增加", "删除"])

    if missing_fields:
        return AgentDecision(
            stage="clarify",
            next_action="ask_clarifying_question",
            question=build_clarifying_question(missing_fields, user_message),
            missing_fields=missing_fields,
            confidence=0.8,
            reason="核心教学字段尚未完整，先主动追问，避免直接生成偏题内容。",
            tool_logs=[ToolLog("clarify_service", "success", "已生成面向教师的追问问题")],
        )

    if wants_iterate:
        return AgentDecision(
            stage="iterate",
            next_action="wait_for_feedback",
            missing_fields=[],
            confidence=0.72,
            reason="用户表达了修改意图，可进入反馈迭代阶段。",
        )

    if wants_generate or "generate" in lowered:
        return AgentDecision(
            stage="plan",
            next_action="generate_lesson_plan",
            missing_fields=[],
            confidence=0.76,
            reason="教学需求已较完整，可以继续生成结构化课件大纲。",
        )

    return AgentDecision(
        stage="retrieve",
        next_action="answer_with_context",
        missing_fields=[],
        confidence=0.68,
        reason="教学字段已较完整，本轮先结合知识库和任务上下文回复。",
    )


def _merge_decision(model_decision: AgentDecision | None, fallback: AgentDecision) -> AgentDecision:
    if model_decision is None:
        fallback.tool_logs.append(ToolLog("llm_orchestrator", "skipped", "模型决策不可用，已启用规则兜底"))
        return fallback

    if fallback.missing_fields and model_decision.next_action != "ask_clarifying_question":
        fallback.tool_logs.append(ToolLog("llm_orchestrator", "skipped", "模型建议继续推进，但规则兜底要求先补全关键字段"))
        return fallback

    if model_decision.next_action == "ask_clarifying_question" and not model_decision.missing_fields:
        model_decision.missing_fields = fallback.missing_fields
    return model_decision


def _build_decision_prompt(
    task: CourseTask,
    user_message: str,
    history: list[dict[str, str]],
    files: list[UploadedFile],
    missing_fields: list[str],
) -> str:
    task_state = {
        "title": task.title,
        "subject": task.subject,
        "audience": task.audience,
        "duration_minutes": task.duration_minutes,
        "requirement_summary": task.requirement_summary,
        "teaching_topic": task.teaching_topic,
        "knowledge_points": task.knowledge_points,
        "key_difficulties": task.key_difficulties,
        "interaction_design": task.interaction_design,
        "intent_status": task.intent_status,
        "intent_confidence": task.intent_confidence,
        "missing_fields_by_rules": missing_fields,
        "uploaded_files": [file.file_name for file in files],
    }
    history_text = "\n".join(
        f"{item.get('role', '')}: {item.get('content', '')[:500]}"
        for item in history[-8:]
        if item.get("content")
    )
    return (
        "请根据任务状态决定下一步，只返回 JSON，字段如下：\n"
        "stage: clarify|retrieve|plan|generate|review|iterate|done；"
        "next_action: ask_clarifying_question|retrieve_knowledge|answer_with_context|generate_lesson_plan|wait_for_feedback；"
        "missing_fields: string[]；question: string|null；confidence: 0到1；reason: string。\n"
        "如果规则缺失字段不为空，原则上必须先 ask_clarifying_question。\n\n"
        f"任务状态：{json.dumps(task_state, ensure_ascii=False)}\n\n"
        f"最近对话：\n{history_text or '暂无'}\n\n"
        f"教师最新输入：{user_message}\n"
    )


def _format_missing_detail(missing_fields: list[str]) -> str:
    if not missing_fields:
        return "核心教学字段已完整"
    return f"发现缺失字段：{'、'.join(missing_fields)}"
