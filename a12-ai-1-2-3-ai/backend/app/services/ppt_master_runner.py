"""PPT generation entry point (multi-engine, see ppt_engine.py).

Kept as the stable import point for all call sites: engine selection
(presenton / pptxgenjs / svg-master) lives in ``ppt_engine.generate_pptx_auto``.
"""

from pathlib import Path
from typing import Any

from app.models.task import CourseTask
from app.services.ppt_engine import generate_pptx_auto


def generate_pptx_with_ppt_agent(task: CourseTask) -> tuple[Path, dict[str, Any], str]:
    """Generate a native PPTX with the configured engine and return its name."""
    return generate_pptx_auto(task)
