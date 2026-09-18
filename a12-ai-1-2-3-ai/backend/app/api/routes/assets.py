from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_db
from app.models.task import GeneratedAsset
from app.services.asset_service import asset_to_frontend
from app.services.job_service import enqueue_job
from app.services.task_service import get_task_or_404

router = APIRouter()


class PptRevisionRequest(BaseModel):
    instruction: str


def _resolve_asset_path(file_path: str) -> Path:
    raw_path = Path(file_path)
    asset_path = raw_path if raw_path.is_absolute() else settings.outputs_dir / raw_path
    return asset_path.resolve()


@router.get("/tasks/{task_id}")
def list_task_assets(task_id: int, db: Session = Depends(get_db)) -> list[dict[str, object]]:
    get_task_or_404(db, task_id)
    assets = (
        db.query(GeneratedAsset)
        .filter(GeneratedAsset.task_id == task_id)
        .order_by(GeneratedAsset.created_at.desc(), GeneratedAsset.version.desc())
        .all()
    )
    return [asset_to_frontend(asset) for asset in assets]


@router.get("/{asset_id:int}/download")
def download_asset_by_id(asset_id: int, db: Session = Depends(get_db)) -> FileResponse:
    asset = db.get(GeneratedAsset, asset_id)
    if asset is None:
        raise HTTPException(status_code=404, detail="Asset not found")
    asset_path = _resolve_asset_path(asset.file_path)
    outputs_root = settings.outputs_dir.resolve()

    if outputs_root not in asset_path.parents and asset_path != outputs_root:
        raise HTTPException(status_code=400, detail="Invalid asset path")
    if not asset_path.exists() or not asset_path.is_file():
        raise HTTPException(status_code=404, detail="Asset not found")

    return FileResponse(path=Path(asset_path), filename=asset_path.name)


@router.post("/tasks/{task_id}/revise-ppt")
def revise_task_ppt(task_id: int, payload: PptRevisionRequest, db: Session = Depends(get_db)) -> dict[str, object]:
    get_task_or_404(db, task_id)
    instruction = payload.instruction.strip()
    if not instruction:
        raise HTTPException(status_code=400, detail="请填写 PPT 修改要求")
    job = enqueue_job(db, task_id, "revise_ppt", {"instruction": instruction})
    return {"job_id": job.id, "status": job.status, "job_type": job.job_type}


@router.get("/{asset_name:path}/download")
def download_asset(asset_name: str) -> FileResponse:
    asset_path = (settings.outputs_dir / asset_name).resolve()
    outputs_root = settings.outputs_dir.resolve()

    if outputs_root not in asset_path.parents and asset_path != outputs_root:
        raise HTTPException(status_code=400, detail="Invalid asset path")
    if not asset_path.exists() or not asset_path.is_file():
        raise HTTPException(status_code=404, detail="Asset not found")

    return FileResponse(path=Path(asset_path), filename=asset_path.name)
