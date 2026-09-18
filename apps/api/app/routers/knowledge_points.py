from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import create_session
from app.models import KnowledgePoint, KnowledgeRelation

router = APIRouter(prefix="/api/knowledge-points", tags=["knowledge-points"])


@router.get("")
async def list_knowledge_points(
    knowledge_base_id: Optional[int] = None,
    session: AsyncSession = Depends(create_session),
):
    stmt = select(KnowledgePoint).order_by(KnowledgePoint.id)
    if knowledge_base_id is not None:
        stmt = stmt.where(KnowledgePoint.knowledge_base_id == knowledge_base_id)
    result = await session.execute(stmt.limit(500))
    items = result.scalars().all()
    return [
        {
            "id": kp.id,
            "name": kp.name,
            "slug": kp.slug,
            "description": kp.description,
            "stage": kp.stage,
            "grade": kp.grade,
            "subject": kp.subject,
            "chapter": kp.chapter,
            "difficulty": kp.difficulty,
            "importance": kp.importance,
            "knowledge_base_id": kp.knowledge_base_id,
            "document_id": kp.document_id,
        }
        for kp in items
    ]

