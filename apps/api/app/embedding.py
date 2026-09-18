from __future__ import annotations

import hashlib
import json
import math
from collections import defaultdict
from datetime import datetime
from typing import Iterable

import httpx
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models import Chunk, EmbeddingModel

_BM25_VOCAB_CACHE: dict[str, float] = {}


def _stable_token(text: str, token: str) -> str:
    return hashlib.sha256(f"{text}||{token}".encode("utf-8")).hexdigest()


def _tokenize(text: str) -> list[str]:
    return [t for t in text.lower().split() if t.strip()]


def _cosine_similarity(a: list[float], b: list[float]) -> float:
    denom = (sum(x * x for x in a) ** 0.5) * (sum(y * y for y in b) ** 0.5)
    if denom == 0:
        return 0.0
    return sum(x * y for x, y in zip(a, b)) / denom


async def _openai_embeddings(texts: list[str]) -> list[list[float]]:
    batch_size = max(1, settings.embedding_batch_size)
    vectors: list[list[float]] = []
    async with httpx.AsyncClient(timeout=settings.llm_timeout_seconds) as client:
        for idx in range(0, len(texts), batch_size):
            batch = texts[idx : idx + batch_size]
            payload: dict[str, object] = {
                "model": settings.embedding_model,
                "input": batch,
            }
            response = await client.post(
                f"{settings.embedding_api_base.rstrip('/')}/embeddings",
                json=payload,
                headers={
                    "Authorization": f"Bearer {settings.embedding_api_key}",
                    "Content-Type": "application/json",
                },
            )
            response.raise_for_status()
            data = response.json()["data"]
            data.sort(key=lambda item: item["index"])
            vectors.extend(item["embedding"] for item in data)
    return vectors


def _deterministic_embeddings(texts: list[str], dimension: int) -> list[list[float]]:
    vectors: list[list[float]] = []
    for text in texts:
        digest = hashlib.sha512(text.encode("utf-8")).hexdigest()
        values: list[float] = []
        for i in range(0, min(len(digest), dimension * 8), 8):
            byte_group = digest[i : i + 8]
            if not byte_group:
                break
            values.append(int(byte_group, 16) / 0xFFFFFFFFFFFFFFFF * 2 - 1)
        if len(values) < dimension:
            values.extend([0.0] * (dimension - len(values)))
        values = values[:dimension]
        if settings.embedding_normalize:
            length = math.sqrt(sum(v * v for v in values)) or 1.0
            values = [v / length for v in values]
        vectors.append(values)
    return vectors


async def embed_texts(texts: list[str]) -> list[list[float]]:
    if not texts:
        return []
    if settings.embedding_provider == "openai-compatible" and settings.embedding_api_key:
        return await _openai_embeddings(texts)
    return _deterministic_embeddings(texts, settings.embedding_dimension)


async def _get_or_create_active_model(session: AsyncSession) -> EmbeddingModel:
    name = f"{settings.embedding_provider}/{settings.embedding_model}"
    result = await session.execute(select(EmbeddingModel).where(EmbeddingModel.model_name == name))
    model = result.scalar_one_or_none()
    if model is None:
        model = EmbeddingModel(
            provider=settings.embedding_provider,
            model_name=name,
            dimension=settings.embedding_dimension,
            batch_size=settings.embedding_batch_size,
            normalize=settings.embedding_normalize,
            device=settings.embedding_device,
            status="active",
            api_base=settings.embedding_api_base,
            api_key_hint=(settings.embedding_api_key[:4] + "***") if settings.embedding_api_key else None,
        )
        session.add(model)
        await session.flush()
    model.usage_count += 1
    model.last_used_at = datetime.utcnow()
    await session.flush()
    return model


async def run_embedding(session: AsyncSession, document_id: int) -> dict[str, int]:
    model = await _get_or_create_active_model(session)
    result = await session.execute(select(Chunk).where(Chunk.document_id == document_id))
    chunks = list(result.scalars().all())
    if not chunks:
        return {"total": 0, "embedded": 0, "ignored": 0}

    batch_size = max(1, settings.embedding_batch_size)
    embedded = 0
    ignored = 0
    for idx in range(0, len(chunks), batch_size):
        batch = chunks[idx : idx + batch_size]
        texts = [c.content for c in batch]
        if not any(t.strip() for t in texts):
            ignored += len(batch)
            continue
        embeddings = await embed_texts(texts)
        for chunk, embedding in zip(batch, embeddings):
            embedding_json = json.dumps(embedding, ensure_ascii=False)
            chunk.embedding_model = model.model_name
            chunk.embedding_status = "embedded"
            chunk.embedding_count = 1
            chunk.embedding_text_hash = hashlib.sha256(chunk.content.encode("utf-8")).hexdigest()
            model.embedding_count += 1
        embedded += len(batch)
        await session.flush()
    return {"total": len(chunks), "embedded": embedded, "ignored": ignored}


def build_bm25_index(texts: list[str]) -> tuple[list[list[str]], dict[str, float], int]:
    tokenized_corpus = [_tokenize(text) for text in texts]
    doc_freq: dict[str, int] = defaultdict(int)
    for tokens in tokenized_corpus:
        for unique_token in set(tokens):
            doc_freq[unique_token] += 1
    return tokenized_corpus, doc_freq, len(texts)


def compute_idf(doc_freq: dict[str, float], corpus_size: int) -> dict[str, float]:
    idf: dict[str, float] = {}
    for term, freq in doc_freq.items():
        idf[term] = math.log((corpus_size - freq + 0.5) / (freq + 0.5) + 1.0)
    return idf


def score_bm25(
    query_tokens: list[str],
    tokenized_corpus: list[list[str]],
    idf: dict[str, float],
    k1: float = 1.2,
    b: float = 0.75,
) -> list[float]:
    scores: list[float] = []
    avg_dl = (sum(len(doc) for doc in tokenized_corpus) / max(1, len(tokenized_corpus))) if tokenized_corpus else 1.0
    for doc in tokenized_corpus:
        dl = len(doc)
        tf_map: dict[str, int] = defaultdict(int)
        for t in doc:
            tf_map[t] += 1
        score = 0.0
        for qt in query_tokens:
            if qt not in idf:
                continue
            term_tf = tf_map.get(qt, 0)
            numerator = term_tf * (k1 + 1)
            denominator = term_tf + k1 * (1 - b + b * (dl / max(1.0, avg_dl)))
            score += idf[qt] * (numerator / max(1e-9, denominator))
        scores.append(score)
    return scores


async def retrieve_bm25(session: AsyncSession, query: str, filters: dict[str, str], top_k: int) -> list[dict[str, object]]:
    where = []
    if filters.get("stage"):
        where.append(Chunk.stage == filters["stage"])
    if filters.get("grade"):
        where.append(Chunk.grade == filters["grade"])
    if filters.get("semester"):
        where.append(Chunk.semester == filters["semester"])
    if filters.get("subject"):
        where.append(Chunk.subject == filters["subject"])
    if filters.get("publisher"):
        where.append(Chunk.publisher == filters["publisher"])
    if filters.get("book_name"):
        where.append(Chunk.book_name == filters["book_name"])
    if filters.get("chapter"):
        where.append(Chunk.chapter == filters["chapter"])
    result = await session.execute(select(Chunk.id, Chunk.content, Chunk.chunk_index, Chunk.document_id, Chunk.page_start, Chunk.page_end, Chunk.chapter, Chunk.section, Chunk.grade, Chunk.subject, Chunk.publisher, Chunk.book_name).where(*where).limit(5000))
    rows = result.fetchall()
    if not rows:
        return []
    texts = [str(r[1]) for r in rows]
    tokenized_corpus, doc_freq, corpus_size = build_bm25_index(texts)
    idf = compute_idf(doc_freq, corpus_size)
    query_tokens = _tokenize(query)
    scores = score_bm25(query_tokens, tokenized_corpus, idf)
    ranked = sorted(range(len(rows)), key=lambda i: scores[i], reverse=True)[:top_k]
    return [
        {
            "chunk_id": rows[i][0],
            "content": rows[i][1],
            "chunk_index": rows[i][2],
            "document_id": rows[i][3],
            "page_start": rows[i][4],
            "page_end": rows[i][5],
            "chapter": rows[i][6],
            "section": rows[i][7],
            "grade": rows[i][8],
            "subject": rows[i][9],
            "publisher": rows[i][10],
            "book_name": rows[i][11],
            "score": float(scores[i]),
            "source": "bm25",
        }
        for i in ranked
        if scores[i] > 0
    ]


async def retrieve_dense(session: AsyncSession, query: str, filters: dict[str, str], top_k: int) -> list[dict[str, object]]:
    where = []
    if filters.get("stage"):
        where.append(Chunk.stage == filters["stage"])
    if filters.get("grade"):
        where.append(Chunk.grade == filters["grade"])
    if filters.get("semester"):
        where.append(Chunk.semester == filters["semester"])
    if filters.get("subject"):
        where.append(Chunk.subject == filters["subject"])
    if filters.get("publisher"):
        where.append(Chunk.publisher == filters["publisher"])
    if filters.get("book_name"):
        where.append(Chunk.book_name == filters["book_name"])
    if filters.get("chapter"):
        where.append(Chunk.chapter == filters["chapter"])
    result = await session.execute(select(Chunk).where(*where).limit(5000))
    chunks = list(result.scalars().all())
    if not chunks:
        return []
    query_embedding = (await embed_texts([query]))[0]
    candidate_embeddings = await embed_texts([c.content for c in chunks])
    scored: list[dict[str, object]] = []
    for chunk, cand_emb in zip(chunks, candidate_embeddings):
        score = _cosine_similarity(query_embedding, cand_emb)
        scored.append(
            {
                "chunk_id": chunk.id,
                "content": chunk.content,
                "chunk_index": chunk.chunk_index,
                "document_id": chunk.document_id,
                "page_start": chunk.page_start,
                "page_end": chunk.page_end,
                "chapter": chunk.chapter,
                "section": chunk.section,
                "grade": chunk.grade,
                "subject": chunk.subject,
                "publisher": chunk.publisher,
                "book_name": chunk.book_name,
                "score": float(score),
                "source": "dense",
            }
        )
    return sorted(scored, key=lambda item: float(item["score"]), reverse=True)[:top_k]


def reciprocal_rank_fusion(result_lists: list[list[dict[str, object]]], k: int = 60, weights: list[float] | None = None) -> list[dict[str, object]]:
    aggregated: dict[int, dict[str, object]] = {}
    effective_weights = weights if weights and len(weights) == len(result_lists) else [1.0 for _ in result_lists]
    for weight, result_list in zip(effective_weights, result_lists):
        for rank, item in enumerate(result_list, start=1):
            chunk_id = int(item["chunk_id"])
            if chunk_id not in aggregated:
                aggregated[chunk_id] = dict(item)
                aggregated[chunk_id]["fusion_score"] = 0.0
            aggregated[chunk_id]["fusion_score"] = float(aggregated[chunk_id]["fusion_score"]) + (weight / (k + rank))
    return sorted(aggregated.values(), key=lambda item: float(item["fusion_score"]), reverse=True)
