"""Presenton engine adapter (per 落地方案 §9-§10: "PPT 不要自己从零造").

Calls a self-hosted Presenton instance (servers/fastapi, Apache-2.0) through
its documented v1 API::

    POST {base}/api/v1/ppt/presentation/generate
    body: {content, slides_markdown, n_slides, template, language, export_as}
    resp: {presentation_id, path, edit_path}

The slide content still comes from TeachNova's lesson plan (slides_markdown is
provided directly, so Presenton's LLM step is bypassed for structure); the
response ``path`` points to a PPTX inside Presenton's workspace, which is
copied into TeachNova's outputs. Any failure degrades to the next engine.
"""

from __future__ import annotations

import logging
import shutil
import time
from pathlib import Path
from typing import Any

import httpx

from app.core.config import settings
from app.models.task import CourseTask
from app.services.lesson_plan_service import load_or_create_lesson_plan
from app.services.ppt_master_adapter import _slide_roster

logger = logging.getLogger(__name__)

API_PREFIX = "/api/v1/ppt/presentation"


class PresentonError(RuntimeError):
    """Raised when the Presenton route cannot complete."""


def presenton_reachable() -> bool:
    """Cheap probe used by the auto engine selector.

    Must hit a real Presenton API path so unrelated services on the same
    port do not produce false positives.
    """
    try:
        resp = httpx.get(
            f"{settings.presenton_base_url.rstrip('/')}{API_PREFIX}/all",
            timeout=settings.presenton_probe_timeout_seconds,
        )
        return resp.status_code == 200
    except Exception:  # noqa: BLE001 - probing must never raise
        return False


def _slides_markdown(task: CourseTask, plan: dict[str, Any]) -> list[str]:
    roster = _slide_roster(task, plan)
    pages: list[str] = []
    for slide in roster:
        lines = [f"# {slide.get('title') or task.title}"]
        lines.extend(f"- {bullet}" for bullet in slide.get("bullets", []))
        if slide.get("side"):
            lines.append(f"\n> {slide['side']}")
        pages.append("\n".join(str(line) for line in lines))
    return pages


def generate_with_presenton(task: CourseTask) -> tuple[Path, dict[str, Any], str]:
    plan = load_or_create_lesson_plan(task)
    markdown = _slides_markdown(task, plan)
    title = str(plan.get("title") or task.title)

    payload = {
        "content": f"{title}。学科：{getattr(task, 'subject', '') or '综合'}；"
        f"对象：{getattr(task, 'audience', '') or '中学生'}；"
        f"课时：{getattr(task, 'duration_minutes', '') or 45} 分钟。",
        "slides_markdown": markdown,
        "n_slides": len(markdown),
        "language": "中文",
        "template": settings.presenton_template,
        "export_as": "pptx",
    }

    try:
        resp = httpx.post(
            f"{settings.presenton_base_url.rstrip('/')}{API_PREFIX}/generate",
            json=payload,
            timeout=settings.presenton_timeout_seconds,
        )
        resp.raise_for_status()
        data = resp.json()
    except Exception as exc:  # noqa: BLE001 - degrade to next engine
        raise PresentonError(f"Presenton 生成请求失败: {exc}") from exc

    remote_path = data.get("path")
    if not remote_path:
        raise PresentonError(f"Presenton 返回缺少 path 字段: {list(data)}")

    # 容器内路径 → 宿主机路径映射（docker-compose 挂载 workspace 时）
    local = Path(settings.presenton_workspace_map + remote_path if settings.presenton_workspace_map else remote_path)
    deadline = time.time() + 30
    while not local.exists() and time.time() < deadline:
        time.sleep(0.5)
    if not local.exists():
        raise PresentonError(f"Presenton 产物不存在: {remote_path}")

    output_dir = settings.outputs_dir / "ppt"
    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = output_dir / f"lesson_slides_task_{task.id}.pptx"
    shutil.copyfile(local, output_path)
    return output_path, plan, "presenton"
