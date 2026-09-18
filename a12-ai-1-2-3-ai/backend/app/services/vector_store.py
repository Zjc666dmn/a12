from typing import Any

import threading

import chromadb

from app.core.config import settings
from app.services.chunk_service import get_all_chunks, get_file_chunks
from app.services.embedding_service import embed_text, embed_texts, embedding_profile


COLLECTION_NAME = "teachnova_chunks"

# Cache the PersistentClient once: creating it on every call is expensive, and a
# failed init inside a background job thread poisons chromadb's shared system
# registry (subsequent calls raise "'RustBindingsAPI' object has no attribute
# 'bindings'"). One client created on first use keeps that failure recoverable.
_client_lock = threading.Lock()
_client: chromadb.api.ClientAPI | None = None


def _get_client() -> "chromadb.api.ClientAPI":
    global _client
    with _client_lock:
        if _client is None:
            _client = chromadb.PersistentClient(path=str(settings.vector_db_dir))
        return _client


def vectorize_file_chunks(file_id: int) -> int:
    chunks = get_file_chunks(file_id)
    if not chunks:
        return 0
    _upsert_chunks(chunks)
    return len(chunks)


def vectorize_all_chunks() -> int:
    chunks = get_all_chunks()
    if not chunks:
        return 0
    _upsert_chunks(chunks)
    return len(chunks)


def vector_search(query: str, top_k: int = 5) -> list[dict[str, Any]]:
    query = query.strip()
    if not query:
        return []

    query_embedding = embed_text(query)
    collection = _get_collection()
    if collection.count() == 0:
        return []

    result = collection.query(
        query_embeddings=[query_embedding],
        n_results=max(1, top_k),
        include=["documents", "metadatas", "distances"],
    )

    documents = result.get("documents", [[]])[0]
    metadatas = result.get("metadatas", [[]])[0]
    distances = result.get("distances", [[]])[0]

    hits: list[dict[str, Any]] = []
    for document, metadata, distance in zip(documents, metadatas, distances, strict=False):
        score = max(0.0, 1.0 - float(distance))
        tags = str(metadata.get("tags", "")).split(",") if metadata else []
        page = int(metadata.get("page", 0)) if metadata else 0
        hits.append(
            {
                "source": str(metadata.get("source", "")),
                "content": document,
                "score": round(score, 4),
                "file_id": int(metadata.get("file_id", 0)),
                "chunk_index": int(metadata.get("chunk_index", 0)),
                "page": page or None,
                "section": str(metadata.get("section", "")) or None,
                "tags": [tag for tag in tags if tag],
            }
        )
    return hits


def vector_store_count() -> int:
    return _get_collection().count()


def _upsert_chunks(chunks: list[dict[str, Any]]) -> None:
    documents = [str(chunk.get("content", "")) for chunk in chunks]
    embeddings = embed_texts(documents)
    collection = _get_collection()
    collection.upsert(
        ids=[str(chunk.get("id")) for chunk in chunks],
        documents=documents,
        embeddings=embeddings,
        metadatas=[_chunk_metadata(chunk) for chunk in chunks],
    )


def _chunk_metadata(chunk: dict[str, Any]) -> dict[str, str | int | float | bool]:
    page = chunk.get("page")
    return {
        "file_id": int(chunk.get("file_id", 0)),
        "chunk_index": int(chunk.get("chunk_index", 0)),
        "source": str(chunk.get("source", "")),
        "file_type": str(chunk.get("file_type", "")),
        "page": int(page) if isinstance(page, int) else 0,
        "section": str(chunk.get("section") or ""),
        "tags": ",".join(str(tag) for tag in chunk.get("tags", [])),
        "char_count": int(chunk.get("char_count", 0)),
    }


def _get_collection():
    profile = embedding_profile()
    client = _get_client()
    return client.get_or_create_collection(
        name=profile["collection"],
        metadata={
            "hnsw:space": "cosine",
            "embedding_provider": profile["provider"],
            "embedding_model": profile["model"],
            "embedding_dimension": profile["dimension"],
            "legacy_collection": COLLECTION_NAME,
        },
    )
