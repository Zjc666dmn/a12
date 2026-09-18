from typing import Any

from app.services.llm_service import LLMServiceError, call_active_chat_model
from app.services.vector_store import vector_search


SYSTEM_PROMPT = (
    "你是 TeachNova 的多模态 AI 互动式教学智能体，面向教师备课场景。"
    "你的任务是通过多轮对话澄清教学目标、授课对象、课时、知识点、重点难点、"
    "参考资料用途和产出要求，并给出可执行的课件与教案生成建议。"
    "回答要使用中文，结构清晰，优先追问缺失信息。"
)


def _fallback_reply(user_message: str) -> str:
    if len(user_message.strip()) < 10:
        return "请补充课程主题、授课对象和预计课时，我会继续帮你梳理生成需求。"

    return (
        "我已记录你的教学想法。为了生成更贴合课堂的课件，请再确认："
        "1. 授课对象是谁；2. 课程时长是多少；3. 是否需要课堂互动或小游戏。"
    )


def build_assistant_reply(
    user_message: str,
    task_context: dict[str, Any] | None = None,
    history: list[dict[str, str]] | None = None,
    context: dict[str, str] | None = None,
) -> tuple[str, list[dict[str, Any]]]:
    references = vector_search(user_message, top_k=4)

    context_text = ""
    if context:
        context_text = "\n".join(f"{key}: {value}" for key, value in context.items() if value)

    task_text = _format_task_context(task_context or {})
    history_messages = _format_history(history or [])
    rag_text = _format_references(references)

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        *history_messages,
        {
            "role": "user",
            "content": (
                f"教师输入：{user_message}\n\n"
                f"任务信息：\n{task_text or '暂无'}\n\n"
                f"当前上下文：\n{context_text or '暂无'}\n\n"
                f"可参考的本地知识库片段：\n{rag_text or '暂无匹配资料'}\n\n"
                "如果使用了知识库片段，请在回答中自然说明来源文件或页码；"
                "不要编造未出现在任务信息或资料片段中的事实。\n"
                "请作为教学智能体回复。"
            ),
        },
    ]

    try:
        content = call_active_chat_model(
            messages,
            system=SYSTEM_PROMPT,
            temperature=0.7,
            max_tokens=1200,
            timeout=30,
        )
        return content or _fallback_reply(user_message), references
    except LLMServiceError as exc:
        return (
            f"模型调用暂时失败，已切换到本地需求澄清模式。错误信息：{exc}\n\n{_fallback_reply(user_message)}",
            references,
        )


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
