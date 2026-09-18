from __future__ import annotations

import json
from typing import Any

import httpx

from app.config import settings

SYSTEM_PROMPT = """\n你是一名中小学教育 AI 助手。\n\n回答必须优先依据提供的知识库内容。\n不得凭空捏造教材内容。\n如果知识库没有找到可靠信息，应明确说明。\n涉及教材原文时必须引用来源。\n涉及课程标准时必须引用来源。\n如果不同教材版本存在差异，应明确指出。\n\n回答中给出：\n1. 结论\n2. 解释\n3. 教学建议（如适用）\n4. 来源\n"""


def _citation_block(citations: list[dict[str, Any]]) -> str:
    if not citations:
        return ""
    lines: list[str] = []
    for idx, item in enumerate(citations, start=1):
        lines.append(
            f"[{idx}] {item.get('title') or item.get('book_name') or '知识库'}，章节：{item.get('chapter') or '-'}，页码：{item.get('page_start') or item.get('page') or '-'}, chunk_id={item.get('chunk_id')}"
        )
    return "\n\n参考来源：\n" + "\n".join(lines)


def _fallback_answer(query: str, context_chunks: list[dict[str, Any]], citations: list[dict[str, Any]]) -> str:
    if not context_chunks:
        return "当前知识库未检索到直接匹配内容。"
    highest = max(context_chunks, key=lambda x: float(x.get("score", 0)))
    body = highest["content"][:1200]
    return f"依据知识库检索结果：\n\n{body}\n{_citation_block(citations)}\n\n（当前为离线摘录模式，未接入可用 LLM API。）"


async def generate_answer(query: str, context_chunks: list[dict[str, Any]], citations: list[dict[str, Any]]) -> dict[str, Any]:
    if not settings.llm_api_key:
        return {
            "answer": _fallback_answer(query, context_chunks, citations),
            "provider": "local-fallback",
            "model": "none",
            "latency_ms": 0.0,
        }
    context_text = "\n\n".join(
        f"[{idx}] {chunk.get('title') or chunk.get('book_name') or ''} {chunk.get('chapter') or ''} (chunk_id={chunk.get('chunk_id')})\n{chunk['content']}"
        for idx, chunk in enumerate(context_chunks, start=1)
    ) or "（未检索到内容）"
    payload = {
        "model": settings.llm_model,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": f"问题：{query}\n\n检索到的内容：\n{context_text}\n\n请结合来源回答。"},
        ],
        "temperature": settings.llm_temperature,
        "max_tokens": settings.llm_max_tokens,
    }
    async with httpx.AsyncClient(timeout=settings.llm_timeout_seconds) as client:
        response = await client.post(
            f"{settings.llm_base_url.rstrip('/')}/chat/completions",
            json=payload,
            headers={
                "Authorization": f"Bearer {settings.llm_api_key}",
                "Content-Type": "application/json",
            },
        )
        response.raise_for_status()
        data = response.json()
    content = data["choices"][0]["message"]["content"]
    return {"answer": content, "provider": settings.llm_provider, "model": settings.llm_model, "latency_ms": 0.0}
