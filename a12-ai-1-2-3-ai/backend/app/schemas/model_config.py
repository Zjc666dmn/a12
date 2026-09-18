from pydantic import BaseModel, ConfigDict, Field


class ModelConfigBase(BaseModel):
    provider: str
    remark: str = ""
    website: str = ""
    api_key: str = Field(default="", alias="apiKey")
    endpoint: str = ""
    model: str
    logo: str = "AI"
    status: str = "未检测"
    use_standalone_test: bool = Field(default=False, alias="useStandaloneTest")
    use_standalone_billing: bool = Field(default=False, alias="useStandaloneBilling")
    config_json: str = Field(default='{\n  "env": {},\n  "theme": "light"\n}', alias="configJson")

    model_config = ConfigDict(populate_by_name=True)


class ModelConfigRead(ModelConfigBase):
    id: str
    active: bool = False
    has_api_key: bool = Field(default=False, alias="hasApiKey")


class ModelConfigWrite(ModelConfigBase):
    id: str | None = None


class ModelConfigState(BaseModel):
    active_model_id: str = Field(alias="activeModelId")
    models: list[ModelConfigRead]

    model_config = ConfigDict(populate_by_name=True)


class ModelConfigActivate(BaseModel):
    model_id: str = Field(alias="modelId")

    model_config = ConfigDict(populate_by_name=True)

