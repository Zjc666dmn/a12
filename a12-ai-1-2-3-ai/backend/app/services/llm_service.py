from typing import Any

import httpx

from app.services.model_config import get_active_model_config


class LLMServiceError(RuntimeError):
    pass


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


def test_chat_model_connection(model_config: dict[str, Any]) -> None:
    call_chat_model(
        model_config,
        [{"role": "user", "content": "ping"}],
        temperature=0,
        max_tokens=8,
        timeout=15,
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
    return str(payload["choices"][0]["message"]["content"]).strip()


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
