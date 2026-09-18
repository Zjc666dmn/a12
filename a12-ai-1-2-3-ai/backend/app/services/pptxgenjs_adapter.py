"""PptxGenJS engine adapter ("second engine", per 落地方案 §11).

Renders the lesson-plan slide roster into a **native, fully editable** PPTX
through the vendored PptxGenJS (backend/tools/pptxgenjs). Template JSON files
(backend/tools/pptxgenjs/templates/<id>/template.json) decide colors, fonts
and layout metrics (落地方案 §12).

Fully offline and deterministic: no LLM, no external service required.
"""

from __future__ import annotations

import json
import logging
import shutil
import subprocess
from pathlib import Path
from typing import Any

from app.core.config import PROJECT_ROOT, settings
from app.models.task import CourseTask
from app.services.lesson_plan_service import load_or_create_lesson_plan
from app.services.ppt_master_adapter import PptMasterError, _slide_roster

logger = logging.getLogger(__name__)

RENDERER_JS = PROJECT_ROOT / "backend" / "tools" / "pptxgenjs" / "render_pptx.js"


class PptxGenJSError(RuntimeError):
    """Raised when the PptxGenJS route cannot complete."""


def _node_binary() -> str:
    for candidate in (
        settings.pptxgenjs_node_bin,
        shutil.which("node"),
        "/Users/huanglinhao/.workbuddy/binaries/node/versions/22.22.2-3/bin/node",
        "/usr/local/bin/node",
    ):
        if candidate and Path(candidate).exists():
            return candidate
        if candidate and "/" not in candidate:
            return candidate
    raise PptxGenJSError("未找到可用的 Node.js 运行时，无法使用 PptxGenJS 引擎")


def _pages_from_deck(task: CourseTask, plan: dict[str, Any]) -> list[dict[str, Any]] | None:
    """优先使用工作台的 deck 作为渲染源。

    deck 是工作台里可编辑、可被 AI 充实过的课件源，包含真实的学科内容、
    教师话术、互动设计和页面类型；比 lesson plan 的 roaster 更充实。
    若 deck 仍是大纲套话，则用知识库 + LLM 扩写一次（只做一次，之后复用）。
    """
    try:
        from app.services.ppt_deck_service import (
            ROLE_OF_TYPE,
            deck_quality,
            enrich_deck,
            ensure_deck,
        )
    except Exception:  # noqa: BLE001
        return None

    try:
        deck = ensure_deck(task)
    except Exception:  # noqa: BLE001
        return None

    if deck_quality(deck).get("needsEnrich"):
        try:
            enrich_deck(task, deck)
            deck = ensure_deck(task)
        except Exception as exc:  # noqa: BLE001 - 扩写失败时退回 roster
            logger.warning("deck enrich failed, fallback to roster: %s", exc)

    pages = [page for page in deck.get("pages", []) if isinstance(page, dict)]
    if len(pages) < 3:
        return None

    total = len(pages)
    job_pages: list[dict[str, Any]] = []
    for index, page in enumerate(pages):
        page_type = str(page.get("type") or "content")
        if index == 0:
            role = "cover"
        elif index == total - 1:
            role = "ending"
        else:
            role = ROLE_OF_TYPE.get(page_type, "content")
        job_page: dict[str, Any] = {
            "role": role,
            "layout": str(page.get("layout") or ""),
            "title": str(page.get("title") or ""),
            "bullets": [str(b) for b in page.get("bullets", [])][:8],
            "side": str(page.get("side") or ""),
            "sideNote": str(page.get("notes") or ""),
            "section": str(page.get("section") or ""),
            "interaction": str(page.get("interaction") or ""),
            "visual": str(page.get("visual") or ""),
        }
        # 结构化版式数据（原生图表 / 对比表 / 辨析）透传给渲染器
        for key in ("chart", "table", "compare"):
            value = page.get(key)
            if isinstance(value, dict) and value:
                job_page[key] = value
        job_pages.append(job_page)
    return job_pages


def generate_with_pptxgenjs(task: CourseTask) -> tuple[Path, dict[str, Any], str]:
    plan = load_or_create_lesson_plan(task)

    pages = _pages_from_deck(task, plan)
    source = "deck"
    if not pages:
        roster = _slide_roster(task, plan)
        total = len(roster)
        source = "roster"
        pages = []
        for index, slide in enumerate(roster, 1):
            role = "cover" if index == 1 else "ending" if index == total else "content"
            pages.append(
                {
                    "role": role,
                    "title": slide.get("title") or task.title,
                    "bullets": [str(b) for b in slide.get("bullets", [])],
                    "side": slide.get("side") or "",
                }
            )

    template_id = settings.ppt_template
    if source == "deck":
        try:
            from app.services.ppt_deck_service import ensure_deck

            template_id = ensure_deck(task).get("templateId") or settings.ppt_template
        except Exception:  # noqa: BLE001
            pass

    job = {
        "outputPath": str(settings.outputs_dir / "ppt" / f"lesson_slides_task_{task.id}.pptx"),
        "templateId": template_id,
        "title": str(plan.get("title") or task.title),
        "subject": getattr(task, "subject", None) or "",
        "audience": getattr(task, "audience", None) or "",
        "pages": pages,
    }

    process = subprocess.run(
        [_node_binary(), str(RENDERER_JS)],
        input=json.dumps(job, ensure_ascii=False).encode("utf-8"),
        capture_output=True,
        timeout=settings.pptxgenjs_timeout_seconds,
    )
    if process.returncode != 0:
        raise PptxGenJSError(f"PptxGenJS 渲染失败: {process.stderr.decode('utf-8', 'ignore')[:300]}")

    output_path = Path(job["outputPath"])
    if not output_path.exists() or output_path.stat().st_size == 0:
        raise PptxGenJSError("PptxGenJS 渲染完成，但没有生成有效的 PPTX 文件")
    return output_path, plan, "pptxgenjs"
