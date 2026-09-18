from pydantic import BaseModel, Field


class KnowledgeSearchRequest(BaseModel):
    query: str
    top_k: int = 5


class KnowledgeSearchResult(BaseModel):
    source: str
    content: str
    score: float | None = None
    file_id: int | None = None
    chunk_index: int | None = None
    page: int | None = None
    section: str | None = None
    tags: list[str] = Field(default_factory=list)


class EmbeddingProfileRead(BaseModel):
    provider: str
    model: str
    dimension: int
    collection: str


class KnowledgeSearchResponse(BaseModel):
    query: str
    results: list[KnowledgeSearchResult]
    message: str
    embedding: EmbeddingProfileRead | None = None


class KnowledgeChunk(BaseModel):
    id: str
    file_id: int
    chunk_index: int
    source: str
    file_type: str
    page: int | None = None
    section: str | None = None
    content: str
    tags: list[str] = Field(default_factory=list)
    char_count: int
    score: float | None = None


class KnowledgeBuildResponse(BaseModel):
    file_id: int
    chunk_count: int
    chunks: list[KnowledgeChunk]
    message: str


class KnowledgeChunkListResponse(BaseModel):
    chunks: list[KnowledgeChunk]
    total: int


class KnowledgeVectorizeResponse(BaseModel):
    file_id: int | None = None
    chunk_count: int
    total_vectors: int
    message: str
    embedding: EmbeddingProfileRead
