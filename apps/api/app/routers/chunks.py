from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import create_session
from app.models import Chunk, Document, KnowledgePoint, KnowledgePointChunk

router = APIRouter(prefix="/api/chunks", tags=["chunks"])


@router.get("")
async def list_chunks(
    document_id: Optional[int] = None,
    knowledge_base_id: Optional[int] = None,
    limit: int = 50,
    offset: int = 0,
    session: AsyncSession = Depends(create_session),
):
    stmt = select(Chunk).order_by(Chunk.id.desc())
    if document_id is not None:
        stmt = stmt.where(Chunk.document_id == document_id)
    elif knowledge_base_id is not None:
        stmt = stmt.join(Document, Document.id == Chunk.document_id).where(Document.knowledge_base_id == knowledge_base_id)
    total_q = select(func.count()).select_from(stmt.subquery())
    total = int((await session.execute(total_q)).scalar_one() or 0)
    result = await session.execute(stmt.offset(offset).limit(limit))
    items = result.scalars().all()
    return {
        "total": total,
        "offset": offset,
        "limit": limit,
        "items": [
            {
                "id": c.id,
                "document_id": c.document_id,
                "chunk_index": c.chunk_index,
                "content": c.content[:500],
                "token_count": c.token_count,
                "stage": c.stage,
                "grade": c.grade,
                "subject": c.subject,
                "chapter": c.chapter,
                "section": c.section,
                "page_start": c.page_start,
                "page_end": c.page_end,
                "embedding_status": c.embedding_status,
                "embedding_model": c.embedding_model,
                "created_at": c.created_at.isoformat(),
            }
            for c in items
        ],
    }


@router.get("/{chunk_id}")
async def get_chunk(chunk_id: int, session: AsyncSession = Depends(create_session)):
    result = await session.execute(select(Chunk).where(Chunk.id == chunk_id))
    chunk = result.scalar_one_or_none()
    if chunk is None:
        return {"error": "not found"}

    kp_result = await session.execute(
        select(KnowledgePoint)
        .join(KnowledgePointChunk, KnowledgePointChunk.knowledge_point_id == KnowledgePoint.id)
        .where(KnowledgePointChunk.chunk_id == chunk_id)
    )
    kps = kp_result.scalars().all()

    return {
        "id": chunk.id,
        "document_id": chunk.document_id,
        "chunk_index": chunk.chunk_index,
        "content": chunk.content,
        "token_count": chunk.token_count,
        "stage": chunk.stage,
        "grade": chunk.grade,
        "subject": chunk.subject,
        "chapter": chunk.chapter,
        "section": chunk.section,
        "page_start": chunk.page_start,
        "page_end": chunk.page_end,
        "embedding_status": chunk.embedding_status,
        "embedding_model": chunk.embedding_model,
        "knowledge_points": [{"id": kp.id, "name": kp.name} for kp in kps],
        "created_at": chunk.created_at.isoformat(),
    }

