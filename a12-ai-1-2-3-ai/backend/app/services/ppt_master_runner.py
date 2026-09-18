"""PPT generation entry point backed by the local PPT Master workflow."""

from pathlib import Path
from typing import Any

from app.models.task import CourseTask
from app.services.ppt_master_adapter import generate_with_ppt_master


def generate_pptx_with_ppt_agent(task: CourseTask) -> tuple[Path, dict[str, Any], str]:
    """Generate a native PPTX through PPT Master and return its engine name."""
    return generate_with_ppt_master(task)
