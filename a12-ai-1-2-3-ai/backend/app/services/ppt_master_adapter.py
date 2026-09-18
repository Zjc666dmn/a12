"""Adapter for the repository-local PPT Master Quick Generate workflow.

TeachNova owns the teaching plan. PPT Master owns the SVG validation and
native DrawingML export. Keeping this boundary explicit prevents the old
``python-pptx`` fallback from being reported as a PPT Master run.
"""

from __future__ import annotations

import json
import re
import subprocess
import sys
from datetime import datetime
from html import escape
from pathlib import Path
from typing import Any

from app.core.config import PROJECT_ROOT, settings
from app.models.task import CourseTask
from app.services.lesson_plan_service import load_or_create_lesson_plan
from app.utils.data import as_object_list, as_string_list


PPT_MASTER_DIR = PROJECT_ROOT / "tools" / "ppt-master"
PPT_MASTER_SKILL_DIR = PPT_MASTER_DIR / "skills" / "ppt-master"
PPT_MASTER_SCRIPTS = PPT_MASTER_SKILL_DIR / "scripts"
PPT_MASTER_PYTHON = sys.executable
CANVAS_WIDTH = 1280
CANVAS_HEIGHT = 720


class PptMasterError(RuntimeError):
    """Raised when the native PPT Master route cannot complete."""


def generate_with_ppt_master(task: CourseTask) -> tuple[Path, dict[str, Any], str]:
    plan = load_or_create_lesson_plan(task)
    output_path = settings.outputs_dir / "ppt" / f"lesson_slides_task_{task.id}.pptx"
    output_path.parent.mkdir(parents=True, exist_ok=True)

    workspace = _ensure_workspace(task)
    _write_source(workspace, task, plan)
    _write_page_plan(workspace, task, plan)
    _write_svg_roster(workspace, task, plan)
    _run_quality_check(workspace)
    _export_pptx(workspace, output_path)
    if not output_path.exists() or output_path.stat().st_size == 0:
        raise PptMasterError("PPT Master 导出完成，但没有生成有效的 PPTX 文件")
    return output_path, plan, "ppt-master"


def _ensure_workspace(task: CourseTask) -> Path:
    base = PROJECT_ROOT / "work" / "ppt_master"
    base.mkdir(parents=True, exist_ok=True)
    date_suffix = datetime.now().strftime("%Y%m%d")
    workspace = base / f"task_{task.id}_{date_suffix}"
    if not workspace.exists():
        _run(
            [
                PPT_MASTER_PYTHON,
                str(PPT_MASTER_SCRIPTS / "project_manager.py"),
                "init",
                workspace.name,
                "--dir",
                str(base),
                "--quick-generate",
            ],
            cwd=PROJECT_ROOT,
            label="初始化 PPT Master 工作区",
        )
    (workspace / "svg_output").mkdir(parents=True, exist_ok=True)
    (workspace / "analysis").mkdir(parents=True, exist_ok=True)
    (workspace / "sources").mkdir(parents=True, exist_ok=True)
    return workspace


def _write_source(workspace: Path, task: CourseTask, plan: dict[str, Any]) -> None:
    references = as_object_list(plan.get("references"))
    lines = [
        f"# {plan.get('title') or task.title}",
        "",
        f"- 授课对象：{plan.get('audience') or task.audience or '待确认'}",
        f"- 课时：{plan.get('duration_minutes') or task.duration_minutes or '待确认'} 分钟",
        "",
        "## 学习目标",
        *[f"- {item}" for item in as_string_list(plan.get("teaching_targets"))],
        "",
        "## 重点难点",
        *[f"- {item}" for item in as_string_list(plan.get("key_difficulties"))],
        "",
        "## 参考资料",
        *[
            f"- {item.get('source') or '本地知识库'}（第 {item.get('page') or '未知'} 页）"
            for item in references
        ],
    ]
    (workspace / "sources" / "lesson_plan.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


def _write_page_plan(workspace: Path, task: CourseTask, plan: dict[str, Any]) -> None:
    slides = _slide_roster(task, plan)
    payload = {
        "title": plan.get("title") or task.title,
        "canvas": {"width": CANVAS_WIDTH, "height": CANVAS_HEIGHT, "format": "ppt169"},
        "slides": [{"id": f"P{index:02d}", "title": slide["title"]} for index, slide in enumerate(slides, 1)],
    }
    (workspace / "analysis" / "page_plan.json").write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )


def _write_svg_roster(workspace: Path, task: CourseTask, plan: dict[str, Any]) -> None:
    output_dir = workspace / "svg_output"
    for path in output_dir.glob("P*.svg"):
        path.unlink()
    for index, slide in enumerate(_slide_roster(task, plan), 1):
        svg = _render_slide_svg(slide, index, len(_slide_roster(task, plan)))
        (output_dir / f"P{index:02d}.svg").write_text(svg, encoding="utf-8")


def _slide_roster(task: CourseTask, plan: dict[str, Any]) -> list[dict[str, Any]]:
    title = str(plan.get("title") or task.title)
    slides: list[dict[str, Any]] = [
        {
            "title": title,
            "bullets": [
                str(plan.get("audience") or task.audience or "授课对象待确认"),
                f"{plan.get('duration_minutes') or task.duration_minutes or '待确认'} 分钟课堂",
                "TeachNova 结构化课件生成",
            ],
            "side": "课程导入",
        },
        {"title": "学习目标", "bullets": as_string_list(plan.get("teaching_targets")), "side": "目标对齐"},
        {"title": "重点与难点", "bullets": as_string_list(plan.get("key_difficulties")), "side": "难点突破"},
    ]
    for item in as_object_list(plan.get("slides"))[:7]:
        slides.append(
            {
                "title": str(item.get("title") or "内容页"),
                "bullets": as_string_list(item.get("bullet_points")) or ["围绕本页主题展开讲解"],
                "side": str(item.get("interaction") or item.get("visual_suggestion") or "课堂讲解"),
            }
        )
    activities = as_object_list(plan.get("activities"))
    if activities:
        activity = activities[0]
        slides.append(
            {
                "title": str(activity.get("name") or "课堂互动"),
                "bullets": [
                    f"形式：{activity.get('type') or '互动活动'}",
                    str(activity.get("description") or "围绕知识点完成课堂互动任务"),
                    f"预期效果：{activity.get('expected_outcome') or '巩固核心知识'}",
                ],
                "side": "互动设计",
            }
        )
    slides.append(
        {
            "title": "总结与作业",
            "bullets": ["回顾本课重点", *as_string_list(plan.get("homework"))],
            "side": "课后巩固",
        }
    )
    return slides


def _render_slide_svg(slide: dict[str, Any], index: int, total: int) -> str:
    title = escape(str(slide["title"]))
    bullets = [str(item) for item in slide.get("bullets", [])][:6]
    side = escape(_truncate(str(slide.get("side") or "课堂讲解"), 8))
    page_role = "cover" if index == 1 else "ending" if index == total else "content"
    body = "".join(
        f'<text x="112" y="{235 + offset * 54}" '
        'style="font-family:Arial, Noto Sans CJK SC, sans-serif;font-size:24;fill:#24344D">'
        f'{escape(_truncate(item, 52))}</text>'
        for offset, item in enumerate(bullets)
    )
    markers = "".join(
        f'<circle cx="80" cy="{228 + offset * 54}" r="7" fill="#4F7CFF" />'
        for offset in range(len(bullets))
    )
    return f'''<svg xmlns="http://www.w3.org/2000/svg" lang="zh-CN" viewBox="0 0 {CANVAS_WIDTH} {CANVAS_HEIGHT}" data-pptx-page-role="{page_role}">
  <rect id="background" width="1280" height="720" fill="#F6FAFF" data-pptx-role="background" />
  <circle id="accent-circle" cx="1085" cy="128" r="150" fill="#DCECFF" data-pptx-role="decoration" />
  <rect id="side-panel" x="884" y="150" width="280" height="385" rx="28" fill="#FFFFFF" stroke="#C8DCF5" stroke-width="2" data-pptx-role="decoration" />
  <g id="brand" data-pptx-bounds="76 44 220 40"><text x="76" y="72" style="font-family:Arial,sans-serif;font-size:22;font-weight:700;fill:#3B70F6">TeachNova</text></g>
  <g id="title" data-pptx-bounds="76 105 800 75"><text x="76" y="145" style="font-family:Arial,Noto Sans CJK SC,sans-serif;font-size:40;font-weight:700;fill:#172033">{title}</text></g>
  <g id="body" data-pptx-bounds="70 195 760 360">{markers}{body}</g>
  <g id="side-content" data-pptx-bounds="920 195 220 260">
    <text x="925" y="218" style="font-family:Arial,Noto Sans CJK SC,sans-serif;font-size:20;font-weight:700;fill:#3B70F6">{side}</text>
    <line x1="925" y1="250" x2="1125" y2="250" stroke="#DBE7F4" stroke-width="2" />
    <text x="925" y="300" style="font-family:Arial,Noto Sans CJK SC,sans-serif;font-size:17;fill:#596B86">可编辑课件</text>
    <text x="925" y="336" style="font-family:Arial,Noto Sans CJK SC,sans-serif;font-size:17;fill:#596B86">保留教学意图</text>
    <text x="925" y="430" style="font-family:Arial,sans-serif;font-size:64;font-weight:700;fill:#5B83F5">AI</text>
  </g>
  <g id="footer" data-pptx-bounds="76 640 520 40"><text x="76" y="666" style="font-family:Arial,sans-serif;font-size:15;fill:#71819A">{index:02d} / {total:02d}  ·  AI 互动式教学智能体</text></g>
</svg>'''


def _truncate(value: str, limit: int) -> str:
    normalized = re.sub(r"\s+", " ", value).strip()
    return normalized if len(normalized) <= limit else normalized[: limit - 1] + "…"


def _run(command: list[str], *, cwd: Path, label: str) -> None:
    completed = subprocess.run(command, cwd=cwd, capture_output=True, text=True, timeout=180)
    if completed.returncode != 0:
        detail = (completed.stderr or completed.stdout or "unknown error").strip()[-1200:]
        raise PptMasterError(f"{label}失败：{detail}")


def _run_quality_check(workspace: Path) -> None:
    report = workspace / "validation" / "svg_quality_report.json"
    report.parent.mkdir(parents=True, exist_ok=True)
    _run(
        [
            PPT_MASTER_PYTHON,
            str(PPT_MASTER_SCRIPTS / "svg_quality_checker.py"),
            str(workspace),
            "--format",
            "ppt169",
            "--stage",
            "final",
            "--quick-generate",
            "--json",
            "--json-output",
            str(report),
        ],
        cwd=PROJECT_ROOT,
        label="PPT Master SVG 质量检查",
    )


def _export_pptx(workspace: Path, output_path: Path) -> None:
    _run(
        [
            PPT_MASTER_PYTHON,
            str(PPT_MASTER_SCRIPTS / "svg_to_pptx.py"),
            str(workspace),
            "--output",
            str(output_path),
            "--format",
            "ppt169",
            "--quick-generate",
            "--with-notes",
        ],
        cwd=PROJECT_ROOT,
        label="PPT Master 原生 PPTX 导出",
    )
