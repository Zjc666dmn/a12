from fastapi import APIRouter

from app.schemas.model_config import ModelConfigActivate, ModelConfigState, ModelConfigWrite
from app.services.model_config import (
    activate_model_config,
    delete_model_config,
    list_model_configs,
    save_model_config,
    test_model_connection,
)

router = APIRouter()


@router.get("", response_model=ModelConfigState)
def get_model_configs() -> ModelConfigState:
    return list_model_configs()


@router.post("", response_model=ModelConfigState)
def upsert_model_config(payload: ModelConfigWrite) -> ModelConfigState:
    return save_model_config(payload)


@router.post("/activate", response_model=ModelConfigState)
def activate_model(payload: ModelConfigActivate) -> ModelConfigState:
    return activate_model_config(payload.model_id)


@router.post("/{model_id}/test", response_model=ModelConfigState)
def test_model(model_id: str) -> ModelConfigState:
    return test_model_connection(model_id)


@router.delete("/{model_id}", response_model=ModelConfigState)
def delete_model(model_id: str) -> ModelConfigState:
    return delete_model_config(model_id)
