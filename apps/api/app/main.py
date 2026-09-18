from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import init_db
from app.routers import documents, knowledge_bases, retrieval, stats, chunks, models_settings, knowledge_graph, knowledge_points


@asynccontextmanager
async def lifespan(app: FastAPI):  # type: ignore[no-untyped-def]
    await init_db()
    yield


app = FastAPI(title="EDU RAG API", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(documents.router)
app.include_router(knowledge_bases.router)
app.include_router(retrieval.router)
app.include_router(stats.router)
app.include_router(chunks.router)
app.include_router(models_settings.router)
app.include_router(knowledge_graph.router)
app.include_router(knowledge_points.router)


@app.get("/api/health")
async def health():
    return {"status": "ok", "llm_configured": bool(settings.llm_api_key)}
