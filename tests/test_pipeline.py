from __future__ import annotations

import pytest
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.pool import NullPool

from app.config import settings
from app.parsing import chunk_text, create_initial_page_texts, read_document
from app.embedding import build_bm25_index, compute_idf, score_bm25, reciprocal_rank_fusion, embed_texts
from app.search_indexing import token_count

TEST_DB_URL = "sqlite+aiosqlite:///:memory:"


def test_token_count():
    assert token_count(" hello world ") == 2


def test_read_document():
    text, pages, kind = read_document("apps/api/app/seed.py")
    assert len(text) > 100
    assert kind == "txt"


def test_chunking():
    text = "A " * 1000
    chunks = chunk_text(text, chunk_size=100, overlap=20)
    assert len(chunks) >= 5
    assert chunks[0] == text[:100]
    assert chunks[1] == text[80:180]
    assert create_initial_page_texts("only", ["only"]) == ["only"]


def test_bm25():
    texts = ["牛顿第二定律 物理", "小学语文教学设计", "牛顿第二定律实验"]
    corpus, doc_freq, n = build_bm25_index(texts)
    idf = compute_idf(doc_freq, n)
    scores = score_bm25(["牛顿", "第二定律"], corpus, idf)
    assert len(scores) == 3
    assert scores[2] >= scores[1]


def test_rrf():
    dense = [{"chunk_id": 1, "score": 0.9, "source": "dense"}, {"chunk_id": 2, "score": 0.8, "source": "dense"}]
    bm25 = [{"chunk_id": 2, "score": 0.95, "source": "bm25"}, {"chunk_id": 3, "score": 0.7, "source": "bm25"}]
    fused = reciprocal_rank_fusion([dense, bm25])
    ids = [item["chunk_id"] for item in fused]
    assert 2 in ids
    assert ids.index(2) == 0


@pytest.mark.asyncio()
async def test_deterministic_embeddings():
    vecs = await embed_texts(["hello", "world"])
    assert len(vecs) == 2
    assert len(vecs[0]) == settings.embedding_dimension
    assert abs(sum(x*x for x in vecs[0])**0.5 - 1.0) < 1e-6
