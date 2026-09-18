from __future__ import annotations

from typing import Any

from app.models.task import CourseTask
from app.utils.data import parse_string_list


def build_frontend_agent_session(task: CourseTask) -> tuple[dict[str, Any], float, list[str]]:
    requirement = {
        "subject": task.subject,
        "grade": _infer_grade(task.audience),
        "topic": task.teaching_topic or _valid_title(task.title),
        "audience": task.audience,
        "duration": task.duration_minutes,
        "scene": _infer_scene(task.requirement_summary),
    }
    missing = [
        field
        for field, value in {
            "topic": requirement["topic"],
            "audience": requirement["audience"],
            "duration": requirement["duration"],
        }.items()
        if value in (None, "", 0)
    ]
    completeness = round((3 - len(missing)) / 3, 2)
    stage = _stage_for_task(task, missing)
    outline = _outline_from_task(task)
    session = {
        "stage": stage,
        "requirement": requirement,
        "teaching": {
            "objectives": _default_objectives(requirement["topic"]),
            "keyPoints": parse_string_list(task.knowledge_points),
            "difficultPoints": parse_string_list(task.key_difficulties),
            "activities": parse_string_list(task.interaction_design),
            "exercises": ["完成课堂随堂练习", "课后绘制知识结构图"],
        },
        "outline": outline,
        "style": {
            "theme": "科技蓝",
            "layout": "图文均衡",
            "imageStyle": "扁平插画",
        },
        "ppt": {
            "id": None,
            "slides": outline,
        },
        "control": {
            "pendingField": missing[0] if missing else None,
            "requirementConfirmed": not missing,
            "teachingConfirmed": not missing,
            "outlineConfirmed": stage in {"style", "generating", "editor"},
            "styleConfirmed": stage in {"generating", "editor"},
            "lastTransition": None,
        },
    }
    return session, completeness, missing


def next_question_from_missing(missing: list[str]) -> str | None:
    questions = {
        "topic": "请补充这节课的准确课程主题。",
        "audience": "请确认授课对象，例如高职一年级学生、初中生或零基础学员。",
        "duration": "请确认课程时长，例如 45 分钟、90 分钟或 2 课时。",
    }
    return questions.get(missing[0]) if missing else None


def generation_state_from_task(task: CourseTask) -> dict[str, Any]:
    return {
        "topic": task.teaching_topic or _valid_title(task.title) or task.title,
        "subject": task.subject,
        "audience": task.audience,
        "duration_minutes": task.duration_minutes,
        "knowledge_points": parse_string_list(task.knowledge_points),
        "key_difficulties": parse_string_list(task.key_difficulties),
        "interaction": parse_string_list(task.interaction_design),
    }


def _stage_for_task(task: CourseTask, missing: list[str]) -> str:
    if task.status in {"review", "complete"}:
        return "editor"
    if task.status == "generating" or (not missing and task.intent_status == "confirmed"):
        return "generating"
    if not missing:
        return "generating"
    return "clarification"


def _outline_from_task(task: CourseTask) -> list[dict[str, Any]]:
    topic = task.teaching_topic or _valid_title(task.title) or "课程主题"
    titles = [
        f"{topic}导入",
        "核心概念讲解",
        "流程与案例分析",
        "课堂互动练习",
        "总结与作业",
    ]
    return [
        {"order": index, "title": title, "purpose": purpose}
        for index, (title, purpose) in enumerate(
            zip(titles, ["激活先验知识", "建立概念框架", "理解应用场景", "促进参与反馈", "巩固迁移"], strict=False),
            start=1,
        )
    ]


def _default_objectives(topic: str | None) -> list[str]:
    topic = topic or "本课主题"
    return [f"理解{topic}的核心概念", f"能够说明{topic}的关键流程", f"能够完成{topic}相关课堂练习"]


def _valid_title(title: str | None) -> str | None:
    if not title or title in {"新教学任务", "未命名任务", "未分组课程"}:
        return None
    return title


def _infer_grade(audience: str | None) -> str | None:
    if not audience:
        return None
    for marker in ["小学", "初中", "高中", "中职", "高职", "大学", "本科", "研究生"]:
        if marker in audience:
            return marker
    return None


def _infer_scene(summary: str | None) -> str | None:
    if not summary:
        return None
    for scene in ["新授课", "复习课", "公开课", "实训课", "实验课", "线上课"]:
        if scene in summary:
            return scene
    return "新授课"
