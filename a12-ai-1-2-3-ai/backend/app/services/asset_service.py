import shutil
from pathlib import Path

from sqlalchemy.orm import Session

from app.models.task import GeneratedAsset


_ASSET_TYPE_EXT = {
    "lesson_plan_json": "json",
    "lesson_plan_docx": "docx",
    "lesson_plan_pptx": "pptx",
    "lesson_plan_iteration": "json",
}


def next_asset_version(db: Session, task_id: int, asset_type: str) -> int:
    latest = (
        db.query(GeneratedAsset)
        .filter(GeneratedAsset.task_id == task_id, GeneratedAsset.asset_type == asset_type)
        .order_by(GeneratedAsset.version.desc())
        .first()
    )
    return (latest.version if latest else 0) + 1


def asset_to_frontend(asset: GeneratedAsset) -> dict[str, object]:
    path = Path(asset.file_path)
    suffix = path.suffix.lower().lstrip(".")
    asset_type = _ASSET_TYPE_EXT.get(asset.asset_type, suffix or asset.asset_type)
    return {
        "id": asset.id,
        "task_id": asset.task_id,
        "asset_type": asset_type,
        "file_path": asset.file_path,
        "file_name": path.name,
        "version": asset.version,
        "created_at": asset.created_at,
        "download_url": f"/api/assets/{asset.id}/download",
    }


def copy_versioned(path: Path, version: int) -> Path:
    versioned = path.with_name(f"{path.stem}_v{version}{path.suffix}")
    shutil.copyfile(path, versioned)
    return versioned
