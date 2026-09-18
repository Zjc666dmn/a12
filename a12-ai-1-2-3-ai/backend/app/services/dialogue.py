from collections.abc import Iterator
from typing import Any

from app.services.clarify_service import build_proactive_reply, is_delegating
from app.services.llm_service import LLMServiceError, call_active_chat_model, stream_active_chat_model
from app.services.vector_store import vector_search


SYSTEM_PROMPT = (
    "你是 TeachNova 的多模态 AI 互动式教学智能体，面向教师备课场景。"
    "你的任务是通过多轮对话澄清教学目标、授课对象、课时、知识点、重点难点、"
    "参考资料用途和产出要求，并给出可执行的课件与教案生成建议。"
    "回答要使用中文，结构清晰。"
    "你要像一位有经验的教研搭档：先说明你已经理解了什么、准备怎么做，再推进下一步；"
    "不要机械重复上一轮的确认清单，不要把同一组问题原样再问一遍。"
    "教师把决定权交给你时，要主动给出合理默认设定并继续推进，只保留最低成本的确认。"
)


def _fallback_reply(user_message: str, task_context: dict[str, Any] | None = None) -> str:
    context = task_context or {}
    missing = context.get("missing_fields") if isinstance(context.get("missing_fields"), list) else []
    if missing:
        return build_proactive_reply([str(item) for item in missing], user_message)
    if len(user_message.strip()) < 10:
        return "请补充课程主题、授课对象和预计课时，我会继续帮你梳理生成需求。"

    return (
        "我先按你说的方向推进：把课程主题、授课对象和课时这三件事定下来，"
        "再往下拆知识点与课堂互动。你只需要告诉我最想讲透的那一个点，其余我按常规课堂设定补齐。"
    )


def prepare_reply(
    user_message: str,
    task_context: dict[str, Any] | None = None,
    history: list[dict[str, str]] | None = None,
    context: dict[str, str] | None = None,
) -> tuple[list[dict[str, str]], list[dict[str, Any]]]:
    """组装一次回复所需的 messages 与知识库引用。"""
    references = vector_search(user_message, top_k=4)

    context_text = ""
    if context:
        context_text = "\n".join(f"{key}: {value}" for key, value in context.items() if value)

    task_text = _format_task_context(task_context or {})
    history_messages = _format_history(history or [])
    rag_text = _format_references(references)

    agent_state = _format_agent_state(task_context or {})
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        *history_messages,
        {
            "role": "user",
            "content": (
                f"教师输入：{user_message}\n\n"
                f"任务信息：\n{task_text or '暂无'}\n\n"
                f"智能体当前状态：\n{agent_state or '暂无'}\n\n"
                f"当前上下文：\n{context_text or '暂无'}\n\n"
                f"可参考的本地知识库片段：\n{rag_text or '暂无匹配资料'}\n\n"
                "如果使用了知识库片段，请在回答中自然说明来源文件或页码；"
                "不要编造未出现在任务信息或资料片段中的事实。\n"
                "请作为教学智能体回复：先简短说明你的判断与准备怎么做，再给出推进动作。"
            ),
        },
    ]
    return messages, references


def stream_assistant_reply(
    user_message: str,
    task_context: dict[str, Any] | None = None,
    history: list[dict[str, str]] | None = None,
    context: dict[str, str] | None = None,
) -> Iterator[dict[str, Any]]:
    """流式产出回复事件：reasoning / delta / references / error。"""
    messages, references = prepare_reply(user_message, task_context, history, context)
    yield {"type": "references", "references": references}

    collected: list[str] = []
    try:
        for chunk in stream_active_chat_model(
            messages,
            system=SYSTEM_PROMPT,
            temperature=0.6,
            max_tokens=1600,
            timeout=120,
        ):
            if chunk.get("type") == "delta" and chunk.get("text"):
                collected.append(chunk["text"])
            yield chunk
    except LLMServiceError as exc:
        fallback = f"模型调用暂时失败，已切换到本地推进模式。错误信息：{exc}\n\n{_fallback_reply(user_message, task_context)}"
        yield {"type": "error", "text": str(exc)}
        yield {"type": "delta", "text": fallback}
        return

    if not "".join(collected).strip():
        yield {"type": "delta", "text": _fallback_reply(user_message, task_context)}


def build_assistant_reply(
    user_message: str,
    task_context: dict[str, Any] | None = None,
    history: list[dict[str, str]] | None = None,
    context: dict[str, str] | None = None,
) -> tuple[str, list[dict[str, Any]]]:
    messages, references = prepare_reply(user_message, task_context, history, context)

    try:
        content = call_active_chat_model(
            messages,
            system=SYSTEM_PROMPT,
            temperature=0.6,
            max_tokens=1600,
            timeout=60,
        )
        return content or _fallback_reply(user_message, task_context), references
    except LLMServiceError as exc:
        return (
            f"模型调用暂时失败，已切换到本地推进模式。错误信息：{exc}\n\n{_fallback_reply(user_message, task_context)}",
            references,
        )


def _format_agent_state(task_context: dict[str, Any]) -> str:
    lines: list[str] = []
    stage = task_context.get("agent_stage")
    action = task_context.get("agent_next_action")
    if stage:
        lines.append(f"阶段：{stage}")
    if action:
        lines.append(f"本轮动作：{action}")
    missing = task_context.get("missing_fields")
    if isinstance(missing, list) and missing:
        lines.append(f"规则检测到的缺失字段：{'、'.join(str(item) for item in missing)}")
    assumptions = task_context.get("assumptions")
    if isinstance(assumptions, list) and assumptions:
        lines.append("本轮准备采用的默认设定：" + "；".join(str(item) for item in assumptions))
    if task_context.get("teacher_delegated"):
        lines.append("教师已把决策权交给智能体：请主动推进，不要重复确认清单")
    return "\n".join(lines)


def _format_task_context(task_context: dict[str, Any]) -> str:
    labels = {
        "title": "课程主题",
        "subject": "学科",
        "audience": "授课对象",
        "duration_minutes": "课程时长",
        "requirement_summary": "需求摘要",
        "teaching_topic": "结构化课程主题",
        "knowledge_points": "知识点",
        "key_difficulties": "重点难点",
        "interaction_design": "互动形式",
        "files": "已上传资料",
    }
    lines: list[str] = []
    for key, label in labels.items():
        value = task_context.get(key)
        if value:
            lines.append(f"{label}: {value}")
    return "\n".join(lines)


def _format_history(history: list[dict[str, str]]) -> list[dict[str, str]]:
    allowed_roles = {"user", "assistant"}
    formatted: list[dict[str, str]] = []
    for item in history[-8:]:
        role = item.get("role", "")
        content = item.get("content", "").strip()
        if role in allowed_roles and content:
            formatted.append({"role": role, "content": content[:1200]})
    return formatted


def _format_references(references: list[dict[str, Any]]) -> str:
    lines: list[str] = []
    for index, item in enumerate(references, start=1):
        page = f"，页码 {item['page']}" if item.get("page") else ""
        section = f"，章节 {item['section']}" if item.get("section") else ""
        source = item.get("source") or "未知资料"
        content = str(item.get("content", "")).strip().replace("\n", " ")[:700]
        lines.append(f"[{index}] 来源：{source}{page}{section}\n内容：{content}")
    return "\n\n".join(lines)


__all__ = [
    "SYSTEM_PROMPT",
    "build_assistant_reply",
    "is_delegating",
    "prepare_reply",
    "stream_assistant_reply",
]
