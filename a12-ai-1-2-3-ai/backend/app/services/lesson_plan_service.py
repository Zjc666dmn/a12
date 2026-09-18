import json
import re
from pathlib import Path
from typing import Any

from app.core.config import settings
from app.models.task import CourseTask
from app.services.llm_service import LLMServiceError, call_active_chat_model
from app.services.vector_store import vector_search
from app.utils.data import as_object_list, as_string_list, parse_json_object, parse_string_list


LESSON_PLAN_SYSTEM_PROMPT = (
    "你是 TeachNova 的课件大纲生成器。"
    "你要根据教学意图、本地知识库片段和教师需求生成可直接用于 PPT 与教案的结构化 JSON。"
    "必须只返回 JSON，不要添加 Markdown、解释或代码块。"
)


def generate_lesson_plan(task: CourseTask) -> dict[str, Any]:
    references = _collect_references(task)
    plan = _generate_with_model(task, references)
    if not plan:
        plan = _fallback_plan(task, references)
    return _normalize_plan(plan, task, references)


def save_lesson_plan(task: CourseTask, plan: dict[str, Any]) -> Path:
    settings.outputs_dir.mkdir(parents=True, exist_ok=True)
    output_path = settings.outputs_dir / f"lesson_plan_task_{task.id}.json"
    output_path.write_text(json.dumps(plan, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return output_path


def load_or_create_lesson_plan(task: CourseTask) -> dict[str, Any]:
    plan_path = settings.outputs_dir / f"lesson_plan_task_{task.id}.json"
    if plan_path.exists():
        with plan_path.open("r", encoding="utf-8") as file:
            data = json.load(file)
        if isinstance(data, dict):
            return data

    plan = generate_lesson_plan(task)
    save_lesson_plan(task, plan)
    return plan


def _collect_references(task: CourseTask) -> list[dict[str, Any]]:
    query = " ".join(
        item
        for item in [
            task.teaching_topic,
            task.title,
            task.subject,
            task.requirement_summary,
            task.knowledge_points,
            task.key_difficulties,
        ]
        if item
    )
    return vector_search(query or task.title, top_k=6)


def _generate_with_model(task: CourseTask, references: list[dict[str, Any]]) -> dict[str, Any]:
    prompt = _build_prompt(task, references)

    try:
        content = call_active_chat_model(
            [{"role": "user", "content": prompt}],
            system=LESSON_PLAN_SYSTEM_PROMPT,
            temperature=0.35,
            max_tokens=2400,
            timeout=45,
        )
        return parse_json_object(content)
    except (LLMServiceError, json.JSONDecodeError):
        return {}


def _build_prompt(task: CourseTask, references: list[dict[str, Any]]) -> str:
    intent = {
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
    reference_text = "\n\n".join(
        f"[{index}] 来源：{item.get('source') or '本地知识库'}；页码：{item.get('page') or '未知'}\n{str(item.get('content', ''))[:800]}"
        for index, item in enumerate(references, start=1)
    )
    return (
        "请生成结构化课件大纲 JSON，字段必须包含：\n"
        "title: string；audience: string|null；duration_minutes: number|null；"
        "teaching_targets: string[]；key_difficulties: string[]；"
        "slides: [{title:string, bullet_points:string[], speaker_notes:string, visual_suggestion:string, interaction:string|null}]；"
        "teaching_process: [{phase:string, minutes:number|null, teacher_activity:string, student_activity:string}]；"
        "activities: [{name:string, type:string, description:string, expected_outcome:string}]；"
        "homework: string[]；references: [{source:string, page:number|null, usage:string}]。\n"
        "要求 6 到 8 页 PPT；内容要适合教师直接二次编辑；引用资料只能来自给定片段。\n\n"
        f"教学意图：{json.dumps(intent, ensure_ascii=False)}\n\n"
        f"本地知识库片段：\n{reference_text or '暂无'}\n"
    )


def _fallback_plan(task: CourseTask, references: list[dict[str, Any]]) -> dict[str, Any]:
    topic = task.teaching_topic or task.title
    knowledge_points = parse_string_list(task.knowledge_points) or _infer_points_from_references(references) or [topic]
    difficulties = parse_string_list(task.key_difficulties) or [f"理解 {topic} 的核心概念与应用边界"]
    interactions = parse_string_list(task.interaction_design)

    slides = [
        {
            "title": topic,
            "bullet_points": ["课程背景", "学习目标", "课堂任务"],
            "speaker_notes": f"用一个贴近学生经验的问题引入 {topic}。",
            "visual_suggestion": "封面使用主题关键词、课程对象和简洁图形元素。",
            "interaction": None,
        },
        {
            "title": "学习目标",
            "bullet_points": [f"说出 {topic} 的基本含义", "梳理关键流程", "完成课堂练习并解释原因"],
            "speaker_notes": "先明确本节课学完后学生能做什么。",
            "visual_suggestion": "用三段式目标卡片呈现。",
            "interaction": "请学生用一句话描述自己已有认知。",
        },
    ]
    for point in knowledge_points[:4]:
        slides.append(
            {
                "title": point,
                "bullet_points": _bullets_from_reference(point, references),
                "speaker_notes": f"围绕 {point} 讲解定义、步骤和易错点。",
                "visual_suggestion": "使用流程图、对比表或示意图辅助解释。",
                "interaction": None,
            }
        )
    slides.extend(
        [
            {
                "title": "重点难点突破",
                "bullet_points": difficulties[:3],
                "speaker_notes": "通过提问、反例和类比帮助学生突破理解障碍。",
                "visual_suggestion": "用问题链或对照表展示。",
                "interaction": interactions[0] if interactions else "小组讨论：说出一个最容易混淆的点。",
            },
            {
                "title": "课堂总结与作业",
                "bullet_points": ["回顾核心知识", "完成课堂自测", "布置课后任务"],
                "speaker_notes": "用 3 个问题检查学生是否达成目标。",
                "visual_suggestion": "使用总结清单和出口测验。",
                "interaction": "学生提交一句本节课收获。",
            },
        ]
    )

    return {
        "title": topic,
        "audience": task.audience,
        "duration_minutes": task.duration_minutes,
        "teaching_targets": [
            f"理解 {topic} 的基本概念",
            "能够按逻辑顺序复述关键知识点",
            "能够完成一个课堂练习或互动任务",
        ],
        "key_difficulties": difficulties,
        "slides": slides[:8],
        "teaching_process": [
            {"phase": "导入", "minutes": 5, "teacher_activity": "提出情境问题，引出主题", "student_activity": "回答已有经验"},
            {"phase": "新知讲解", "minutes": 25, "teacher_activity": "结合资料讲解核心知识", "student_activity": "记录要点并参与提问"},
            {"phase": "互动练习", "minutes": 10, "teacher_activity": "组织课堂活动并点评", "student_activity": "完成互动任务"},
            {"phase": "总结评价", "minutes": 5, "teacher_activity": "归纳重点并布置作业", "student_activity": "完成出口测验"},
        ],
        "activities": [
            {
                "name": interactions[0] if interactions else "课堂抢答",
                "type": "互动问答",
                "description": "围绕关键概念设置 3 到 5 个判断或选择问题。",
                "expected_outcome": "学生能及时暴露误区并完成知识巩固。",
            }
        ],
        "homework": ["整理本节课知识结构图", "完成 3 道概念应用题"],
    }


def _normalize_plan(plan: dict[str, Any], task: CourseTask, references: list[dict[str, Any]]) -> dict[str, Any]:
    topic = task.teaching_topic or task.title
    normalized = {
        "title": str(plan.get("title") or topic),
        "audience": plan.get("audience") or task.audience,
        "duration_minutes": plan.get("duration_minutes") or task.duration_minutes,
        "teaching_targets": as_string_list(plan.get("teaching_targets")),
        "key_difficulties": as_string_list(plan.get("key_difficulties")) or parse_string_list(task.key_difficulties),
        "slides": _slide_list(plan.get("slides")),
        "teaching_process": as_object_list(plan.get("teaching_process")),
        "activities": as_object_list(plan.get("activities")),
        "homework": as_string_list(plan.get("homework")),
        "references": _reference_list(plan.get("references"), references),
    }
    if not normalized["teaching_targets"] or not normalized["slides"]:
        return _normalize_plan(_fallback_plan(task, references), task, references)
    return normalized


def _slide_list(value: Any) -> list[dict[str, Any]]:
    slides = as_object_list(value)
    normalized: list[dict[str, Any]] = []
    for slide in slides[:10]:
        title = str(slide.get("title") or "内容页")
        normalized.append(
            {
                "title": title,
                "bullet_points": as_string_list(slide.get("bullet_points"))[:6],
                "speaker_notes": str(slide.get("speaker_notes") or ""),
                "visual_suggestion": str(slide.get("visual_suggestion") or ""),
                "interaction": slide.get("interaction") if isinstance(slide.get("interaction"), str) else None,
            }
        )
    return normalized


def _reference_list(value: Any, fallback: list[dict[str, Any]]) -> list[dict[str, Any]]:
    references = as_object_list(value)
    if not references:
        references = [
            {"source": item.get("source"), "page": item.get("page"), "usage": "生成课件内容参考"}
            for item in fallback[:6]
        ]
    return references[:8]


def _infer_points_from_references(references: list[dict[str, Any]]) -> list[str]:
    points: list[str] = []
    for item in references[:4]:
        section = item.get("section")
        if section:
            points.append(str(section))
            continue
        content = str(item.get("content", ""))
        sentence = re.split(r"[。.!！?？\n]", content.strip())[0]
        if sentence:
            points.append(sentence[:24])
    return points


def _bullets_from_reference(point: str, references: list[dict[str, Any]]) -> list[str]:
    for item in references:
        content = str(item.get("content", ""))
        if point in content:
            bullets = [chunk.strip() for chunk in re.split(r"[。；;\n]", content) if chunk.strip()]
            return bullets[:3] or [point]
    return [f"解释 {point} 的概念", f"说明 {point} 的流程或结构", f"分析 {point} 的常见误区"]
