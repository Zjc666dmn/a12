import json
from pathlib import Path
from typing import Any

from app.core.config import settings
from app.models.task import CourseTask
from app.services.lesson_plan_service import (
    LESSON_PLAN_SYSTEM_PROMPT,
    generate_lesson_plan,
    save_lesson_plan,
)
from app.services.llm_service import LLMServiceError, call_active_chat_model
from app.services.vector_store import vector_search
from app.utils.data import parse_json_object


ITERATION_SYSTEM_PROMPT = (
    LESSON_PLAN_SYSTEM_PROMPT
    + " 现在你要根据教师反馈对已有课件大纲做迭代优化。"
    + "必须保留原大纲中仍然合理的内容，只修改反馈明确要求调整的部分。"
)


def iterate_lesson_plan(task: CourseTask, feedback: str) -> dict[str, Any]:
    previous_plan = load_or_create_lesson_plan(task)
    references = _collect_feedback_references(task, feedback)
    revised = _revise_with_model(task, previous_plan, feedback, references)
    if not revised:
        revised = _revise_with_rules(previous_plan, feedback)
    return _normalize_iteration(revised, previous_plan, feedback, references)


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


def save_iteration_plan(task: CourseTask, plan: dict[str, Any], version: int) -> tuple[Path, Path]:
    settings.outputs_dir.mkdir(parents=True, exist_ok=True)
    current_path = save_lesson_plan(task, plan)
    versioned_path = settings.outputs_dir / f"lesson_plan_task_{task.id}_v{version}.json"
    versioned_path.write_text(json.dumps(plan, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return current_path, versioned_path


def _collect_feedback_references(task: CourseTask, feedback: str) -> list[dict[str, Any]]:
    query = " ".join(
        item
        for item in [
            task.teaching_topic,
            task.title,
            task.subject,
            task.requirement_summary,
            feedback,
        ]
        if item
    )
    return vector_search(query or feedback or task.title, top_k=6)


def _revise_with_model(
    task: CourseTask,
    previous_plan: dict[str, Any],
    feedback: str,
    references: list[dict[str, Any]],
) -> dict[str, Any]:
    reference_text = "\n\n".join(
        f"[{index}] 来源：{item.get('source') or '本地知识库'}；页码：{item.get('page') or '未知'}\n{str(item.get('content', ''))[:800]}"
        for index, item in enumerate(references, start=1)
    )
    prompt = (
        "请根据教师反馈迭代已有课件大纲，并只返回完整 JSON。\n"
        "已有大纲 JSON：\n"
        f"{json.dumps(previous_plan, ensure_ascii=False)}\n\n"
        f"教师反馈：{feedback}\n\n"
        f"可补充参考资料：\n{reference_text or '暂无'}\n\n"
        "要求：\n"
        "1. 输出字段结构必须与已有大纲保持一致；\n"
        "2. 若反馈要求调整顺序、简化页面、增加案例或增加互动，请反映到 slides、activities、teaching_process 中；\n"
        "3. 不要删除 references，新增资料引用时写明用途；\n"
        "4. 在 iteration 字段记录本次反馈摘要和主要修改点。"
    )
    try:
        content = call_active_chat_model(
            [{"role": "user", "content": prompt}],
            system=ITERATION_SYSTEM_PROMPT,
            temperature=0.3,
            max_tokens=3000,
            timeout=45,
        )
        return parse_json_object(content)
    except (LLMServiceError, json.JSONDecodeError):
        return {}


def _revise_with_rules(previous_plan: dict[str, Any], feedback: str) -> dict[str, Any]:
    revised = json.loads(json.dumps(previous_plan, ensure_ascii=False))
    slides = revised.get("slides")
    if isinstance(slides, list) and slides:
        lowered = feedback.lower()
        if "简化" in feedback:
            for slide in slides:
                if isinstance(slide, dict) and isinstance(slide.get("bullet_points"), list):
                    slide["bullet_points"] = slide["bullet_points"][:3]
        if "案例" in feedback or "case" in lowered:
            slides.insert(
                min(3, len(slides)),
                {
                    "title": "补充案例",
                    "bullet_points": ["结合真实课堂或业务场景说明知识点", "引导学生判断案例中的关键步骤", "总结案例对应的易错点"],
                    "speaker_notes": "根据教师反馈新增案例页，可替换为本课程实际案例。",
                    "visual_suggestion": "使用情境图、流程图或对照表呈现案例。",
                    "interaction": "请学生指出案例中的关键判断依据。",
                },
            )
        if "互动" in feedback or "游戏" in feedback:
            revised.setdefault("activities", [])
            if isinstance(revised["activities"], list):
                revised["activities"].append(
                    {
                        "name": "反馈新增互动",
                        "type": "课堂小游戏",
                        "description": "根据教师反馈新增一个 3 到 5 分钟的课堂互动环节。",
                        "expected_outcome": "让学生在参与中复述关键知识点并暴露误区。",
                    }
                )
    return revised


def _normalize_iteration(
    revised: dict[str, Any],
    previous_plan: dict[str, Any],
    feedback: str,
    references: list[dict[str, Any]],
) -> dict[str, Any]:
    if not isinstance(revised, dict):
        revised = previous_plan
    for key, value in previous_plan.items():
        revised.setdefault(key, value)
    revised["iteration"] = {
        "feedback": feedback,
        "summary": "已根据教师反馈调整课件大纲，并重新生成配套产物。",
        "reference_count": len(references),
    }
    if references:
        existing = revised.get("references") if isinstance(revised.get("references"), list) else []
        revised["references"] = [
            *existing,
            *[
                {"source": item.get("source"), "page": item.get("page"), "usage": "按反馈迭代时补充参考"}
                for item in references[:3]
            ],
        ][:8]
    return revised
