import json
from collections.abc import Iterator
from typing import Any

import httpx

from app.services.model_config import get_active_model_config


class LLMServiceError(RuntimeError):
    pass


CONNECT_TIMEOUT = 15.0


def call_active_chat_model(
    messages: list[dict[str, str]],
    *,
    system: str | None = None,
    temperature: float = 0.3,
    max_tokens: int = 1200,
    timeout: float = 30,
) -> str:
    return call_chat_model(
        get_active_model_config(),
        messages,
        system=system,
        temperature=temperature,
        max_tokens=max_tokens,
        timeout=timeout,
    )


def call_chat_model(
    model_config: dict[str, Any],
    messages: list[dict[str, str]],
    *,
    system: str | None = None,
    temperature: float = 0.3,
    max_tokens: int = 1200,
    timeout: float = 30,
) -> str:
    api_key = str(model_config.get("apiKey") or "")
    endpoint = str(model_config.get("endpoint") or "")
    model_name = str(model_config.get("model") or "")
    if not api_key or not endpoint or not model_name:
        raise LLMServiceError("模型配置缺少 API Key、请求地址或模型名称")

    try:
        if _is_anthropic_compatible(endpoint, model_config):
            return _call_anthropic_compatible(
                api_key=api_key,
                endpoint=endpoint,
                model_name=model_name,
                messages=messages,
                system=system,
                temperature=temperature,
                max_tokens=max_tokens,
                timeout=timeout,
            )
        return _call_openai_compatible(
            api_key=api_key,
            endpoint=endpoint,
            model_name=model_name,
            messages=messages,
            system=system,
            temperature=temperature,
            max_tokens=max_tokens,
            timeout=timeout,
        )
    except (httpx.HTTPError, KeyError, IndexError, TypeError, ValueError) as exc:
        raise LLMServiceError(str(exc)) from exc


def stream_active_chat_model(
    messages: list[dict[str, str]],
    *,
    system: str | None = None,
    temperature: float = 0.3,
    max_tokens: int = 1200,
    timeout: float = 60,
) -> Iterator[dict[str, str]]:
    """逐块产出模型输出。

    每块是一个 dict：{"type": "reasoning" | "delta" | "done", "text": str}。
    reasoning 来自推理模型的 reasoning_content 字段（智能体思考过程），
    delta 是可以直接追加到正文的增量文本。
    """
    yield from stream_chat_model(
        get_active_model_config(),
        messages,
        system=system,
        temperature=temperature,
        max_tokens=max_tokens,
        timeout=timeout,
    )


def stream_chat_model(
    model_config: dict[str, Any],
    messages: list[dict[str, str]],
    *,
    system: str | None = None,
    temperature: float = 0.3,
    max_tokens: int = 1200,
    timeout: float = 60,
) -> Iterator[dict[str, str]]:
    api_key = str(model_config.get("apiKey") or "")
    endpoint = str(model_config.get("endpoint") or "")
    model_name = str(model_config.get("model") or "")
    if not api_key or not endpoint or not model_name:
        raise LLMServiceError("模型配置缺少 API Key、请求地址或模型名称")

    if _is_anthropic_compatible(endpoint, model_config):
        # Anthropic 协议暂不逐块透传：整段产出后一次性下发，保证前端行为一致
        text = _call_anthropic_compatible(
            api_key=api_key,
            endpoint=endpoint,
            model_name=model_name,
            messages=messages,
            system=system,
            temperature=temperature,
            max_tokens=max_tokens,
            timeout=timeout,
        )
        yield {"type": "delta", "text": text}
        return

    yield from _stream_openai_compatible(
        api_key=api_key,
        endpoint=endpoint,
        model_name=model_name,
        messages=messages,
        system=system,
        temperature=temperature,
        max_tokens=max_tokens,
        timeout=timeout,
    )


def _stream_openai_compatible(
    *,
    api_key: str,
    endpoint: str,
    model_name: str,
    messages: list[dict[str, str]],
    system: str | None,
    temperature: float,
    max_tokens: int,
    timeout: float,
) -> Iterator[dict[str, str]]:
    payload = {
        "model": model_name,
        "messages": _openai_messages(messages, system),
        "temperature": temperature,
        "max_tokens": max_tokens,
        "stream": True,
    }
    emitted = False
    try:
        with httpx.stream(
            "POST",
            f"{endpoint.rstrip('/')}/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
                "Accept": "text/event-stream",
            },
            json=payload,
            timeout=httpx.Timeout(timeout, connect=CONNECT_TIMEOUT),
        ) as response:
            response.raise_for_status()
            for raw_line in response.iter_lines():
                if not raw_line:
                    continue
                line = raw_line.strip()
                if line.startswith("data:"):
                    line = line[5:].strip()
                if not line or line == "[DONE]":
                    if line == "[DONE]":
                        break
                    continue
                try:
                    chunk = json.loads(line)
                except json.JSONDecodeError:
                    continue
                choices = chunk.get("choices") or []
                if not choices:
                    continue
                delta = choices[0].get("delta") or {}
                reasoning = delta.get("reasoning_content") or delta.get("reasoning")
                if reasoning:
                    yield {"type": "reasoning", "text": str(reasoning)}
                text = delta.get("content")
                if text:
                    emitted = True
                    yield {"type": "delta", "text": str(text)}
    except (httpx.HTTPError, KeyError, IndexError, TypeError, ValueError) as exc:
        raise LLMServiceError(str(exc)) from exc

    if not emitted:
        # 推理模型可能把预算全花在 reasoning_content 上，或直接返回空
        raise LLMServiceError("模型流式返回了空内容，若是推理模型请增大 max_tokens 预算")


def test_chat_model_connection(model_config: dict[str, Any]) -> None:
    # 推理模型会先消耗 token 生成 reasoning_content，预算要留足
    call_chat_model(
        model_config,
        [{"role": "user", "content": "ping"}],
        temperature=0,
        max_tokens=256,
        timeout=60,
    )


def _is_anthropic_compatible(endpoint: str, model_config: dict[str, Any]) -> bool:
    provider = str(model_config.get("provider") or "").lower()
    api_format = str(model_config.get("apiFormat") or "").lower()
    config_json = str(model_config.get("configJson") or "").lower()
    if "openai" in api_format:
        return False
    if "anthropic" in api_format:
        return True
    return "anthropic" in endpoint.lower() or "anthropic" in provider or "anthropic" in config_json


def _call_anthropic_compatible(
    *,
    api_key: str,
    endpoint: str,
    model_name: str,
    messages: list[dict[str, str]],
    system: str | None,
    temperature: float,
    max_tokens: int,
    timeout: float,
) -> str:
    response = httpx.post(
        f"{endpoint.rstrip('/')}/v1/messages",
        headers={
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
        },
        json={
            "model": model_name,
            "system": system or "",
            "messages": _anthropic_messages(messages),
            "max_tokens": max_tokens,
            "temperature": temperature,
        },
        timeout=timeout,
    )
    response.raise_for_status()
    payload = response.json()
    return "".join(item.get("text", "") for item in payload.get("content", [])).strip()


def _call_openai_compatible(
    *,
    api_key: str,
    endpoint: str,
    model_name: str,
    messages: list[dict[str, str]],
    system: str | None,
    temperature: float,
    max_tokens: int,
    timeout: float,
) -> str:
    payload_messages = _openai_messages(messages, system)
    response = httpx.post(
        f"{endpoint.rstrip('/')}/chat/completions",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": model_name,
            "messages": payload_messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": False,
        },
        timeout=timeout,
    )
    response.raise_for_status()
    payload = response.json()
    message = payload["choices"][0]["message"]
    content = str(message.get("content") or "").strip()
    if not content:
        # 推理模型（如 MiMo/o1）可能把全部 token 预算消耗在 reasoning_content 上
        finish_reason = payload["choices"][0].get("finish_reason")
        raise LLMServiceError(
            f"模型返回了空内容（finish_reason={finish_reason}），"
            "若是推理模型请增大 max_tokens 预算"
        )
    return content


def _openai_messages(messages: list[dict[str, str]], system: str | None) -> list[dict[str, str]]:
    cleaned = _clean_messages(messages)
    if system:
        if cleaned and cleaned[0]["role"] == "system":
            cleaned[0]["content"] = system
        else:
            cleaned.insert(0, {"role": "system", "content": system})
    return cleaned


def _anthropic_messages(messages: list[dict[str, str]]) -> list[dict[str, str]]:
    cleaned: list[dict[str, str]] = []
    for message in _clean_messages(messages):
        role = message["role"]
        content = message["content"]
        if role == "system":
            continue
        if role == "assistant" and not cleaned:
            continue
        if cleaned and cleaned[-1]["role"] == role:
            cleaned[-1]["content"] = f"{cleaned[-1]['content']}\n\n{content}"
            continue
        cleaned.append({"role": role, "content": content})
    return cleaned or [{"role": "user", "content": "ping"}]


def _clean_messages(messages: list[dict[str, str]]) -> list[dict[str, str]]:
    allowed_roles = {"system", "user", "assistant"}
    cleaned: list[dict[str, str]] = []
    for message in messages:
        role = str(message.get("role") or "")
        content = str(message.get("content") or "").strip()
        if role in allowed_roles and content:
            cleaned.append({"role": role, "content": content})
    return cleaned
