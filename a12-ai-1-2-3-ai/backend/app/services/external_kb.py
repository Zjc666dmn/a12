"""Client for the TeachNova Knowledge Base V2 (PostgreSQL+pgvector+KG service).

The V2 service runs separately (see Desktop/TeachNova_KnowledgeBase_V2) and
exposes POST /knowledge/search. Results are merged into the local knowledge
routes with scope priority; any failure degrades gracefully to local-only
search so the main app keeps working when the KB service is offline.
"""

from __future__ import annotations

import logging
from typing import Any

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

# Higher first when sorting merged results.
SCOPE_PRIORITY = {
    "personal": 0,
    "school": 1,
    "lesson_plan": 2,
    "teaching": 3,
    "question": 4,
    "ppt_material": 5,
    "subject": 6,
    "curriculum": 7,
    "general": 8,
}


def kb_enabled() -> bool:
    return bool(settings.kb_api_enabled and settings.kb_api_base_url)


def kb_search(query: str, top_k: int = 5, subject: str | None = None, grade: str | None = None) -> list[dict[str, Any]]:
    """Fetch results from KB V2. Returns [] on any failure (graceful degradation)."""
    if not kb_enabled() or not query.strip():
        return []
    payload: dict[str, Any] = {"query": query, "top_k": top_k}
    if subject:
        payload["subject"] = subject
    if grade:
        payload["grade"] = grade
    try:
        resp = httpx.post(
            f"{settings.kb_api_base_url.rstrip('/')}/knowledge/search",
            json=payload,
            timeout=settings.kb_api_timeout_seconds,
        )
        resp.raise_for_status()
        data = resp.json()
        return data.get("results", [])
    except Exception as exc:  # noqa: BLE001 - degrade to local-only search
        logger.warning("KB V2 search failed (%s); falling back to local only", exc)
        return []


def merge_results(
    local_results: list[dict[str, Any]],
    kb_results: list[dict[str, Any]],
    top_k: int,
) -> tuple[list[dict[str, Any]], int]:
    """Merge local chunks and KB items into one ranked list.

    KB items keep their provenance in ``tags`` (e.g. ``知识库V2``, source name)
    so the frontend can render them like any other chunk. Local results are
    kept first on ties. Returns (merged, kb_count).
    """
    seen_titles: set[str] = set()
    for r in local_results:
        seen_titles.add((r.get("source") or r.get("content", "")[:32]).strip())

    merged: list[dict[str, Any]] = [
        {**r, "tags": list(r.get("tags") or [])} for r in local_results
    ]
    kb_count = 0
    for item in kb_results:
        title = (item.get("title") or "").strip()
        if title and title in seen_titles:
            continue
        seen_titles.add(title)
        tags = list(item.get("tags") or [])
        if "知识库V2" not in tags:
            tags.append("知识库V2")
        merged.append(
            {
                "source": title or (item.get("content") or "")[:32],
                "content": item.get("content") or "",
                "score": item.get("score"),
                "file_id": None,
                "chunk_index": None,
                "page": None,
                "section": item.get("grade"),
                "tags": tags,
                "scope": item.get("scope"),
                "library_type": item.get("library_type"),
            }
        )
        kb_count += 1

    def sort_key(r: dict[str, Any]) -> tuple[float, int, float]:
        score = r.get("score") or 0.0
        scope_rank = SCOPE_PRIORITY.get(r.get("scope") or "", 9)
        # Local results first among equal score/scope.
        local_bias = 0 if r.get("file_id") is not None else 1
        return (-float(score), scope_rank, local_bias)

    merged.sort(key=sort_key)
    return merged[:top_k], kb_count
