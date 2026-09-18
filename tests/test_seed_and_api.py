from __future__ import annotations

import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy.pool import NullPool

from app.database import Base
from app.main import app
from app.seed import _seed
from app.config import settings
from app.retrieval.store import Store

TEST_DB_URL = "sqlite+aiosqlite:///:memory:"
test_engine = create_async_engine(TEST_DB_URL, connect_args={"check_same_thread": False}, poolclass=NullPool)
test_factory = async_sessionmaker(test_engine, expire_on_commit=False)


@pytest.fixture(autouse=True)
async def _setup_test_db():
    import app.database as dbmod
    # Reset lazy singletons
    dbmod._engine = test_engine
    dbmod._session_factory = test_factory

    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with test_factory() as session:
        await _seed(session)
        await session.commit()
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    dbmod._engine = None
    dbmod._session_factory = None


@pytest.mark.asyncio()
async def test_health():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"


@pytest.mark.asyncio()
async def test_knowledge_bases():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        kbs = (await client.get("/api/knowledge-bases")).json()
        assert len(kbs) >= 6


@pytest.mark.asyncio()
async def test_rag_search():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        search = await client.post("/api/rag/search", json={"query": "牛顿第二定律", "top_k": 3})
        assert search.status_code == 200
        data = search.json()
        assert len(data["reranked"]) >= 1


@pytest.mark.asyncio()
async def test_rag_query():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        query = await client.post("/api/rag/query", json={"query": "如何给初二学生讲解一次函数", "stage": "junior", "subject": "数学"})
        assert query.status_code == 200
        data = query.json()
        assert data["answer"]
        assert len(data["citations"]) >= 1


@pytest.mark.asyncio()
async def test_rag_debug():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        debug = await client.post("/api/rag/debug", json={"query": "小学三年级如何理解分数？", "top_k": 3})
        assert debug.status_code == 200
        assert debug.json()["mode"] == "rag"
