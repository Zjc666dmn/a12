from __future__ import annotations


QUESTION_TEMPLATES: dict[str, str] = {
    "课程主题": "这节课的课程主题是什么？",
    "授课对象": "这节课面向哪个年级、专业或学习基础的学生？",
    "课时": "这节课预计讲多长时间？例如 45 分钟、90 分钟或 2 课时。",
    "知识点": "希望这节课覆盖哪些核心知识点？",
    "重点难点": "你希望突出哪些重点和难点？",
    "互动形式": "课堂里需要什么互动形式？例如提问、小组讨论、小游戏或随堂测验。",
}


def build_clarifying_question(missing_fields: list[str], user_message: str = "") -> str:
    if not missing_fields:
        return "需求已经比较完整了。我可以继续帮你检索资料并生成课件大纲。"

    priority = ["课程主题", "授课对象", "课时", "知识点", "重点难点", "互动形式"]
    selected = [field for field in priority if field in missing_fields][:3]
    questions = [QUESTION_TEMPLATES[field] for field in selected]

    if len(selected) == 1:
        return questions[0]

    lead = "我已经记录了你的想法。为了让课件更贴合课堂，请再确认："
    return lead + " ".join(f"{index}. {question}" for index, question in enumerate(questions, start=1))
