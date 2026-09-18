from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import settings
from app.core.security import verify_request_token
from app.db.migrations import ensure_task_intent_columns
from app.db.session import Base, engine


def _cors_origins() -> list[str]:
    origins = [origin.strip() for origin in settings.cors_origins.split(",") if origin.strip()]
    return origins or ["http://localhost:5173", "http://127.0.0.1:5173"]


def create_app() -> FastAPI:
    settings.uploads_dir.mkdir(parents=True, exist_ok=True)
    settings.parsed_dir.mkdir(parents=True, exist_ok=True)
    settings.knowledge_dir.mkdir(parents=True, exist_ok=True)
    settings.vector_db_dir.mkdir(parents=True, exist_ok=True)
    settings.embedding_model_cache_dir.mkdir(parents=True, exist_ok=True)
    settings.outputs_dir.mkdir(parents=True, exist_ok=True)
    Base.metadata.create_all(bind=engine)
    ensure_task_intent_columns()

    app = FastAPI(title=settings.app_name)

    @app.middleware("http")
    async def api_token_middleware(request: Request, call_next):
        path = request.url.path
        if path.startswith(settings.api_prefix) and path != f"{settings.api_prefix}/health":
            denied = verify_request_token(request)
            if denied is not None:
                return denied
        return await call_next(request)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=_cors_origins(),
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(api_router, prefix=settings.api_prefix)
    return app


app = create_app()
