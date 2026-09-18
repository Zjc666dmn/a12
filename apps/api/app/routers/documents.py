from __future__ import annotations

import hashlib
from datetime import datetime
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, UploadFile, File, Form
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import create_session
from app.deps import StoreDep
from app.models import Document, DocumentStatus, KnowledgeBase
from app.parsing import parse_document
from app.embedding import run_embedding

router = APIRouter(prefix="/api/documents", tags=["documents"])


def _infer(title: str, filename: str) -> dict[str, Optional[str]]:
    lower = f"{title} {filename}".lower()
    result: dict[str, Optional[str]] = {"stage": None, "grade": None, "subject": None, "book_name": None}
    if any(k in lower for k in ["高一", "高二", "高三", "高中"]):
        result["stage"] = "senior"
    if any(k in lower for k in ["七年级", "八年级", "九年级", "初中"]):
        result["stage"] = "junior"
    if any(k in lower for k in ["一年级", "二年级", "三年级", "四年级", "五年级", "六年级", "小学"]):
        result["stage"] = "elementary"
    for grade in ["高一", "高二", "高三", "七年级", "八年级", "九年级", "一年级", "二年级", "三年级", "四年级", "五年级", "六年级"]:
        if grade in lower:
            result["grade"] = grade
    for subj in ["语文", "数学", "英语", "物理", "化学", "历史", "地理", "生物", "思想政治", "信息科技", "通用技术"]:
        if subj in lower:
            result["subject"] = subj
    for seg in ["必修", "选修", "上册", "下册", "必修第一册", "必修第二册"]:
        if seg in lower:
            result["book_name"] = result.get("book_name") or f"{result.get('subject') or ''}{seg}".strip()
    return result


@router.post("")
async def upload_document(
    file: UploadFile = File(...),
    knowledge_base_id: int = Form(...),
    title: str = Form(""),
    stage: str = Form(""),
    grade: str = Form(""),
    semester: str = Form(""),
    subject: str = Form(""),
    publisher: str = Form(""),
    textbook_version: str = Form(""),
    chapter: str = Form(""),
    section: str = Form(""),
    resource_type: str = Form(""),
    source_url: str = Form(""),
    store: StoreDep = None,  # type: ignore[assignment]
    session: AsyncSession = Depends(create_session),
):
    file_bytes = await file.read()
    file_name = file.filename or "upload.txt"
    file_hash = hashlib.sha256(file_bytes).hexdigest()
    exists = (await session.execute(select(Document).where(Document.file_hash == file_hash))).scalar_one_or_none()
    if exists:
        return {"error": "duplicate", "existing_document_id": exists.id}
    kb = (await session.execute(select(KnowledgeBase).where(KnowledgeBase.id == knowledge_base_id))).scalar_one_or_none()
    if kb is None:
        return {"error": "knowledge_base_not_found"}
    dest_dir = Path(settings.upload_dir) / str(knowledge_base_id)
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest_path = dest_dir / file_name
    dest_path.write_bytes(file_bytes)
    auto = _infer(title, file_name)
    doc = Document(
        knowledge_base_id=knowledge_base_id,
        title=title or Path(file_name).stem,
        file_name=str(dest_path),
        file_type=Path(file_name).suffix.lstrip(".").lower() or "txt",
        file_size=len(file_bytes),
        file_hash=file_hash,
        content_hash=file_hash,
        source_type="uploaded_file",
        license_status="user_uploaded",
        source_url=source_url or None,
        stage=stage or auto.get("stage") or None,
        grade=grade or auto.get("grade") or None,
        semester=semester or None,
        subject=subject or auto.get("subject") or None,
        publisher=publisher or None,
        textbook_version=textbook_version or None,
        book_name=auto.get("book_name"),
        chapter=chapter or None,
        section=section or None,
        resource_type=resource_type or None,
        status=DocumentStatus.uploaded,
    )
    session.add(doc)
    await session.flush()
    await parse_document(session, doc)
    await run_embedding(session, doc.id)
    await store.refresh_summary(session, knowledge_base_id)
    return {"id": doc.id, "status": doc.status.value, "chunks": len(doc.chunks)}


@router.get("")
async def list_documents(knowledge_base_id: Optional[int] = None, session: AsyncSession = Depends(create_session)):
    stmt = select(Document).order_by(Document.id.desc())
    if knowledge_base_id is not None:
        stmt = stmt.where(Document.knowledge_base_id == knowledge_base_id)
    result = await session.execute(stmt)
    items = result.scalars().all()
    return [
        {
            "id": doc.id,
            "knowledge_base_id": doc.knowledge_base_id,
            "title": doc.title,
            "file_name": doc.file_name,
            "file_type": doc.file_type,
            "stage": doc.stage,
            "grade": doc.grade,
            "semester": doc.semester,
            "subject": doc.subject,
            "publisher": doc.publisher,
            "chapter": doc.chapter,
            "section": doc.section,
            "status": doc.status.value,
            "created_at": doc.created_at.isoformat(),
        }
        for doc in items
    ]
