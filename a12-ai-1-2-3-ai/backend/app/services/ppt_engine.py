"""PPT engine orchestration (per 落地方案 第四阶段).

Selection order for ``ppt_engine = "auto"``:

1. **presenton**  — self-hosted Presenton (AI PPT, templates, PDF export) when
   the service is reachable;
2. **pptxgenjs**  — TeachNova's own PptxGenJS renderer (native editable PPTX,
   template JSON driven, fully offline);
3. **svg_master** — the legacy PPT Master SVG pipeline (kept as a safety net).

``ppt_engine`` may also be pinned to a single engine via .env.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any, Callable

from app.core.config import settings
from app.models.task import CourseTask
from app.services.ppt_master_adapter import PptMasterError, generate_with_ppt_master
from app.services.presenton_adapter import PresentonError, generate_with_presenton, presenton_reachable
from app.services.pptxgenjs_adapter import PptxGenJSError, generate_with_pptxgenjs

logger = logging.getLogger(__name__)

ENGINE_ORDER = ("presenton", "pptxgenjs", "svg_master")
ENGINES: dict[str, Callable[[CourseTask], tuple[Path, dict[str, Any], str]]] = {
    "presenton": generate_with_presenton,
    "pptxgenjs": generate_with_pptxgenjs,
    "svg_master": generate_with_ppt_master,
}


def generate_pptx_auto(task: CourseTask) -> tuple[Path, dict[str, Any], str]:
    """Generate a PPTX with the configured engine, degrading gracefully."""
    chosen = (settings.ppt_engine or "auto").strip().lower()

    if chosen != "auto":
        engine = ENGINES.get(chosen)
        if engine is None:
            raise ValueError(f"未知 PPT 引擎: {chosen}（可选: auto/{'/'.join(ENGINE_ORDER)}）")
        return engine(task)

    errors: list[str] = []
    for name in ENGINE_ORDER:
        if name == "presenton" and not presenton_reachable():
            errors.append("presenton: 服务不可达")
            continue
        try:
            result = ENGINES[name](task)
            logger.info("PPT generated with engine=%s", name)
            return result
        except Exception as exc:  # noqa: BLE001 - try the next engine
            errors.append(f"{name}: {exc}")
            logger.warning("PPT engine %s failed, degrading: %s", name, exc)
    raise RuntimeError("所有 PPT 引擎均失败 → " + " | ".join(errors))
