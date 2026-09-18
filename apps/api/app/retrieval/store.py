from __future__ import annotations

from datetime import datetime
from typing import Any, Callable, Awaitable

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.config import Settings
from app.embedding import reciprocal_rank_fusion, retrieve_bm25, retrieve_dense
from app.llm import generate_answer
from app.models import Chunk, Document, KnowledgeBase, KnowledgeBaseSummary, KnowledgePoint, RAGQuery


class Store:
    def __init__(self, settings: Settings, session_factory: async_sessionmaker | None = None) -> None:
        self.settings = settings
        self._session_factory = session_factory

    def _get_factory(self) -> async_sessionmaker:
        if self._session_factory is not None:
            return self._session_factory
        from app.database import get_session_factory
        return get_session_factory()

    async def refresh_summary(self, session: AsyncSession, knowledge_base_id: int) -> None:
        result = await session.execute(select(KnowledgeBaseSummary).where(KnowledgeBaseSummary.knowledge_base_id == knowledge_base_id))
        summary = result.scalar_one_or_none()
        if summary is None:
            summary = KnowledgeBaseSummary(knowledge_base_id=knowledge_base_id)
            session.add(summary)
            await session.flush()
        summary.document_count = int((await session.execute(select(func.count(Document.id)).where(Document.knowledge_base_id == knowledge_base_id))).scalar_one())
        summary.chunk_count = int((await session.execute(select(func.count(Chunk.id)).join(Document, Document.id == Chunk.document_id).where(Document.knowledge_base_id == knowledge_base_id))).scalar_one())
        summary.knowledge_point_count = int((await session.execute(select(func.count(KnowledgePoint.id)).where(KnowledgePoint.knowledge_base_id == knowledge_base_id))).scalar_one())
        summary.embedding_count = int((await session.execute(select(func.count(Chunk.id)).join(Document, Document.id == Chunk.document_id).where(Document.knowledge_base_id == knowledge_base_id, Chunk.embedding_status == "embedded"))).scalar_one())
        summary.updated_at = datetime.utcnow()
        await session.flush()

    async def query_rag(self, query: str, filters: dict[str, str], top_k: int, mode: str = "rag") -> dict[str, Any]:
        factory = self._get_factory()
        t0 = datetime.utcnow()
        async with factory() as sess:
            dense = await retrieve_dense(sess, query, filters, self.settings.dense_top_k)
        async with factory() as sess:
            bm25 = await retrieve_bm25(sess, query, filters, self.settings.bm25_top_k)
        fused = reciprocal_rank_fusion([dense, bm25], weights=[self.settings.dense_weight, self.settings.bm25_weight])
        final_chunks = fused[:top_k]
        citations = []
        for item in final_chunks:
            citations.append(
                {
                    "document_id": item.get("document_id"),
                    "chunk_id": item.get("chunk_id"),
                    "title": item.get("book_name") or item.get("chapter") or "文档",
                    "chapter": item.get("chapter"),
                    "page": item.get("page_start"),
                    "score": float(item.get("fusion_score") or item.get("score", 0)),
                }
            )
        llm_result = None
        if mode == "rag":
            llm_result = await generate_answer(query, final_chunks, citations)
        latency = (datetime.utcnow() - t0).total_seconds() * 1000
        async with factory() as sess:
            query_record = RAGQuery(
                query_text=query,
                filters_json=str(filters),
                dense_latency_ms=0.0,
                bm25_latency_ms=0.0,
                fusion_latency_ms=0.0,
                rerank_latency_ms=0.0,
                llm_latency_ms=float(llm_result.get("latency_ms", 0)) if llm_result else 0.0,
                total_latency_ms=latency,
                retrieved_count=len(final_chunks),
                citation_count=len(citations),
                intent=None,
            )
            sess.add(query_record)
            await sess.commit()
        return {
            "query": query,
            "filters": filters,
            "mode": mode,
            "dense": dense,
            "bm25": bm25,
            "fusion": fused,
            "reranked": final_chunks,
            "answer": llm_result.get("answer") if llm_result else None,
            "citations": citations,
            "latency_ms": latency,
        }
