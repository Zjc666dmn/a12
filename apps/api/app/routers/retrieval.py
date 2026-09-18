from __future__ import annotations

from typing import Optional

from fastapi import APIRouter
from pydantic import BaseModel

from app.deps import StoreDep

router = APIRouter(prefix="/api/rag", tags=["retrieval"])


class RetrievalRequest(BaseModel):
    query: str
    mode: str = "rag"
    stage: str | None = None
    grade: str | None = None
    subject: str | None = None
    publisher: str | None = None
    book_name: str | None = None
    chapter: str | None = None
    top_k: int = 5


@router.post("/search")
async def search(body: RetrievalRequest, store: StoreDep):
    filters = {k: v for k, v in body.model_dump().items() if k in {"stage", "grade", "subject", "publisher", "book_name", "chapter"} and v}
    result = await store.query_rag(query=body.query, filters=filters, top_k=body.top_k, mode="search")
    return result


@router.post("/query")
async def query(body: RetrievalRequest, store: StoreDep):
    filters = {k: v for k, v in body.model_dump().items() if k in {"stage", "grade", "subject", "publisher", "book_name", "chapter"} and v}
    result = await store.query_rag(query=body.query, filters=filters, top_k=body.top_k, mode="rag")
    return result


@router.post("/debug")
async def debug(body: RetrievalRequest, store: StoreDep):
    filters = {k: v for k, v in body.model_dump().items() if k in {"stage", "grade", "subject", "publisher", "book_name", "chapter"} and v}
    return await store.query_rag(query=body.query, filters=filters, top_k=body.top_k, mode="rag")
