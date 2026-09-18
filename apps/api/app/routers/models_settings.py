from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import create_session
from app.models import EmbeddingModel, LLMProvider, RerankerModel, RetrievalConfig, SystemConfig

router = APIRouter(prefix="/api/models", tags=["models"])


class LLMProviderCreate(BaseModel):
    name: str
    provider: str = "openai-compatible"
    base_url: str
    model: str
    temperature: float = 0.2
    max_tokens: int = 1600
    timeout_seconds: int = 60


class RetrievalConfigUpdate(BaseModel):
    dense_top_k: int = 20
    bm25_top_k: int = 20
    fusion_method: str = "rrf"
    dense_weight: float = 0.7
    bm25_weight: float = 0.3
    rerank_candidate_k: int = 20
    rerank_top_k: int = 5
    final_top_k: int = 5
    chunk_size: int = 900
    chunk_overlap: int = 120


@router.get("/llm")
async def list_llm_providers(session: AsyncSession = Depends(create_session)):
    result = await session.execute(select(LLMProvider).order_by(LLMProvider.id))
    items = result.scalars().all()
    return [
        {
            "id": p.id,
            "name": p.name,
            "provider": p.provider,
            "base_url": p.base_url,
            "model": p.model,
            "temperature": p.temperature,
            "max_tokens": p.max_tokens,
            "timeout_seconds": p.timeout_seconds,
        }
        for p in items
    ]


@router.post("/llm")
async def create_llm_provider(body: LLMProviderCreate, session: AsyncSession = Depends(create_session)):
    item = LLMProvider(
        name=body.name,
        provider=body.provider,
        base_url=body.base_url,
        model=body.model,
        temperature=body.temperature,
        max_tokens=body.max_tokens,
        timeout_seconds=body.timeout_seconds,
    )
    session.add(item)
    await session.flush()
    return {"id": item.id, "name": item.name}


@router.get("/embedding")
async def list_embedding_models(session: AsyncSession = Depends(create_session)):
    result = await session.execute(select(EmbeddingModel).order_by(EmbeddingModel.id))
    items = result.scalars().all()
    return [
        {
            "id": m.id,
            "provider": m.provider,
            "model_name": m.model_name,
            "dimension": m.dimension,
            "batch_size": m.batch_size,
            "normalize": m.normalize,
            "device": m.device,
            "status": m.status,
            "usage_count": m.usage_count,
            "embedding_count": m.embedding_count,
        }
        for m in items
    ]


@router.get("/reranker")
async def list_reranker_models(session: AsyncSession = Depends(create_session)):
    result = await session.execute(select(RerankerModel).order_by(RerankerModel.id))
    items = result.scalars().all()
    return [
        {
            "id": m.id,
            "provider": m.provider,
            "model_name": m.model_name,
            "status": m.status,
        }
        for m in items
    ]


@router.get("/retrieval-config")
async def get_retrieval_config(session: AsyncSession = Depends(create_session)):
    result = await session.execute(select(RetrievalConfig).where(RetrievalConfig.name == "default"))
    config = result.scalar_one_or_none()
    if config is None:
        return {
            "name": "default",
            "dense_top_k": 20,
            "bm25_top_k": 20,
            "fusion_method": "rrf",
            "dense_weight": 0.7,
            "bm25_weight": 0.3,
            "rerank_candidate_k": 20,
            "rerank_top_k": 5,
            "final_top_k": 5,
            "chunk_size": 900,
            "chunk_overlap": 120,
        }
    return {
        "name": config.name,
        "dense_top_k": config.dense_top_k,
        "bm25_top_k": config.bm25_top_k,
        "fusion_method": config.fusion_method,
        "dense_weight": config.dense_weight,
        "bm25_weight": config.bm25_weight,
        "rerank_candidate_k": config.rerank_candidate_k,
        "rerank_top_k": config.rerank_top_k,
        "final_top_k": config.final_top_k,
        "chunk_size": config.chunk_size,
        "chunk_overlap": config.chunk_overlap,
    }


@router.put("/retrieval-config")
async def update_retrieval_config(body: RetrievalConfigUpdate, session: AsyncSession = Depends(create_session)):
    result = await session.execute(select(RetrievalConfig).where(RetrievalConfig.name == "default"))
    config = result.scalar_one_or_none()
    if config is None:
        config = RetrievalConfig(name="default")
        session.add(config)
        await session.flush()
    for field, value in body.model_dump().items():
        setattr(config, field, value)
    await session.flush()
    return {"status": "ok", "name": config.name}


@router.get("/system-config")
async def list_system_config(session: AsyncSession = Depends(create_session)):
    result = await session.execute(select(SystemConfig).order_by(SystemConfig.category, SystemConfig.key))
    items = result.scalars().all()
    return [
        {
            "id": c.id,
            "category": c.category,
            "key": c.key,
            "value_text": c.value_text,
            "value_number": c.value_number,
            "description": c.description,
        }
        for c in items
    ]


class SystemConfigUpdate(BaseModel):
    category: str
    key: str
    value_text: str | None = None
    value_number: float | None = None
    description: str | None = None


@router.put("/system-config")
async def upsert_system_config(body: SystemConfigUpdate, session: AsyncSession = Depends(create_session)):
    result = await session.execute(select(SystemConfig).where(SystemConfig.key == body.key))
    config = result.scalar_one_or_none()
    if config is None:
        config = SystemConfig(category=body.category, key=body.key)
        session.add(config)
        await session.flush()
    if body.value_text is not None:
        config.value_text = body.value_text
    if body.value_number is not None:
        config.value_number = body.value_number
    if body.description is not None:
        config.description = body.description
    await session.flush()
    return {"status": "ok", "key": config.key}

