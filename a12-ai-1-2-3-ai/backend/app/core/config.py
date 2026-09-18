from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


PROJECT_ROOT = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    app_name: str = "Teaching Agent API"
    api_prefix: str = "/api"
    database_url: str = f"sqlite:///{PROJECT_ROOT / 'work' / 'teaching_agent.db'}"
    uploads_dir: Path = PROJECT_ROOT / "work" / "uploads"
    parsed_dir: Path = PROJECT_ROOT / "work" / "parsed"
    knowledge_dir: Path = PROJECT_ROOT / "work" / "knowledge"
    vector_db_dir: Path = PROJECT_ROOT / "work" / "vector_db"
    outputs_dir: Path = PROJECT_ROOT / "outputs"
    embedding_provider: str = "auto"
    embedding_model: str = "BAAI/bge-small-zh-v1.5"
    embedding_model_cache_dir: Path = PROJECT_ROOT / "work" / "models"
    embedding_device: str = ""
    embedding_allow_download: bool = True
    embedding_batch_size: int = 16
    embedding_timeout_seconds: float = 30.0
    embedding_fallback_provider: str = "hash"
    embedding_dimension: int = 384
    embedding_api_key: str = ""
    embedding_base_url: str = ""
    dashscope_api_key: str = ""
    dashscope_embedding_model: str = "text-embedding-v4"
    dashscope_embedding_base_url: str = "https://dashscope.aliyuncs.com/compatible-mode/v1/embeddings"
    dashscope_embedding_dimension: int = 1024
    deepseek_api_key: str = ""
    deepseek_base_url: str = "https://api.deepseek.com"
    deepseek_model: str = "deepseek-chat"
    deepseek_timeout_seconds: float = 30.0
    anthropic_auth_token: str = ""
    anthropic_base_url: str = "https://api.deepseek.com/anthropic"
    anthropic_model: str = "deepseek-v4-pro"
    disable_autoupdater: str = "1"
    enable_tool_search: str = "true"
    model_config_theme: str = "dark"
    codemoss_provider_id: str = ""
    active_model_provider: str = ""
    active_model_id: str = ""
    active_model_endpoint: str = ""
    active_model_name: str = ""
    teachnova_api_token: str = ""
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")


settings = Settings()
