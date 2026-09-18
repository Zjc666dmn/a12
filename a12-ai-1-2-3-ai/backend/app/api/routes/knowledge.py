from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_db
from app.models.task import UploadedFile
from app.schemas.knowledge import (
    KnowledgeBuildResponse,
    KnowledgeChunkListResponse,
    KnowledgeSearchRequest,
    KnowledgeSearchResponse,
    KnowledgeVectorizeResponse,
)
from app.services.chunk_service import build_chunks_for_file, get_all_chunks, get_file_chunks, search_chunks
from app.services.embedding_service import embedding_profile
from app.services.external_kb import kb_search, merge_results
from app.services.vector_store import vector_search, vector_store_count, vectorize_all_chunks, vectorize_file_chunks

router = APIRouter()


@router.post("/search", response_model=KnowledgeSearchResponse)
def search_knowledge(payload: KnowledgeSearchRequest) -> KnowledgeSearchResponse:
    local_results = search_chunks(payload.query, payload.top_k)
    kb_results = kb_search(payload.query, payload.top_k)
    merged, kb_count = merge_results(local_results, kb_results, payload.top_k)
    message = f"检索到 {len(merged)} 条知识切片"
    if kb_count:
        message += f"（含知识库V2 {kb_count} 条）"
    return KnowledgeSearchResponse(
        query=payload.query,
        results=merged,
        message=message,
    )


@router.post("/vector-search", response_model=KnowledgeSearchResponse)
def search_vector_knowledge(payload: KnowledgeSearchRequest) -> KnowledgeSearchResponse:
    local_results = vector_search(payload.query, payload.top_k)
    kb_results = kb_search(payload.query, payload.top_k)
    merged, kb_count = merge_results(local_results, kb_results, payload.top_k)
    profile = embedding_profile()
    message = f"向量检索到 {len(merged)} 条知识切片（{profile['provider']} · {profile['dimension']}维）"
    if kb_count:
        message += f"，含知识库V2 {kb_count} 条"
    return KnowledgeSearchResponse(
        query=payload.query,
        results=merged,
        message=message,
        embedding=profile,
    )


@router.post("/build/{file_id}", response_model=KnowledgeBuildResponse)
def build_file_knowledge(file_id: int, db: Session = Depends(get_db)) -> KnowledgeBuildResponse:
    record = db.get(UploadedFile, file_id)
    if record is None:
        raise HTTPException(status_code=404, detail="File not found")
    if record.parse_status != "ready":
        raise HTTPException(status_code=400, detail="请先解析文件，再生成知识切片")

    parsed_path = settings.parsed_dir / f"{file_id}.json"
    if not parsed_path.exists():
        raise HTTPException(status_code=404, detail="Parsed file not found")

    chunks = build_chunks_for_file(file_id, parsed_path=parsed_path)
    return KnowledgeBuildResponse(
        file_id=file_id,
        chunk_count=len(chunks),
        chunks=chunks,
        message="知识切片生成完成",
    )


@router.post("/vectorize/all", response_model=KnowledgeVectorizeResponse)
def vectorize_all_knowledge() -> KnowledgeVectorizeResponse:
    chunk_count = vectorize_all_chunks()
    profile = embedding_profile()
    return KnowledgeVectorizeResponse(
        chunk_count=chunk_count,
        total_vectors=vector_store_count(),
        message=f"已写入 Chroma 向量库：{chunk_count} 个知识切片（{profile['provider']} · {profile['dimension']}维）",
        embedding=profile,
    )


@router.post("/vectorize/{file_id}", response_model=KnowledgeVectorizeResponse)
def vectorize_file_knowledge(file_id: int, db: Session = Depends(get_db)) -> KnowledgeVectorizeResponse:
    record = db.get(UploadedFile, file_id)
    if record is None:
        raise HTTPException(status_code=404, detail="File not found")
    if record.parse_status != "ready":
        raise HTTPException(status_code=400, detail="请先解析文件，再写入向量库")

    chunk_count = vectorize_file_chunks(file_id)
    if chunk_count == 0:
        parsed_path = settings.parsed_dir / f"{file_id}.json"
        if not parsed_path.exists():
            raise HTTPException(status_code=404, detail="Parsed file not found")
        build_chunks_for_file(file_id, parsed_path=parsed_path)
        chunk_count = vectorize_file_chunks(file_id)

    profile = embedding_profile()
    return KnowledgeVectorizeResponse(
        file_id=file_id,
        chunk_count=chunk_count,
        total_vectors=vector_store_count(),
        message=f"已写入 Chroma 向量库：{chunk_count} 个知识切片（{profile['provider']} · {profile['dimension']}维）",
        embedding=profile,
    )


@router.get("/files/{file_id}/chunks", response_model=KnowledgeChunkListResponse)
def list_file_chunks(file_id: int) -> KnowledgeChunkListResponse:
    chunks = get_file_chunks(file_id)
    return KnowledgeChunkListResponse(chunks=chunks, total=len(chunks))


@router.get("/chunks", response_model=KnowledgeChunkListResponse)
def list_all_chunks() -> KnowledgeChunkListResponse:
    chunks = get_all_chunks()
    return KnowledgeChunkListResponse(chunks=chunks, total=len(chunks))
