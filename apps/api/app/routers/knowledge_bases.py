from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import create_session
from app.deps import StoreDep
from app.models import KnowledgeBase, KnowledgeBaseSummary

router = APIRouter(prefix="/api/knowledge-bases", tags=["knowledge-bases"])


class KnowledgeBaseCreate(BaseModel):
    name: str
    description: str | None = None
    stage: str | None = None
    subject: str | None = None


@router.get("")
async def list_knowledge_bases(session: AsyncSession = Depends(create_session)):
    result = await session.execute(select(KnowledgeBase).order_by(KnowledgeBase.id))
    items = result.scalars().all()
    return [
        {
            "id": kb.id,
            "name": kb.name,
            "description": kb.description,
            "stage": kb.stage,
            "subject": kb.subject,
            "created_at": kb.created_at.isoformat(),
        }
        for kb in items
    ]


@router.get("/{knowledge_base_id}")
async def get_knowledge_base(knowledge_base_id: int, store: StoreDep, session: AsyncSession = Depends(create_session)):
    result = await session.execute(select(KnowledgeBase).where(KnowledgeBase.id == knowledge_base_id))
    kb = result.scalar_one_or_none()
    if kb is None:
        return {"error": "not found"}
    await store.refresh_summary(session, kb.id)
    summary = (await session.execute(select(KnowledgeBaseSummary).where(KnowledgeBaseSummary.knowledge_base_id == kb.id))).scalar_one()
    return {
        "id": kb.id,
        "name": kb.name,
        "description": kb.description,
        "stage": kb.stage,
        "subject": kb.subject,
        "document_count": summary.document_count,
        "chunk_count": summary.chunk_count,
        "embedding_count": summary.embedding_count,
        "knowledge_point_count": summary.knowledge_point_count,
    }


@router.post("")
async def create_knowledge_base(body: KnowledgeBaseCreate, session: AsyncSession = Depends(create_session)):
    item = KnowledgeBase(name=body.name, description=body.description, stage=body.stage, subject=body.subject)
    session.add(item)
    await session.flush()
    return {"id": item.id, "name": item.name}
