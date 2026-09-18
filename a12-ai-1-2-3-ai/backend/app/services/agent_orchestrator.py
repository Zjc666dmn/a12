from __future__ import annotations

import json
from typing import Any

from app.models.task import CourseTask, UploadedFile
from app.services.agent_state import AgentDecision, ToolLog, get_missing_fields
from app.services.clarify_service import (
    assumption_lines,
    build_clarifying_question,
    build_proactive_reply,
    is_delegating,
    is_repeat,
)
from app.services.llm_service import LLMServiceError, call_active_chat_model
from app.utils.data import parse_json_object


ORCHESTRATOR_SYSTEM_PROMPT = (
    "你是 TeachNova 的 Agent Orchestrator，负责决定教学智能体下一步动作。"
    "你不能输出原始思考过程，只能输出 JSON。"
    "你的决策必须服务于教师备课闭环：澄清需求、检索资料、生成大纲、生成产物、等待反馈、迭代修改。"
    "教师表达「你帮我做」「直接生成」这类授权时，要倾向于主动推进并声明采用的合理默认值，"
    "而不是继续重复同一批确认问题。"
)


def decide_next_step(
    task: CourseTask,
    user_message: str,
    history: list[dict[str, str]] | None = None,
    files: list[UploadedFile] | None = None,
    previous_assistant_message: str | None = None,
    known_fields: dict[str, Any] | None = None,
) -> AgentDecision:
    missing_fields = get_missing_fields(task)
    delegation = is_delegating(user_message)
    tool_logs = [
        ToolLog("intent_service", "success", "已抽取并沉淀课程主题、授课对象、课时、知识点等字段"),
        ToolLog("rule_field_checker", "success", _format_missing_detail(missing_fields)),
        ToolLog(
            "delegation_detector",
            "success" if delegation else "skipped",
            "识别到教师把决策权交给智能体，转为主动推进" if delegation else "教师本轮仍在提供信息",
        ),
    ]

    fallback = _decide_with_rules(
        user_message,
        missing_fields,
        delegation=delegation,
        known_fields=known_fields,
    )
    model_decision = _decide_with_model(
        task, user_message, history or [], files or [], missing_fields, previous_assistant_message, delegation
    )
    decision = _merge_decision(model_decision, fallback, missing_fields, delegation)

    # 追问文本：优先用模型生成的个性化问法，其次用规则模板；
    # 若生成的问法与上一轮高度重合，直接切换为主动推进，避免复读。
    if decision.next_action == "ask_clarifying_question":
        generated = (decision.question or "").strip()
        if not generated:
            generated = build_clarifying_question(
                decision.missing_fields or missing_fields,
                user_message,
                previous_question=previous_assistant_message,
                known_fields=known_fields,
            )
        if is_repeat(previous_assistant_message, generated):
            decision = _switch_to_proactive(
                decision,
                missing_fields or decision.missing_fields,
                user_message,
                known_fields,
                reason="上一轮问法已被教师跳过，改为按合理默认值主动推进。",
            )
            generated = decision.question or ""
        decision.question = generated

    if delegation and decision.next_action == "ask_clarifying_question" and not decision.proactive:
        decision = _switch_to_proactive(
            decision,
            missing_fields,
            user_message,
            known_fields,
            reason="教师已授权智能体直接推进，不再逐项追问。",
        )

    decision.tool_logs = tool_logs + decision.tool_logs
    return decision


def _switch_to_proactive(
    decision: AgentDecision,
    missing_fields: list[str],
    user_message: str,
    known_fields: dict[str, Any] | None,
    *,
    reason: str,
) -> AgentDecision:
    decision.stage = "plan"
    decision.next_action = "generate_lesson_plan"
    decision.question = build_proactive_reply(missing_fields, user_message, known_fields=known_fields)
    decision.proactive = True
    decision.missing_fields = missing_fields
    decision.confidence = max(decision.confidence, 0.7)
    decision.reason = reason
    decision.assumptions = assumption_lines(missing_fields)
    decision.tool_logs.append(
        ToolLog("proactive_planner", "success", "已生成主动推进方案与默认假设清单，等待教师低成本确认")
    )
    return decision


def _decide_with_model(
    task: CourseTask,
    user_message: str,
    history: list[dict[str, str]],
    files: list[UploadedFile],
    missing_fields: list[str],
    previous_assistant_message: str | None,
    delegation: bool,
) -> AgentDecision | None:
    prompt = _build_decision_prompt(
        task, user_message, history, files, missing_fields, previous_assistant_message, delegation
    )
    try:
        content = call_active_chat_model(
            [{"role": "user", "content": prompt}],
            system=ORCHESTRATOR_SYSTEM_PROMPT,
            temperature=0.15,
            max_tokens=2048,
            timeout=90,
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
    assumptions = data.get("assumptions")
    return AgentDecision(
        stage=stage,
        next_action=next_action,
        question=str(data.get("question") or "") or None,
        missing_fields=normalized_missing,
        confidence=float(confidence) if isinstance(confidence, int | float) else 0.6,
        reason=str(data.get("reason") or "已由模型决策下一步动作。"),
        tool_logs=[ToolLog("llm_orchestrator", "success", "已结合对话历史、任务字段与教师授权状态选择下一步")],
        assumptions=[str(item) for item in assumptions if str(item).strip()] if isinstance(assumptions, list) else [],
        source="model",
    )


def _decide_with_rules(
    user_message: str,
    missing_fields: list[str],
    *,
    delegation: bool = False,
    known_fields: dict[str, Any] | None = None,
) -> AgentDecision:
    lowered = user_message.lower()
    wants_generate = any(keyword in user_message for keyword in ["生成", "课件", "大纲", "教案", "ppt", "PPT", "word", "Word"])
    wants_iterate = any(keyword in user_message for keyword in ["修改", "调整", "优化", "再生成", "换成", "增加", "删除"])

    if missing_fields and not delegation and len((user_message or "").strip()) < 30:
        return AgentDecision(
            stage="clarify",
            next_action="ask_clarifying_question",
            question=build_clarifying_question(missing_fields, user_message, known_fields=known_fields),
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

    if wants_generate or delegation or "generate" in lowered:
        return AgentDecision(
            stage="plan",
            next_action="generate_lesson_plan",
            missing_fields=[],
            confidence=0.76,
            reason="教学需求已较完整，可以继续生成结构化课件大纲。"
            if not delegation
            else "教师已授权智能体推进，直接进入大纲规划。",
        )

    return AgentDecision(
        stage="retrieve",
        next_action="answer_with_context",
        missing_fields=[],
        confidence=0.68,
        reason="教学字段已较完整，本轮先结合知识库和任务上下文回复。",
    )


def _merge_decision(
    model_decision: AgentDecision | None,
    fallback: AgentDecision,
    missing_fields: list[str],
    delegation: bool,
) -> AgentDecision:
    if model_decision is None:
        fallback.tool_logs.append(ToolLog("llm_orchestrator", "skipped", "模型决策不可用，已启用规则兜底"))
        fallback.source = "rules"
        return fallback

    if missing_fields and not delegation:
        # 规则只做安全兜底：模型可以继续推进，但不能在教师没有授权时跳过关键信息
        if model_decision.next_action != "ask_clarifying_question" and model_decision.stage in {"clarify", "retrieve"}:
            model_decision.tool_logs.append(
                ToolLog("rule_field_checker", "success", "仍有关键字段缺失，保留追问动作，但问法由模型个性化生成")
            )
            model_decision.next_action = "ask_clarifying_question"
            model_decision.stage = "clarify"
            model_decision.missing_fields = model_decision.missing_fields or missing_fields
        return model_decision

    if model_decision.next_action == "ask_clarifying_question" and not delegation:
        model_decision.missing_fields = model_decision.missing_fields or missing_fields
    return model_decision


def _build_decision_prompt(
    task: CourseTask,
    user_message: str,
    history: list[dict[str, str]],
    files: list[UploadedFile],
    missing_fields: list[str],
    previous_assistant_message: str | None,
    delegation: bool,
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
        "missing_fields: string[]；question: string|null；assumptions: string[]；confidence: 0到1；reason: string。\n"
        "如果规则缺失字段不为空，原则上先 ask_clarifying_question。\n"
        "但如果 teacher_delegated 为 true（教师说「你帮我做」「直接生成」「你决定」等），"
        "必须改为主动推进：next_action 用 generate_lesson_plan 或 answer_with_context，"
        "question 里用自然语言声明你采用的合理默认值，最多只留一个最低成本的确认问题。\n"
        "question 要求：结合教师原话与已有字段个性化表达，一次最多问 2 个最关键的问题，"
        "禁止使用固定模板句式，禁止与 last_assistant_reply 逐字重复或高度雷同。\n\n"
        f"任务状态：{json.dumps(task_state, ensure_ascii=False)}\n"
        f"teacher_delegated: {json.dumps(delegation, ensure_ascii=False)}\n"
        f"你上一轮的回复：{previous_assistant_message or '（本轮是首次回复）'}\n\n"
        f"最近对话：\n{history_text or '暂无'}\n\n"
        f"教师最新输入：{user_message}\n"
    )


def _format_missing_detail(missing_fields: list[str]) -> str:
    if not missing_fields:
        return "核心教学字段已完整"
    return f"发现缺失字段：{'、'.join(missing_fields)}"
