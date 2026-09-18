from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import create_session
from app.models import KnowledgeBase, KnowledgePoint, KnowledgeRelation

router = APIRouter(prefix="/api/knowledge-graph", tags=["knowledge-graph"])


@router.get("/nodes")
async def get_nodes(
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
            "description": kp.description,
            "stage": kp.stage,
            "grade": kp.grade,
            "subject": kp.subject,
            "chapter": kp.chapter,
            "difficulty": kp.difficulty,
            "importance": kp.importance,
            "knowledge_base_id": kp.knowledge_base_id,
        }
        for kp in items
    ]


@router.get("/edges")
async def get_edges(
    knowledge_base_id: Optional[int] = None,
    session: AsyncSession = Depends(create_session),
):
    stmt = (
        select(KnowledgeRelation)
        .order_by(KnowledgeRelation.id)
    )
    if knowledge_base_id is not None:
        stmt = (
            stmt.join(KnowledgePoint, KnowledgePoint.id == KnowledgeRelation.from_knowledge_point_id)
            .where(KnowledgePoint.knowledge_base_id == knowledge_base_id)
        )
    result = await session.execute(stmt.limit(500))
    items = result.scalars().all()
    return [
        {
            "id": r.id,
            "from": r.from_knowledge_point_id,
            "to": r.to_knowledge_point_id,
            "relation_type": r.relation_type.value,
            "confidence": r.confidence,
        }
        for r in items
    ]

