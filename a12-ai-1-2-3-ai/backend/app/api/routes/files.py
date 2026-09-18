import json
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_db
from app.models.task import CourseTask, UploadedFile
from app.schemas.files import FileRead, ParsedFileRead
from app.services.chunk_service import build_chunks_for_file
from app.services.document_parser import parse_document

router = APIRouter()

ALLOWED_EXTENSIONS = {".pdf", ".doc", ".docx", ".pptx", ".png", ".jpg", ".jpeg", ".webp", ".mp4", ".mov", ".webm"}
ALLOWED_CONTENT_TYPES = {
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "image/png",
    "image/jpeg",
    "image/webp",
    "video/mp4",
    "video/quicktime",
    "video/webm",
}


def _validate_upload_file(file: UploadFile) -> str:
    if not file.filename:
        raise HTTPException(status_code=400, detail="Filename is required")

    filename = Path(file.filename).name
    extension = Path(filename).suffix.lower()
    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="支持 PDF、Word、PPT、PNG/JPG/WebP 图片和 MP4/MOV/WebM 视频")

    content_type = file.content_type or "application/octet-stream"
    if content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(status_code=400, detail="文件类型不受支持，请上传教学文档、图片或视频")

    return filename


def _save_upload_file(file: UploadFile, destination: Path) -> int:
    size = 0
    with destination.open("wb") as buffer:
        while chunk := file.file.read(1024 * 1024):
            size += len(chunk)
            buffer.write(chunk)
    return size


@router.post("/tasks/{task_id}", response_model=FileRead)
def upload_task_file(
    task_id: int,
    file: UploadFile = File(...),
    purpose: str = Form("content"),
    focus: str = Form(""),
    db: Session = Depends(get_db),
) -> FileRead:
    task = db.get(CourseTask, task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")

    filename = _validate_upload_file(file)
    if purpose not in {"content", "style", "case", "activity"}:
        raise HTTPException(status_code=422, detail="不支持的资料用途")

    task_dir = settings.uploads_dir / str(task_id)
    task_dir.mkdir(parents=True, exist_ok=True)
    destination = task_dir / filename

    _save_upload_file(file, destination)

    record = UploadedFile(
        task_id=task_id,
        file_name=filename,
        file_type=file.content_type or "application/octet-stream",
        file_path=str(destination),
        purpose=purpose,
        focus=focus.strip()[:500] or None,
        parse_status="pending",
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return FileRead.model_validate(record)


@router.get("/tasks/{task_id}", response_model=list[FileRead])
def list_task_files(task_id: int, db: Session = Depends(get_db)) -> list[FileRead]:
    task = db.get(CourseTask, task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")

    records = (
        db.query(UploadedFile)
        .filter(UploadedFile.task_id == task_id)
        .order_by(UploadedFile.created_at.desc())
        .all()
    )
    return [FileRead.model_validate(record) for record in records]


@router.post("/{file_id}/parse", response_model=FileRead)
def parse_file(file_id: int, db: Session = Depends(get_db)) -> FileRead:
    record = db.get(UploadedFile, file_id)
    if record is None:
        raise HTTPException(status_code=404, detail="File not found")

    record.parse_status = "parsing"
    db.commit()

    try:
        parsed = parse_document(record.file_path, record.file_type)
    except Exception as error:
        record.parse_status = "failed"
        record.parsed_content = str(error)
        db.commit()
        db.refresh(record)
        raise HTTPException(status_code=400, detail=str(error)) from error

    settings.parsed_dir.mkdir(parents=True, exist_ok=True)
    parsed_path = settings.parsed_dir / f"{record.id}.json"
    parsed_path.write_text(json.dumps(parsed, ensure_ascii=False, indent=2), encoding="utf-8")
    build_chunks_for_file(record.id, parsed=parsed)

    record.parse_status = "ready"
    record.parsed_content = parsed.get("text", "")
    db.commit()
    db.refresh(record)
    return FileRead.model_validate(record)


@router.get("/{file_id}/parsed", response_model=ParsedFileRead)
def get_parsed_file(file_id: int, db: Session = Depends(get_db)) -> ParsedFileRead:
    record = db.get(UploadedFile, file_id)
    if record is None:
        raise HTTPException(status_code=404, detail="File not found")
    if record.parse_status != "ready":
        raise HTTPException(status_code=400, detail="文件尚未解析完成")

    parsed_path = settings.parsed_dir / f"{file_id}.json"
    if not parsed_path.exists():
        raise HTTPException(status_code=404, detail="Parsed file not found")

    parsed = json.loads(parsed_path.read_text(encoding="utf-8"))
    return ParsedFileRead(
        file_id=file_id,
        title=parsed.get("title") or record.file_name,
        file_type=parsed.get("file_type") or record.file_type,
        text=parsed.get("text") or "",
        markdown=parsed.get("markdown"),
        metadata=parsed.get("metadata") or {},
    )


@router.delete("/{file_id}")
def delete_file(file_id: int, db: Session = Depends(get_db)) -> dict[str, str]:
    record = db.get(UploadedFile, file_id)
    if record is None:
        raise HTTPException(status_code=404, detail="File not found")
    file_path = Path(record.file_path)
    if file_path.exists() and file_path.is_file():
        file_path.unlink()
    db.delete(record)
    db.commit()
    return {"status": "deleted"}
