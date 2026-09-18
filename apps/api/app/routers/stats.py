from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import create_session
from app.models import (
    Chunk,
    Document,
    DocumentStatus,
    KnowledgeBase,
    KnowledgePoint,
    KnowledgeRelation,
    Question,
    RAGQuery,
)

router = APIRouter(prefix="/api/stats", tags=["stats"])


@router.get("")
async def get_stats(session: AsyncSession = Depends(create_session)):
    kb_count = int((await session.execute(select(func.count(KnowledgeBase.id)))).scalar_one() or 0)
    doc_count = int((await session.execute(select(func.count(Document.id)))).scalar_one() or 0)
    chunk_count = int((await session.execute(select(func.count(Chunk.id)))).scalar_one() or 0)
    kp_count = int((await session.execute(select(func.count(KnowledgePoint.id)))).scalar_one() or 0)
    relation_count = int((await session.execute(select(func.count(KnowledgeRelation.id)))).scalar_one() or 0)
    question_count = int((await session.execute(select(func.count(Question.id)))).scalar_one() or 0)
    embedding_count = int((await session.execute(select(func.count(Chunk.id)).where(Chunk.embedding_status == "embedded"))).scalar_one() or 0)
    query_count = int((await session.execute(select(func.count(RAGQuery.id)))).scalar_one() or 0)

    # Document status breakdown
    status_rows = (await session.execute(
        select(Document.status, func.count(Document.id)).group_by(Document.status)
    )).fetchall()
    doc_status = {str(row[0]): row[1] for row in status_rows}

    # Stage distribution
    stage_rows = (await session.execute(
        select(Document.stage, func.count(Document.id)).where(Document.stage.isnot(None)).group_by(Document.stage)
    )).fetchall()
    stage_dist = {str(row[0]): row[1] for row in stage_rows}

    # Subject distribution
    subject_rows = (await session.execute(
        select(Document.subject, func.count(Document.id)).where(Document.subject.isnot(None)).group_by(Document.subject)
    )).fetchall()
    subject_dist = {str(row[0]): row[1] for row in subject_rows}

    return {
        "knowledge_bases": kb_count,
        "documents": doc_count,
        "chunks": chunk_count,
        "knowledge_points": kp_count,
        "knowledge_relations": relation_count,
        "questions": question_count,
        "embeddings": embedding_count,
        "queries": query_count,
        "document_status": doc_status,
        "stage_distribution": stage_dist,
        "subject_distribution": subject_dist,
    }

