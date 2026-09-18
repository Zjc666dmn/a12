import json
import re
from pathlib import Path
from typing import Any

from app.core.config import settings

DEFAULT_CHUNK_SIZE = 700
DEFAULT_CHUNK_OVERLAP = 100


def normalize_text(text: str) -> str:
    text = text.replace("\r\n", "\n").replace("\r", "\n").replace("\t", " ")
    lines = [re.sub(r" +", " ", line).strip() for line in text.splitlines()]
    compact_lines = [line for line in lines if line]
    return "\n".join(compact_lines)


def split_text(text: str, max_chars: int = DEFAULT_CHUNK_SIZE, overlap: int = DEFAULT_CHUNK_OVERLAP) -> list[str]:
    text = normalize_text(text)
    if not text:
        return []

    paragraphs = text.split("\n")
    chunks: list[str] = []
    current = ""

    for paragraph in paragraphs:
        if len(paragraph) > max_chars:
            if current:
                chunks.append(current)
                current = ""
            chunks.extend(_split_long_text(paragraph, max_chars, overlap))
            continue

        candidate = f"{current}\n{paragraph}".strip() if current else paragraph
        if len(candidate) <= max_chars:
            current = candidate
        else:
            chunks.append(current)
            current = _tail_text(current, overlap)
            current = f"{current}\n{paragraph}".strip() if current else paragraph

    if current:
        chunks.append(current)

    return chunks


def build_chunks_for_file(
    file_id: int,
    parsed: dict[str, Any] | None = None,
    parsed_path: str | Path | None = None,
) -> list[dict[str, Any]]:
    if parsed is None:
        source_path = Path(parsed_path) if parsed_path else settings.parsed_dir / f"{file_id}.json"
        parsed = json.loads(source_path.read_text(encoding="utf-8"))

    title = parsed.get("title") or f"file-{file_id}"
    file_type = parsed.get("file_type") or "unknown"
    markdown = parsed.get("markdown")
    pages = _markdown_sections(markdown) if isinstance(markdown, str) and markdown.strip() else None
    pages = pages or parsed.get("pages") or [{"page": None, "text": parsed.get("text", "")}]

    chunks: list[dict[str, Any]] = []
    chunk_index = 1
    for page in pages:
        page_text = page.get("text", "") if isinstance(page, dict) else ""
        page_title = page.get("title", "") if isinstance(page, dict) else ""
        page_no = page.get("page") if isinstance(page, dict) else None
        for content in split_text(page_text):
            chunk = {
                "id": f"{file_id}-{chunk_index}",
                "file_id": file_id,
                "chunk_index": chunk_index,
                "source": title,
                "file_type": file_type,
                "page": page_no,
                "section": page_title,
                "content": content,
                "tags": extract_tags(f"{page_title}\n{content}"),
                "char_count": len(content),
            }
            chunks.append(chunk)
            chunk_index += 1

    _write_file_chunks(file_id, chunks)
    _merge_global_chunks(file_id, chunks)
    return chunks


def get_file_chunks(file_id: int) -> list[dict[str, Any]]:
    path = _file_chunks_path(file_id)
    if not path.exists():
        return []
    return json.loads(path.read_text(encoding="utf-8"))


def get_all_chunks() -> list[dict[str, Any]]:
    path = _global_chunks_path()
    if not path.exists():
        return []
    return json.loads(path.read_text(encoding="utf-8"))


def search_chunks(query: str, top_k: int = 5) -> list[dict[str, Any]]:
    query = normalize_text(query)
    if not query:
        return []

    terms = _query_terms(query)
    scored: list[tuple[float, dict[str, Any]]] = []
    for chunk in get_all_chunks():
        score = _score_chunk(chunk, query, terms)
        if score > 0:
            scored.append((score, chunk))

    scored.sort(key=lambda item: item[0], reverse=True)
    return [{**chunk, "score": round(score, 4)} for score, chunk in scored[:top_k]]


def extract_tags(text: str, limit: int = 8) -> list[str]:
    candidates = re.findall(r"[A-Za-z][A-Za-z0-9_-]{1,}|[\u4e00-\u9fff]{2,8}", text)
    seen: set[str] = set()
    tags: list[str] = []

    for candidate in candidates:
        normalized = candidate.lower() if re.match(r"[A-Za-z]", candidate) else candidate
        if normalized in seen:
            continue
        seen.add(normalized)
        tags.append(candidate)
        if len(tags) >= limit:
            break

    return tags


def _markdown_sections(markdown: str) -> list[dict[str, Any]]:
    sections: list[dict[str, Any]] = []
    current_title = ""
    current_lines: list[str] = []

    for line in markdown.splitlines():
        heading = re.match(r"^(#{1,6})\s+(.+)$", line.strip())
        if heading and current_lines:
            sections.append(
                {
                    "page": None,
                    "title": current_title,
                    "text": "\n".join(current_lines).strip(),
                }
            )
            current_lines = []

        if heading:
            current_title = heading.group(2).strip()
        current_lines.append(line)

    if current_lines:
        sections.append(
            {
                "page": None,
                "title": current_title,
                "text": "\n".join(current_lines).strip(),
            }
        )

    return [section for section in sections if section["text"]]


def _split_long_text(text: str, max_chars: int, overlap: int) -> list[str]:
    chunks: list[str] = []
    start = 0
    while start < len(text):
        end = min(start + max_chars, len(text))
        chunks.append(text[start:end])
        if end >= len(text):
            break
        start = max(end - overlap, start + 1)
    return chunks


def _tail_text(text: str, overlap: int) -> str:
    if overlap <= 0 or len(text) <= overlap:
        return text
    return text[-overlap:]


def _write_file_chunks(file_id: int, chunks: list[dict[str, Any]]) -> None:
    path = _file_chunks_path(file_id)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(chunks, ensure_ascii=False, indent=2), encoding="utf-8")


def _merge_global_chunks(file_id: int, chunks: list[dict[str, Any]]) -> None:
    path = _global_chunks_path()
    existing = get_all_chunks()
    merged = [chunk for chunk in existing if chunk.get("file_id") != file_id]
    merged.extend(chunks)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(merged, ensure_ascii=False, indent=2), encoding="utf-8")


def _query_terms(query: str) -> list[str]:
    terms = re.findall(r"[A-Za-z][A-Za-z0-9_-]{1,}|[\u4e00-\u9fff]{2,}", query)
    return [term.lower() for term in terms]


def _score_chunk(chunk: dict[str, Any], query: str, terms: list[str]) -> float:
    content = str(chunk.get("content", ""))
    tags = " ".join(chunk.get("tags", []))
    haystack = f"{content}\n{tags}".lower()
    query_lower = query.lower()

    score = 0.0
    if query_lower in haystack:
        score += 2.0
    for term in terms:
        score += haystack.count(term) * 1.0
    return score / max(len(content), 1) * 1000


def _file_chunks_path(file_id: int) -> Path:
    return settings.knowledge_dir / "files" / f"{file_id}.json"


def _global_chunks_path() -> Path:
    return settings.knowledge_dir / "chunks.json"
