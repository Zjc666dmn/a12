from fastapi import APIRouter

from app.api.routes import assets, chat, files, health, jobs, knowledge, model_config, tasks

api_router = APIRouter()
api_router.include_router(health.router, tags=["health"])
api_router.include_router(tasks.router, prefix="/tasks", tags=["tasks"])
api_router.include_router(chat.router, prefix="/tasks", tags=["chat"])
api_router.include_router(files.router, prefix="/files", tags=["files"])
api_router.include_router(knowledge.router, prefix="/knowledge", tags=["knowledge"])
api_router.include_router(assets.router, prefix="/assets", tags=["assets"])
api_router.include_router(model_config.router, prefix="/model-configs", tags=["model-configs"])
api_router.include_router(jobs.router, prefix="/jobs", tags=["jobs"])
