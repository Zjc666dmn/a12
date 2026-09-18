import json
import re
from typing import Any

from app.models.task import CourseTask
from app.services.llm_service import LLMServiceError, call_active_chat_model
from app.utils.data import parse_json_object, parse_string_list


INTENT_SYSTEM_PROMPT = (
    "你是 TeachNova 的教学意图结构化抽取器。"
    "你只从教师输入、任务信息和历史对话中抽取确定信息，不能编造。"
    "必须只返回 JSON，不要添加 Markdown 或解释。"
)

INTENT_FIELDS = [
    "teaching_topic",
    "audience",
    "duration_minutes",
    "knowledge_points",
    "key_difficulties",
    "interaction_design",
    "requirement_summary",
    "missing_fields",
    "confidence",
]


def update_task_intent_from_chat(
    task: CourseTask,
    user_message: str,
    history: list[dict[str, str]] | None = None,
) -> dict[str, Any]:
    fallback = _extract_with_rules(user_message)
    extracted = _extract_with_model(task, user_message, history or []) if _should_use_model(user_message, fallback) else {}
    intent = _merge_intent(extracted, fallback)
    _apply_intent(task, intent)
    return intent


def _extract_with_model(
    task: CourseTask,
    user_message: str,
    history: list[dict[str, str]],
) -> dict[str, Any]:
    prompt = _build_intent_prompt(task, user_message, history)

    try:
        content = call_active_chat_model(
            [{"role": "user", "content": prompt}],
            system=INTENT_SYSTEM_PROMPT,
            temperature=0.1,
            max_tokens=900,
            timeout=8,
        )
        return parse_json_object(content)
    except (LLMServiceError, json.JSONDecodeError):
        return {}


def _build_intent_prompt(task: CourseTask, user_message: str, history: list[dict[str, str]]) -> str:
    history_text = "\n".join(
        f"{item.get('role', '')}: {item.get('content', '')[:600]}"
        for item in history[-8:]
        if item.get("content")
    )
    current_state = {
        "title": task.title,
        "subject": task.subject,
        "audience": task.audience,
        "duration_minutes": task.duration_minutes,
        "requirement_summary": task.requirement_summary,
        "teaching_topic": task.teaching_topic,
        "knowledge_points": parse_string_list(task.knowledge_points),
        "key_difficulties": parse_string_list(task.key_difficulties),
        "interaction_design": parse_string_list(task.interaction_design),
    }
    return (
        "请抽取并更新教学意图 JSON。字段固定如下：\n"
        "teaching_topic: string|null；audience: string|null；duration_minutes: number|null；"
        "knowledge_points: string[]；key_difficulties: string[]；interaction_design: string[]；"
        "requirement_summary: string|null；missing_fields: string[]；confidence: 0到1的小数。\n"
        "如果新输入没有提到某字段，但现有任务已有值，可以保留现有值。\n\n"
        f"现有任务：{json.dumps(current_state, ensure_ascii=False)}\n\n"
        f"最近对话：\n{history_text or '暂无'}\n\n"
        f"教师最新输入：{user_message}\n"
    )


def _extract_with_rules(text: str) -> dict[str, Any]:
    result: dict[str, Any] = {}
    duration_match = re.search(r"(\d{1,3})\s*(分钟|分|课时|小时)", text)
    if duration_match:
        value = int(duration_match.group(1))
        result["duration_minutes"] = value * 60 if duration_match.group(2) == "小时" else value

    audience_match = re.search(r"(?:给|面向|针对)?((?:小学|初中|高中|高一|高二|高三|中职|高职|大一|大二|大学|本科|研究生)[^，。,.；;\n讲学]{0,8}(?:学生|同学|新生))", text)
    if audience_match:
        result["audience"] = audience_match.group(1)

    topic_patterns = [
        r"讲(?:一下|一节|一堂)?(?:\d{1,3}\s*(?:分钟|分|课时|小时))?([^，。,.；;\n]{2,30})",
        r"(?:做|设计|准备)(?:一节|一堂)?([^，。,.；;\n]{2,30})(?:的课|课程|课件|教案)",
        r"主题[是为：:]?([^，。,.；;\n]{2,30})",
        r"课程[是为：:]?([^，。,.；;\n]{2,30})",
    ]
    for pattern in topic_patterns:
        match = re.search(pattern, text)
        if match:
            result["teaching_topic"] = _clean_phrase(match.group(1))
            break

    knowledge_points = _extract_list_after_keywords(text, ["知识点", "内容包括", "包括"])
    if knowledge_points:
        result["knowledge_points"] = knowledge_points

    difficulties = _extract_list_after_keywords(text, ["重点", "难点", "重点难点"])
    if difficulties:
        result["key_difficulties"] = difficulties

    interactions = _extract_list_after_keywords(text, ["互动", "小游戏", "课堂活动", "活动"])
    design_match = re.search(r"设计(?:一个|一种|一场)?([^，。,.；;\n]{2,40})", text)
    if design_match:
        interactions = [_clean_phrase(design_match.group(1)), *interactions]
    if interactions:
        result["interaction_design"] = _dedupe(interactions)


    summary = text.strip()
    if summary:
        result["requirement_summary"] = summary[:500]
    result["confidence"] = 0.45 if len(result) > 1 else 0.2
    return result


def _should_use_model(text: str, fallback: dict[str, Any]) -> bool:
    signal_fields = [
        key
        for key in ["teaching_topic", "audience", "duration_minutes", "knowledge_points", "key_difficulties", "interaction_design"]
        if fallback.get(key) not in (None, "", [])
    ]
    if len(signal_fields) >= 2:
        return False
    if len(text.strip()) < 30:
        return False
    return any(keyword in text for keyword in ["教学目标", "学情", "重点", "难点", "知识点", "互动", "参考资料", "生成"])


def _extract_list_after_keywords(text: str, keywords: list[str]) -> list[str]:
    for keyword in keywords:
        if keyword not in text:
            continue
        tail = text.split(keyword, 1)[1][:120]
        tail = re.split(r"(?:设计|互动|活动|小游戏|课后|作业)", tail, maxsplit=1)[0] or tail
        items = re.split(r"[、,，；;。\n]", tail)
        cleaned = [_clean_phrase(item) for item in items]
        return [item for item in cleaned if 2 <= len(item) <= 40][:6]
    return []


def _clean_phrase(value: str) -> str:
    cleaned = value.strip(" ：:，。,.；;、 ")
    cleaned = re.sub(r"^(需要|设计|包含|包括|是|为)", "", cleaned).strip()
    cleaned = re.sub(r"^\d{1,3}\s*(?:分钟|分|课时|小时)", "", cleaned).strip()
    return cleaned


def _dedupe(values: list[str]) -> list[str]:
    result: list[str] = []
    for value in values:
        if value and value not in result:
            result.append(value)
    return result[:6]


def _merge_intent(primary: dict[str, Any], fallback: dict[str, Any]) -> dict[str, Any]:
    result = {key: primary.get(key) for key in INTENT_FIELDS if primary.get(key) not in (None, "", [])}
    for key, value in fallback.items():
        if result.get(key) in (None, "", []):
            result[key] = value
    return result


def _apply_intent(task: CourseTask, intent: dict[str, Any]) -> None:
    text_fields = ["teaching_topic", "audience", "requirement_summary"]
    for field in text_fields:
        value = intent.get(field)
        if isinstance(value, str) and value.strip():
            setattr(task, field, value.strip())

    duration = intent.get("duration_minutes")
    if isinstance(duration, int) and duration > 0:
        task.duration_minutes = duration
    elif isinstance(duration, float) and duration > 0:
        task.duration_minutes = int(duration)

    for field in ["knowledge_points", "key_difficulties", "interaction_design"]:
        values = intent.get(field)
        if isinstance(values, list) and values:
            setattr(task, field, json.dumps([str(item) for item in values if str(item).strip()], ensure_ascii=False))

    topic = intent.get("teaching_topic")
    if isinstance(topic, str) and topic.strip() and task.title.startswith("新教学任务"):
        task.title = topic.strip()[:200]

    if task.teaching_topic and not task.title:
        task.title = task.teaching_topic[:200]

    missing_fields = intent.get("missing_fields")
    if not isinstance(missing_fields, list):
        missing_fields = _derive_missing_fields(task)
    task.intent_status = "confirmed" if isinstance(missing_fields, list) and not missing_fields else "partial"

    confidence = intent.get("confidence")
    if isinstance(confidence, int | float):
        task.intent_confidence = f"{max(0, min(float(confidence), 1)):.2f}"


def _derive_missing_fields(task: CourseTask) -> list[str]:
    field_labels = {
        "teaching_topic": "课程主题",
        "audience": "授课对象",
        "duration_minutes": "课时",
        "knowledge_points": "知识点",
        "key_difficulties": "重点难点",
        "interaction_design": "互动形式",
    }
    missing: list[str] = []
    for field, label in field_labels.items():
        value = getattr(task, field, None)
        if value in (None, "", "[]"):
            missing.append(label)
    return missing
