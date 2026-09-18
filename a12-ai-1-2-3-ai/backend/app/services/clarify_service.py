from __future__ import annotations

import re
from typing import Any

QUESTION_TEMPLATES: dict[str, str] = {
    "课程主题": "这节课的课程主题是什么？",
    "授课对象": "这节课面向哪个年级、专业或学习基础的学生？",
    "课时": "这节课预计讲多长时间？例如 45 分钟、90 分钟或 2 课时。",
    "知识点": "希望这节课覆盖哪些核心知识点？",
    "重点难点": "你希望突出哪些重点和难点？",
    "互动形式": "课堂里需要什么互动形式？例如提问、小组讨论、小游戏或随堂测验。",
}


# 教师把决策权交回给智能体时的表达
DELEGATION_PATTERNS = [
    "你帮我",
    "帮我做",
    "帮我生成",
    "帮我出",
    "你来定",
    "你决定",
    "你看着办",
    "看着办",
    "按你的",
    "按你理解",
    "随便",
    "都可以",
    "都行",
    "不用问",
    "别问",
    "别确认",
    "直接生成",
    "直接做",
    "先做",
    "先来一版",
    "先出一版",
    "交给你",
]

# 智能体主动推进时采用的默认假设（教师未说明时使用，需显式告知教师）
DEFAULT_ASSUMPTIONS: dict[str, str] = {
    "课程主题": "沿用你刚才提到的课程主题",
    "授课对象": "按基础教育常规学段、基础中等偏上的学生设定",
    "课时": "按 45 分钟一课时设计",
    "知识点": "按课程标准的核心概念、典型例题、易错点三层组织",
    "重点难点": "按「理解概念 → 会用方法 → 能迁移」拆解重点难点",
    "互动形式": "安排 2 处课堂互动（提问追问 + 小组讨论）",
}

FIELD_ORDER = ["课程主题", "授课对象", "课时", "知识点", "重点难点", "互动形式"]


def is_delegating(user_message: str) -> bool:
    text = (user_message or "").strip()
    if not text:
        return False
    return any(pattern in text for pattern in DELEGATION_PATTERNS)


def _normalize(text: str) -> str:
    return re.sub(r"[\s，。、；：！？,.!?;:'\"（）()【】\[\]—\-]+", "", (text or "").lower())


def _bigrams(text: str) -> set[str]:
    normalized = _normalize(text)
    if len(normalized) < 2:
        return {normalized} if normalized else set()
    return {normalized[index : index + 2] for index in range(len(normalized) - 1)}


def similarity(left: str, right: str) -> float:
    """字符二元组 Jaccard 相似度，用于判断智能体是否在复读上一轮回复。"""
    left_set, right_set = _bigrams(left), _bigrams(right)
    if not left_set or not right_set:
        return 0.0
    return len(left_set & right_set) / len(left_set | right_set)


def is_repeat(previous: str | None, current: str, threshold: float = 0.62) -> bool:
    if not previous or not current:
        return False
    if _normalize(previous) == _normalize(current):
        return True
    return similarity(previous, current) >= threshold


def assumption_lines(missing_fields: list[str]) -> list[str]:
    selected = [field for field in FIELD_ORDER if field in missing_fields]
    return [DEFAULT_ASSUMPTIONS[field] for field in selected if field in DEFAULT_ASSUMPTIONS]


def build_proactive_reply(
    missing_fields: list[str],
    user_message: str = "",
    *,
    known_fields: dict[str, Any] | None = None,
) -> str:
    """教师已授权 / 追问已重复时改成主动推进，而不是继续复读同一组问题。"""
    known = {key: value for key, value in (known_fields or {}).items() if value}
    captured = "、".join(f"{key}：{value}" for key, value in list(known.items())[:3])
    lines: list[str] = []
    if captured:
        lines.append(f"好，我按你说的来，先把你已经给到的信息锁定：{captured}。")
    else:
        lines.append("好，那我不再反复确认，直接按合理默认值开工。")

    assumptions = assumption_lines(missing_fields)
    if assumptions:
        lines.append("整节课我先按这套设定推进：")
        lines.extend(f"{index}. {item}；" for index, item in enumerate(assumptions, start=1))

    lines.append(
        "接下来我会一边锁定教学设计，一边推进课件大纲，你随时打断我改任意一处；"
        "如果想让我换一个学段或课时，直接说「换成高中 / 改成 90 分钟」就行。"
    )
    lines.append("我现在开始拆解这节课的教学结构 —— 有什么是你特别希望讲到 / 讲透的？只回一句也可以。")
    return "\n".join(lines)


def build_clarifying_question(
    missing_fields: list[str],
    user_message: str = "",
    *,
    previous_question: str | None = None,
    known_fields: dict[str, Any] | None = None,
) -> str:
    if not missing_fields:
        return "需求已经比较完整了。我可以继续帮你检索资料并生成课件大纲。"

    if is_delegating(user_message) or is_repeat(previous_question, _compose(missing_fields)):
        return build_proactive_reply(missing_fields, user_message, known_fields=known_fields)

    return _compose(missing_fields, known_fields=known_fields)


def _compose(missing_fields: list[str], *, known_fields: dict[str, Any] | None = None) -> str:
    priority = FIELD_ORDER
    selected = [field for field in priority if field in missing_fields][:3]
    questions = [QUESTION_TEMPLATES[field] for field in selected]

    if len(selected) == 1:
        return questions[0]

    known = {key: value for key, value in (known_fields or {}).items() if value}
    head = "我先记下你的需求。"
    if known:
        head = f"我先接住已经确定的部分：{'、'.join(list(known.keys())[:3])}已记下。"
    tail = "其余的我先按常规课堂设定往下推，你觉得不合适随时喊停。"
    body = " ".join(f"{index}. {question}" for index, question in enumerate(questions, start=1))
    return f"{head}为了不跑偏，只剩这几处想跟你对一下：{body}（{tail}）"
