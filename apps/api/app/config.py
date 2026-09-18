from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    model_config = {"env_file": (".env", "../.env", "../../.env"), "extra": "ignore"}

    app_env: str = "development"
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    cors_origins: str = "http://localhost:3000"

    database_url: str = "sqlite:///./data/edu_rag.db"
    redis_url: str = "redis://localhost:6379/0"
    qdrant_url: str = "http://localhost:6333"
    qdrant_collection: str = "edu_documents"
    upload_dir: str = "./data/uploads"

    llm_provider: str = "openai-compatible"
    llm_base_url: str = "https://api.openai.com/v1"
    llm_api_key: str = ""
    llm_model: str = "gpt-4o-mini"
    llm_temperature: float = 0.2
    llm_max_tokens: int = 1600
    llm_timeout_seconds: int = 60

    embedding_provider: str = "openai-compatible"
    embedding_api_base: str = "https://api.openai.com/v1"
    embedding_api_key: str = ""
    embedding_model: str = "text-embedding-3-small"
    embedding_dimension: int = 1536
    embedding_batch_size: int = 32
    embedding_normalize: bool = True
    embedding_device: str = "cpu"

    reranker_provider: str = "none"
    reranker_api_base: str = ""
    reranker_api_key: str = ""
    reranker_model: str = "BAAI/bge-reranker-v2-m3"
    reranker_enabled: bool = False

    dense_top_k: int = 20
    bm25_top_k: int = 20
    dense_weight: float = 0.7
    bm25_weight: float = 0.3
    rerank_candidate_k: int = 20
    rerank_top_k: int = 5
    final_top_k: int = 5
    chunk_size: int = 900
    chunk_overlap: int = 120

    ocr_enabled: bool = False
    paddle_ocr_lang: str = "ch"

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


settings = Settings()
