import hashlib
import math
import re
from functools import lru_cache
from typing import Any

import httpx

from app.core.config import settings


TOKEN_PATTERN = re.compile(r"[A-Za-z][A-Za-z0-9_-]+|[\u4e00-\u9fff]")
HASH_PROVIDER = "hash"


class EmbeddingProviderError(RuntimeError):
    pass


def embed_text(text: str) -> list[float]:
    return embed_texts([text])[0]


def embed_texts(texts: list[str]) -> list[list[float]]:
    cleaned = [text or "" for text in texts]
    for provider in _provider_chain():
        try:
            if provider == "bge":
                return _embed_with_bge(cleaned)
            if provider == "dashscope":
                return _embed_with_dashscope(cleaned)
            if provider == HASH_PROVIDER:
                return [_embed_with_hash(text) for text in cleaned]
        except Exception:
            continue
    return [_embed_with_hash(text) for text in cleaned]


def embedding_profile() -> dict[str, Any]:
    provider = _resolve_provider()
    if provider == "bge":
        model = settings.embedding_model
        dimension = _bge_dimension(model)
    elif provider == "dashscope":
        model = settings.dashscope_embedding_model
        dimension = settings.dashscope_embedding_dimension
    else:
        model = "teachnova-hash-embedding"
        dimension = settings.embedding_dimension
    return {
        "provider": provider,
        "model": model,
        "dimension": dimension,
        "collection": embedding_collection_name(provider, model, dimension),
    }


def embedding_collection_name(provider: str, model: str, dimension: int) -> str:
    safe_model = re.sub(r"[^a-zA-Z0-9_]+", "_", model).strip("_").lower()
    return f"teachnova_chunks_{provider}_{safe_model}_{dimension}"


def _provider_chain() -> list[str]:
    provider = (settings.embedding_provider or "auto").strip().lower()
    fallback = (settings.embedding_fallback_provider or HASH_PROVIDER).strip().lower()

    if provider in {"auto", "bge"}:
        chain = ["bge", "dashscope", fallback]
    elif provider in {"dashscope", "qwen"}:
        chain = ["dashscope", "bge", fallback]
    elif provider in {"local", HASH_PROVIDER}:
        chain = [HASH_PROVIDER]
    else:
        chain = [provider, fallback, HASH_PROVIDER]

    result: list[str] = []
    for item in chain:
        normalized = "dashscope" if item == "qwen" else item
        if normalized and normalized not in result:
            result.append(normalized)
    if HASH_PROVIDER not in result:
        result.append(HASH_PROVIDER)
    return result


def _resolve_provider() -> str:
    for provider in _provider_chain():
        if provider == "bge" and _bge_available():
            return "bge"
        if provider == "dashscope" and settings.dashscope_api_key:
            return "dashscope"
        if provider == HASH_PROVIDER:
            return HASH_PROVIDER
    return HASH_PROVIDER


def _embed_with_bge(texts: list[str]) -> list[list[float]]:
    model = _load_bge_model()
    embeddings = model.encode(
        texts,
        normalize_embeddings=True,
        show_progress_bar=False,
        batch_size=settings.embedding_batch_size,
    )
    return [[float(value) for value in vector] for vector in embeddings]


@lru_cache(maxsize=1)
def _load_bge_model():
    try:
        from sentence_transformers import SentenceTransformer
    except ImportError as exc:
        raise EmbeddingProviderError("sentence-transformers is not installed") from exc

    settings.embedding_model_cache_dir.mkdir(parents=True, exist_ok=True)
    common_options = {
        "cache_folder": str(settings.embedding_model_cache_dir),
        "device": settings.embedding_device or None,
    }
    try:
        return SentenceTransformer(settings.embedding_model, local_files_only=True, **common_options)
    except Exception as exc:
        if not settings.embedding_allow_download:
            raise EmbeddingProviderError("BGE model is not available in local cache") from exc
    return SentenceTransformer(settings.embedding_model, local_files_only=False, **common_options)


def _bge_available() -> bool:
    try:
        _load_bge_model()
        return True
    except Exception:
        return False


def _bge_dimension(model_name: str) -> int:
    if model_name.endswith("small-zh-v1.5"):
        return 512
    if model_name.endswith("base-zh-v1.5"):
        return 768
    if model_name.endswith("bge-m3"):
        return 1024
    try:
        model = _load_bge_model()
        return int(model.get_sentence_embedding_dimension())
    except Exception:
        return 512


def _embed_with_dashscope(texts: list[str]) -> list[list[float]]:
    if not settings.dashscope_api_key:
        raise EmbeddingProviderError("DASHSCOPE_API_KEY is not configured")

    endpoint = settings.dashscope_embedding_base_url.rstrip("/")
    if not endpoint.endswith("/embeddings"):
        endpoint = f"{endpoint}/embeddings"

    vectors: list[list[float]] = []
    for start in range(0, len(texts), settings.embedding_batch_size):
        batch = texts[start : start + settings.embedding_batch_size]
        with httpx.Client(timeout=settings.embedding_timeout_seconds) as client:
            response = client.post(
                endpoint,
                headers={
                    "Authorization": f"Bearer {settings.dashscope_api_key}",
                    "Content-Type": "application/json",
                },
                json={"model": settings.dashscope_embedding_model, "input": batch},
            )
        response.raise_for_status()
        payload = response.json()
        data = sorted(payload.get("data", []), key=lambda item: int(item.get("index", 0)))
        vectors.extend([[float(value) for value in item["embedding"]] for item in data])

    if len(vectors) != len(texts):
        raise EmbeddingProviderError("DashScope embedding response size mismatch")
    return vectors


def _embed_with_hash(text: str) -> list[float]:
    vector = [0.0] * settings.embedding_dimension
    tokens = _tokenize(text)
    if not tokens:
        return vector

    for token in tokens:
        digest = hashlib.sha256(token.encode("utf-8")).digest()
        index = int.from_bytes(digest[:4], "big") % settings.embedding_dimension
        sign = 1.0 if digest[4] % 2 == 0 else -1.0
        vector[index] += sign

    norm = math.sqrt(sum(value * value for value in vector))
    if norm == 0:
        return vector
    return [round(value / norm, 8) for value in vector]


def _tokenize(text: str) -> list[str]:
    raw_tokens = TOKEN_PATTERN.findall(text.lower())
    chinese_chars = [token for token in raw_tokens if len(token) == 1 and "\u4e00" <= token <= "\u9fff"]
    words = [token for token in raw_tokens if token not in chinese_chars]
    chinese_bigrams = [f"{chinese_chars[index]}{chinese_chars[index + 1]}" for index in range(len(chinese_chars) - 1)]
    return words + chinese_bigrams + chinese_chars
