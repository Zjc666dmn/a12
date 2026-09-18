import json
import time
from pathlib import Path
from typing import Any

from app.core.config import settings
from app.schemas.model_config import ModelConfigRead, ModelConfigState, ModelConfigWrite


CONFIG_FILE = Path("work/model_configs.json")
ENV_FILE = Path(".env")

MASKED_MARK = "••••••••"
SECRET_KEY_MARKERS = ("KEY", "TOKEN", "SECRET", "PASSWORD", "AUTH")


def mask_secret(value: str | None) -> str:
    if not value:
        return ""
    if len(value) <= 8:
        return MASKED_MARK
    return f"{value[:4]}{MASKED_MARK}{value[-4:]}"


def _looks_masked(value: str | None) -> bool:
    if not value:
        return True
    return "•" in value or MASKED_MARK in value


def _is_secret_key(key: str) -> bool:
    return any(marker in str(key).upper() for marker in SECRET_KEY_MARKERS)


def redact_config_json(config_json: str | None) -> str:
    if not config_json:
        return ""
    try:
        config = json.loads(config_json)
    except json.JSONDecodeError:
        return config_json
    if isinstance(config, dict):
        env = config.get("env")
        if isinstance(env, dict):
            for key, value in env.items():
                if _is_secret_key(key) and isinstance(value, str) and value:
                    env[key] = mask_secret(value)
    return json.dumps(config, ensure_ascii=False, indent=2)


def _model_has_real_key(model: dict[str, Any]) -> bool:
    if str(model.get("apiKey") or "").strip():
        return True
    try:
        env = json.loads(str(model.get("configJson") or "{}")).get("env") or {}
    except (json.JSONDecodeError, AttributeError):
        return False
    if not isinstance(env, dict):
        return False
    return any(isinstance(value, str) and value.strip() for key, value in env.items() if _is_secret_key(key))


def _deepseek_anthropic_config(api_key: str = "") -> str:
    return json.dumps(
        {
            "env": {
                "ANTHROPIC_AUTH_TOKEN": api_key,
                "ANTHROPIC_BASE_URL": "https://api.deepseek.com/anthropic",
                "ANTHROPIC_MODEL": "deepseek-v4-pro",
            },
            "provider": "deepseek",
            "apiFormat": "anthropic-compatible",
            "theme": "light",
            "codemossProviderId": "58aec044-3fad-45c2-966a-20de796306e5",
        },
        ensure_ascii=False,
        indent=2,
    )


def _qwen_config(api_key: str = "") -> str:
    return json.dumps(
        {
            "env": {
                "QWEN_API_KEY": api_key,
                "QWEN_BASE_URL": "https://dashscope.aliyuncs.com/compatible-mode/v1",
                "QWEN_MODEL": "qwen-plus",
            },
            "provider": "qwen",
            "apiFormat": "openai-compatible",
            "theme": "light",
        },
        ensure_ascii=False,
        indent=2,
    )


def _mimo_config(api_key: str = "") -> str:
    return json.dumps(
        {
            "env": {
                "MIMO_API_KEY": api_key,
                "MIMO_BASE_URL": "https://api.xiaomimimo.com/v1",
                "MIMO_MODEL": "mimo-v2.5-pro",
            },
            "provider": "xiaomi-mimo",
            "apiFormat": "openai-compatible",
            "theme": "light",
        },
        ensure_ascii=False,
        indent=2,
    )


def _sync_model_from_config_json(model: dict[str, Any]) -> dict[str, Any]:
    try:
        config = json.loads(model.get("configJson") or "{}")
    except json.JSONDecodeError:
        return model

    env = config.get("env", {})
    if not isinstance(env, dict):
        return model

    api_key = (
        env.get("ANTHROPIC_AUTH_TOKEN")
        or env.get("DEEPSEEK_API_KEY")
        or env.get("QWEN_API_KEY")
        or env.get("MIMO_API_KEY")
    )
    endpoint = (
        env.get("ANTHROPIC_BASE_URL")
        or env.get("DEEPSEEK_BASE_URL")
        or env.get("QWEN_BASE_URL")
        or env.get("MIMO_BASE_URL")
    )
    model_name = (
        env.get("ANTHROPIC_MODEL")
        or env.get("DEEPSEEK_MODEL")
        or env.get("QWEN_MODEL")
        or env.get("MIMO_MODEL")
    )

    if api_key and not _looks_masked(api_key) and not str(model.get("apiKey") or "").strip():
        model["apiKey"] = api_key
    if endpoint:
        model["endpoint"] = endpoint
    if model_name:
        model["model"] = model_name

    if not model.get("apiFormat"):
        api_format = config.get("apiFormat")
        if isinstance(api_format, str) and api_format:
            model["apiFormat"] = api_format

    return model


def _extract_config(model: dict[str, Any]) -> dict[str, Any]:
    try:
        config = json.loads(model.get("configJson") or "{}")
    except json.JSONDecodeError:
        config = {}
    if not isinstance(config.get("env"), dict):
        config["env"] = {}
    return config


def _sync_env_file_from_model(model: dict[str, Any]) -> None:
    config = _extract_config(model)
    env = config.get("env", {})
    updates: dict[str, str] = {}

    for key, value in env.items():
        text = str(value)
        if _is_secret_key(key) and not text.strip():
            continue
        updates[key] = text

    if config.get("theme"):
        updates["MODEL_CONFIG_THEME"] = str(config["theme"])

    if config.get("codemossProviderId"):
        updates["CODEMOSS_PROVIDER_ID"] = str(config["codemossProviderId"])

    updates.update(
        {
            "ACTIVE_MODEL_PROVIDER": str(model.get("provider", "")),
            "ACTIVE_MODEL_ID": str(model.get("id", "")),
            "ACTIVE_MODEL_ENDPOINT": str(model.get("endpoint", "")),
            "ACTIVE_MODEL_NAME": str(model.get("model", "")),
        },
    )
    _write_env_updates(updates)


def _write_env_updates(updates: dict[str, str]) -> None:
    existing: dict[str, str] = {}
    if ENV_FILE.exists():
        for line in ENV_FILE.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            existing[key.strip()] = value.strip()
    existing.update(updates)
    lines = [f"{key}={value}" for key, value in existing.items()]
    ENV_FILE.write_text("\n".join(lines) + "\n", encoding="utf-8")


def _default_models() -> list[dict[str, Any]]:
    deepseek_api_key = settings.anthropic_auth_token or settings.deepseek_api_key
    deepseek_endpoint = settings.anthropic_base_url or settings.deepseek_base_url
    deepseek_model = settings.anthropic_model or settings.deepseek_model
    return [
        {
            "id": "deepseek",
            "provider": "DeepSeek",
            "remark": "课堂生成主模型",
            "website": "https://platform.deepseek.com",
            "apiKey": deepseek_api_key,
            "endpoint": deepseek_endpoint,
            "model": deepseek_model,
            "logo": "DS",
            "status": "未检测",
            "useStandaloneTest": False,
            "useStandaloneBilling": False,
            "configJson": _deepseek_anthropic_config(deepseek_api_key),
        },
        {
            "id": "mimo",
            "provider": "Xiaomi MiMo",
            "remark": "小米 MiMo 推理模型",
            "website": "https://platform.xiaomimimo.com",
            "apiKey": "",
            "endpoint": "https://api.xiaomimimo.com/v1",
            "model": "mimo-v2.5-pro",
            "logo": "Mi",
            "status": "未检测",
            "useStandaloneTest": False,
            "useStandaloneBilling": False,
            "configJson": _mimo_config(),
        },
        {
            "id": "qwen",
            "provider": "Qwen",
            "remark": "通义千问备用模型",
            "website": "https://dashscope.aliyuncs.com",
            "apiKey": "",
            "endpoint": "https://dashscope.aliyuncs.com/compatible-mode/v1",
            "model": "qwen-plus",
            "logo": "QW",
            "status": "未检测",
            "useStandaloneTest": False,
            "useStandaloneBilling": False,
            "configJson": _qwen_config(),
        },
    ]


def _default_state() -> dict[str, Any]:
    return {"activeModelId": "deepseek", "models": _default_models()}


def _read_raw_state() -> dict[str, Any]:
    if not CONFIG_FILE.exists():
        state = _default_state()
        _write_raw_state(state)
        return state

    with CONFIG_FILE.open("r", encoding="utf-8") as file:
        state = json.load(file)

    if not state.get("models"):
        state = _default_state()
        _write_raw_state(state)

    return state


def _write_raw_state(state: dict[str, Any]) -> None:
    CONFIG_FILE.parent.mkdir(parents=True, exist_ok=True)
    with CONFIG_FILE.open("w", encoding="utf-8") as file:
        json.dump(state, file, ensure_ascii=False, indent=2)
        file.write("\n")


def _preserve_existing_secrets(new_model: dict[str, Any], existing: dict[str, Any]) -> dict[str, Any]:
    if _looks_masked(new_model.get("apiKey")) and str(existing.get("apiKey") or "").strip():
        new_model["apiKey"] = existing["apiKey"]

    try:
        new_cfg = json.loads(str(new_model.get("configJson") or "{}"))
    except json.JSONDecodeError:
        new_cfg = {}
    try:
        old_cfg = json.loads(str(existing.get("configJson") or "{}"))
    except json.JSONDecodeError:
        old_cfg = {}

    if not isinstance(new_cfg, dict):
        new_cfg = {}
    if not isinstance(old_cfg, dict):
        old_cfg = {}

    new_env = new_cfg.get("env") if isinstance(new_cfg.get("env"), dict) else {}
    old_env = old_cfg.get("env") if isinstance(old_cfg.get("env"), dict) else {}

    for key, value in old_env.items():
        if _is_secret_key(key) and isinstance(value, str) and value.strip():
            if _looks_masked(new_env.get(key)):
                new_env[key] = value

    new_cfg["env"] = new_env
    new_model["configJson"] = json.dumps(new_cfg, ensure_ascii=False, indent=2)
    return new_model


def _strip_masked_secrets(model: dict[str, Any]) -> dict[str, Any]:
    if _looks_masked(model.get("apiKey")):
        model["apiKey"] = ""

    try:
        config = json.loads(str(model.get("configJson") or "{}"))
    except json.JSONDecodeError:
        return model
    if not isinstance(config, dict):
        return model

    env = config.get("env")
    if isinstance(env, dict):
        for key in list(env.keys()):
            if _is_secret_key(key) and _looks_masked(env.get(key)):
                env[key] = ""
    model["configJson"] = json.dumps(config, ensure_ascii=False, indent=2)
    return model


def _to_state(state: dict[str, Any]) -> ModelConfigState:
    active_model_id = state.get("activeModelId") or state["models"][0]["id"]
    models = []
    for model in state["models"]:
        masked = dict(model)
        masked["apiKey"] = mask_secret(masked.get("apiKey"))
        masked["configJson"] = redact_config_json(masked.get("configJson"))
        models.append(
            ModelConfigRead.model_validate(
                {
                    **masked,
                    "active": masked["id"] == active_model_id,
                    "hasApiKey": _model_has_real_key(model),
                }
            )
        )
    return ModelConfigState.model_validate({"activeModelId": active_model_id, "models": models})


def list_model_configs() -> ModelConfigState:
    return _to_state(_read_raw_state())


def save_model_config(payload: ModelConfigWrite) -> ModelConfigState:
    state = _read_raw_state()
    model = payload.model_dump(by_alias=True)
    model["id"] = model.get("id") or f"model-{int(time.time() * 1000)}"

    existing_index = next((index for index, item in enumerate(state["models"]) if item["id"] == model["id"]), None)
    if existing_index is not None:
        model = _preserve_existing_secrets(model, state["models"][existing_index])

    model = _sync_model_from_config_json(model)
    model = _strip_masked_secrets(model)

    if existing_index is None:
        state["models"].insert(0, model)
        state["activeModelId"] = model["id"]
    else:
        state["models"][existing_index] = model

    _write_raw_state(state)
    if state.get("activeModelId") == model["id"]:
        _sync_env_file_from_model(model)
    return _to_state(state)


def delete_model_config(model_id: str) -> ModelConfigState:
    state = _read_raw_state()
    if len(state["models"]) <= 1:
        return _to_state(state)

    state["models"] = [model for model in state["models"] if model["id"] != model_id]
    if state.get("activeModelId") == model_id:
        state["activeModelId"] = state["models"][0]["id"]

    _write_raw_state(state)
    return _to_state(state)


def activate_model_config(model_id: str) -> ModelConfigState:
    state = _read_raw_state()
    active_model = next((model for model in state["models"] if model["id"] == model_id), None)
    if active_model:
        state["activeModelId"] = model_id
        _write_raw_state(state)
        _sync_env_file_from_model(_sync_model_from_config_json(active_model))
    return _to_state(state)


def get_active_model_config() -> dict[str, Any]:
    state = _read_raw_state()
    active_model_id = state.get("activeModelId")
    model = next((model for model in state["models"] if model["id"] == active_model_id), state["models"][0])
    return _sync_model_from_config_json(model.copy())


def mark_model_status(model_id: str, status: str) -> ModelConfigState:
    state = _read_raw_state()
    state["models"] = [
        {**model, "status": status} if model["id"] == model_id else model
        for model in state["models"]
    ]
    _write_raw_state(state)
    return _to_state(state)


def test_model_connection(model_id: str) -> ModelConfigState:
    from app.services.llm_service import LLMServiceError, test_chat_model_connection

    state = _read_raw_state()
    model = next((item for item in state["models"] if item["id"] == model_id), None)
    if model is None:
        return _to_state(state)

    model = _sync_model_from_config_json(model)

    if not model.get("apiKey"):
        return mark_model_status(model_id, "连接失败")

    try:
        test_chat_model_connection(model)
        return mark_model_status(model_id, "连接正常")
    except LLMServiceError:
        return mark_model_status(model_id, "连接失败")
