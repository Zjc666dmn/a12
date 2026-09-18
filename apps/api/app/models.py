from __future__ import annotations

import enum
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=False), default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=False), default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class EducationStage(str, enum.Enum):
    elementary = "elementary"
    junior = "junior"
    senior = "senior"


class DocumentStatus(str, enum.Enum):
    uploaded = "uploaded"
    parsing = "parsing"
    ocr = "ocr"
    cleaning = "cleaning"
    structuring = "structuring"
    chunking = "chunking"
    embedding = "embedding"
    indexing = "indexing"
    completed = "completed"
    failed = "failed"


class DataSourceType(str, enum.Enum):
    uploaded_file = "uploaded_file"
    local_directory = "local_directory"
    official_website = "official_website"
    api = "api"
    manual_import = "manual_import"
    demo = "demo"


class RelationType(str, enum.Enum):
    prerequisite = "prerequisite"
    related = "related"
    parent = "parent"
    child = "child"
    similar = "similar"
    application = "application"
    extension = "extension"


class KnowledgeBase(TimestampMixin, Base):
    __tablename__ = "knowledge_bases"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(180), unique=True, index=True)
    description: Mapped[str | None] = mapped_column(Text)
    stage: Mapped[EducationStage | None] = mapped_column(Enum(EducationStage))
    subject: Mapped[str | None] = mapped_column(String(120))
    documents = relationship("Document", back_populates="knowledge_base", cascade="all, delete-orphan")
    knowledge_points = relationship("KnowledgePoint", back_populates="knowledge_base", cascade="all, delete-orphan")


class EducationStageValue(TimestampMixin, Base):
    __tablename__ = "education_stage_values"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    stage: Mapped[EducationStage] = mapped_column(Enum(EducationStage), index=True)
    name: Mapped[str] = mapped_column(String(60))
    __table_args__ = (UniqueConstraint("stage", "name", name="uq_stage_value"),)


class Grade(TimestampMixin, Base):
    __tablename__ = "grades"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    stage: Mapped[EducationStage] = mapped_column(Enum(EducationStage), index=True)
    name: Mapped[str] = mapped_column(String(60))
    value: Mapped[int] = mapped_column(Integer)
    __table_args__ = (UniqueConstraint("stage", "name", name="uq_grade_name"),)


class Subject(TimestampMixin, Base):
    __tablename__ = "subjects"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    target_stages: Mapped[str] = mapped_column(Text, default="elementary,junior,senior")


class Publisher(TimestampMixin, Base):
    __tablename__ = "publishers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(160), unique=True, index=True)


class TextbookVersion(TimestampMixin, Base):
    __tablename__ = "textbook_versions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    publisher: Mapped[str] = mapped_column(String(160), index=True)
    subject: Mapped[str] = mapped_column(String(80), index=True)
    grade_name: Mapped[str] = mapped_column(String(60))
    version: Mapped[str] = mapped_column(String(120))
    year: Mapped[int | None] = mapped_column(Integer)
    __table_args__ = (UniqueConstraint("publisher", "subject", "grade_name", "version", name="uq_textbook_version"),)


class KnowledgeBaseSummary(TimestampMixin, Base):
    __tablename__ = "knowledge_base_summaries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    knowledge_base_id: Mapped[int] = mapped_column(ForeignKey("knowledge_bases.id", ondelete="CASCADE"), unique=True)
    document_count: Mapped[int] = mapped_column(Integer, default=0)
    chunk_count: Mapped[int] = mapped_column(Integer, default=0)
    knowledge_point_count: Mapped[int] = mapped_column(Integer, default=0)
    embedding_count: Mapped[int] = mapped_column(Integer, default=0)
    last_source_label: Mapped[str | None] = mapped_column(String(120))
    last_retrieval_latency_ms: Mapped[float | None] = mapped_column(Float)


class Document(TimestampMixin, Base):
    __tablename__ = "documents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    knowledge_base_id: Mapped[int] = mapped_column(ForeignKey("knowledge_bases.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(260))
    file_name: Mapped[str] = mapped_column(String(260))
    file_type: Mapped[str] = mapped_column(String(40))
    file_size: Mapped[int] = mapped_column(Integer, default=0)
    file_hash: Mapped[str | None] = mapped_column(String(128), index=True)
    content_hash: Mapped[str | None] = mapped_column(String(128), index=True)
    source_type: Mapped[DataSourceType] = mapped_column(Enum(DataSourceType), default=DataSourceType.uploaded_file)
    license_status: Mapped[str] = mapped_column(String(40), default="user_uploaded")
    source_url: Mapped[str | None] = mapped_column(String(600))
    stage: Mapped[str | None] = mapped_column(String(40))
    grade: Mapped[str | None] = mapped_column(String(40))
    semester: Mapped[str | None] = mapped_column(String(40))
    subject: Mapped[str | None] = mapped_column(String(80))
    publisher: Mapped[str | None] = mapped_column(String(160))
    textbook_version: Mapped[str | None] = mapped_column(String(120))
    book_name: Mapped[str | None] = mapped_column(String(220))
    chapter: Mapped[str | None] = mapped_column(String(220))
    section: Mapped[str | None] = mapped_column(String(220))
    resource_type: Mapped[str | None] = mapped_column(String(80))
    publication_year: Mapped[str | None] = mapped_column(String(20))
    language: Mapped[str] = mapped_column(String(20), default="zh-CN")
    status: Mapped[DocumentStatus] = mapped_column(Enum(DocumentStatus), default=DocumentStatus.uploaded)
    status_message: Mapped[str | None] = mapped_column(Text)
    ocr_confidence_avg: Mapped[float | None] = mapped_column(Float)
    duplicate_of_document_id: Mapped[int | None] = mapped_column(Integer)
    knowledge_base = relationship("KnowledgeBase", back_populates="documents")
    chunks = relationship("Chunk", back_populates="document", cascade="all, delete-orphan")
    ingestion_tasks = relationship("IngestionTask", back_populates="document", cascade="all, delete-orphan")


class DocumentSection(TimestampMixin, Base):
    __tablename__ = "document_sections"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    document_id: Mapped[int] = mapped_column(ForeignKey("documents.id", ondelete="CASCADE"), index=True)
    parent_section_id: Mapped[int | None] = mapped_column(ForeignKey("document_sections.id", ondelete="SET NULL"))
    level: Mapped[int] = mapped_column(Integer, default=0)
    order_index: Mapped[int] = mapped_column(Integer, default=0)
    title: Mapped[str] = mapped_column(String(320))
    content_hash: Mapped[str | None] = mapped_column(String(128))
    document = relationship("Document", back_populates=None)
    children = relationship("DocumentSection", back_populates=None)


class DocumentPage(TimestampMixin, Base):
    __tablename__ = "document_pages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    document_id: Mapped[int] = mapped_column(ForeignKey("documents.id", ondelete="CASCADE"), index=True)
    page_number: Mapped[int] = mapped_column(Integer)
    text: Mapped[str] = mapped_column(Text)
    ocr_confidence_avg: Mapped[float | None] = mapped_column(Float)
    has_image: Mapped[bool] = mapped_column(Boolean, default=False)
    has_table: Mapped[bool] = mapped_column(Boolean, default=False)
    has_formula: Mapped[bool] = mapped_column(Boolean, default=False)
    raw_text_path: Mapped[str | None] = mapped_column(String(400))
    __table_args__ = (UniqueConstraint("document_id", "page_number", name="uq_document_page"),)


class Chunk(TimestampMixin, Base):
    __tablename__ = "chunks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    document_id: Mapped[int] = mapped_column(ForeignKey("documents.id", ondelete="CASCADE"), index=True)
    section_id: Mapped[int | None] = mapped_column(ForeignKey("document_sections.id", ondelete="SET NULL"), index=True)
    page_start: Mapped[int] = mapped_column(Integer, default=1)
    page_end: Mapped[int] = mapped_column(Integer, default=1)
    chunk_index: Mapped[int] = mapped_column(Integer, default=0)
    content: Mapped[str] = mapped_column(Text)
    content_hash: Mapped[str] = mapped_column(String(128), index=True)
    token_count: Mapped[int] = mapped_column(Integer, default=0)
    stage: Mapped[str | None] = mapped_column(String(40))
    grade: Mapped[str | None] = mapped_column(String(40))
    semester: Mapped[str | None] = mapped_column(String(40))
    subject: Mapped[str | None] = mapped_column(String(80))
    publisher: Mapped[str | None] = mapped_column(String(160))
    textbook_version: Mapped[str | None] = mapped_column(String(120))
    book_name: Mapped[str | None] = mapped_column(String(220))
    chapter: Mapped[str | None] = mapped_column(String(220))
    section: Mapped[str | None] = mapped_column(String(220))
    resource_type: Mapped[str | None] = mapped_column(String(80))
    knowledge_points_json: Mapped[str | None] = mapped_column(Text)
    embedding_status: Mapped[str] = mapped_column(String(20), default="pending")
    embedding_model: Mapped[str | None] = mapped_column(String(120))
    embedding_text_hash: Mapped[str | None] = mapped_column(String(128))
    embedding_count: Mapped[int] = mapped_column(Integer, default=0)
    document = relationship("Document", back_populates="chunks")
    knowledge_point_chunks = relationship("KnowledgePointChunk", back_populates="chunk", cascade="all, delete-orphan")


class KnowledgePoint(TimestampMixin, Base):
    __tablename__ = "knowledge_points"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    knowledge_base_id: Mapped[int] = mapped_column(ForeignKey("knowledge_bases.id", ondelete="CASCADE"), index=True)
    document_id: Mapped[int | None] = mapped_column(ForeignKey("documents.id", ondelete="SET NULL"))
    name: Mapped[str] = mapped_column(String(220), index=True)
    slug: Mapped[str] = mapped_column(String(220), index=True)
    description: Mapped[str | None] = mapped_column(Text)
    stage: Mapped[str | None] = mapped_column(String(40))
    grade: Mapped[str | None] = mapped_column(String(40))
    subject: Mapped[str | None] = mapped_column(String(80))
    chapter: Mapped[str | None] = mapped_column(String(220))
    difficulty: Mapped[int] = mapped_column(Integer, default=2)
    importance: Mapped[int] = mapped_column(Integer, default=3)
    keywords_json: Mapped[str | None] = mapped_column(Text)
    aliases_json: Mapped[str | None] = mapped_column(Text)
    prerequisites_json: Mapped[str | None] = mapped_column(Text)
    knowledge_base = relationship("KnowledgeBase", back_populates="knowledge_points")
    related_from = relationship("KnowledgeRelation", foreign_keys="KnowledgeRelation.from_knowledge_point_id", back_populates="source_point")
    related_to = relationship("KnowledgeRelation", foreign_keys="KnowledgeRelation.to_knowledge_point_id", back_populates="target_point")
    knowledge_point_chunks = relationship("KnowledgePointChunk", back_populates="knowledge_point", cascade="all, delete-orphan")


class KnowledgeRelation(TimestampMixin, Base):
    __tablename__ = "knowledge_relations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    from_knowledge_point_id: Mapped[int] = mapped_column(ForeignKey("knowledge_points.id", ondelete="CASCADE"), index=True)
    to_knowledge_point_id: Mapped[int] = mapped_column(ForeignKey("knowledge_points.id", ondelete="CASCADE"), index=True)
    relation_type: Mapped[RelationType] = mapped_column(Enum(RelationType))
    confidence: Mapped[float] = mapped_column(Float, default=1.0)
    source_label: Mapped[str | None] = mapped_column(String(120))
    source_point = relationship("KnowledgePoint", foreign_keys=[from_knowledge_point_id], back_populates="related_from")
    target_point = relationship("KnowledgePoint", foreign_keys=[to_knowledge_point_id], back_populates="related_to")
    __table_args__ = (UniqueConstraint("from_knowledge_point_id", "to_knowledge_point_id", "relation_type", name="uq_knowledge_relation"),)


class KnowledgePointChunk(TimestampMixin, Base):
    __tablename__ = "knowledge_point_chunks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    knowledge_point_id: Mapped[int] = mapped_column(ForeignKey("knowledge_points.id", ondelete="CASCADE"), index=True)
    chunk_id: Mapped[int] = mapped_column(ForeignKey("chunks.id", ondelete="CASCADE"), index=True)
    weight: Mapped[float] = mapped_column(Float, default=1.0)
    knowledge_point = relationship("KnowledgePoint", back_populates="knowledge_point_chunks")
    chunk = relationship("Chunk", back_populates="knowledge_point_chunks")
    __table_args__ = (UniqueConstraint("knowledge_point_id", "chunk_id", name="uq_kp_chunk"),)


class Question(TimestampMixin, Base):
    __tablename__ = "questions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    document_id: Mapped[int] = mapped_column(ForeignKey("documents.id", ondelete="CASCADE"), index=True)
    knowledge_base_id: Mapped[int] = mapped_column(ForeignKey("knowledge_bases.id", ondelete="CASCADE"), index=True)
    stem: Mapped[str] = mapped_column(Text)
    options_json: Mapped[str | None] = mapped_column(Text)
    answer: Mapped[str | None] = mapped_column(Text)
    analysis: Mapped[str | None] = mapped_column(Text)
    question_type: Mapped[str | None] = mapped_column(String(80))
    difficulty: Mapped[int] = mapped_column(Integer, default=2)
    subject: Mapped[str | None] = mapped_column(String(80))
    grade: Mapped[str | None] = mapped_column(String(40))
    chapter: Mapped[str | None] = mapped_column(String(220))
    source_label: Mapped[str | None] = mapped_column(String(120))
    knowledge_points_json: Mapped[str | None] = mapped_column(Text)


class Resource(TimestampMixin, Base):
    __tablename__ = "resources"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    document_id: Mapped[int | None] = mapped_column(ForeignKey("documents.id", ondelete="SET NULL"))
    resource_type: Mapped[str] = mapped_column(String(60))
    mime_type: Mapped[str | None] = mapped_column(String(120))
    storage_path: Mapped[str] = mapped_column(String(400))
    source_url: Mapped[str | None] = mapped_column(String(600))
    title: Mapped[str | None] = mapped_column(String(260))
    duration_seconds: Mapped[int | None] = mapped_column(Integer)
    width: Mapped[int | None] = mapped_column(Integer)
    height: Mapped[int | None] = mapped_column(Integer)
    bytes: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=False), default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=False), default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class IngestionTask(TimestampMixin, Base):
    __tablename__ = "ingestion_tasks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    document_id: Mapped[int | None] = mapped_column(ForeignKey("documents.id", ondelete="CASCADE"), index=True)
    task_name: Mapped[str] = mapped_column(String(140))
    data_source_type: Mapped[str] = mapped_column(String(40))
    data_source_label: Mapped[str | None] = mapped_column(String(240))
    source_url: Mapped[str | None] = mapped_column(String(600))
    license_status: Mapped[str] = mapped_column(String(40), default="unknown")
    status: Mapped[str] = mapped_column(String(40), default="pending")
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=False))
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=False))
    download_count: Mapped[int] = mapped_column(Integer, default=0)
    success_count: Mapped[int] = mapped_column(Integer, default=0)
    failure_count: Mapped[int] = mapped_column(Integer, default=0)
    error_code: Mapped[str | None] = mapped_column(String(80))
    error_message: Mapped[str | None] = mapped_column(Text)
    stack_trace: Mapped[str | None] = mapped_column(Text)
    retry_count: Mapped[int] = mapped_column(Integer, default=0)
    request_id: Mapped[str | None] = mapped_column(String(64))
    document = relationship("Document", back_populates="ingestion_tasks")


class EmbeddingModel(TimestampMixin, Base):
    __tablename__ = "embedding_models"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    provider: Mapped[str] = mapped_column(String(40))
    model_name: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    dimension: Mapped[int] = mapped_column(Integer)
    batch_size: Mapped[int] = mapped_column(Integer, default=32)
    normalize: Mapped[bool] = mapped_column(Boolean, default=True)
    device: Mapped[str] = mapped_column(String(20), default="cpu")
    status: Mapped[str] = mapped_column(String(20), default="inactive")
    usage_count: Mapped[int] = mapped_column(Integer, default=0)
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=False))
    embedding_count: Mapped[int] = mapped_column(Integer, default=0)
    api_base: Mapped[str | None] = mapped_column(String(260))
    api_key_hint: Mapped[str | None] = mapped_column(String(120))


class RerankerModel(TimestampMixin, Base):
    __tablename__ = "reranker_models"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    provider: Mapped[str] = mapped_column(String(40))
    model_name: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    status: Mapped[str] = mapped_column(String(20), default="inactive")
    api_base: Mapped[str | None] = mapped_column(String(260))
    api_key_hint: Mapped[str | None] = mapped_column(String(120))


class LLMProvider(TimestampMixin, Base):
    __tablename__ = "llm_providers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    provider: Mapped[str] = mapped_column(String(40), default="openai-compatible")
    base_url: Mapped[str] = mapped_column(String(260))
    model: Mapped[str] = mapped_column(String(120))
    temperature: Mapped[float] = mapped_column(Float, default=0.2)
    max_tokens: Mapped[int] = mapped_column(Integer, default=1600)
    timeout_seconds: Mapped[int] = mapped_column(Integer, default=60)
    api_key_hint: Mapped[str | None] = mapped_column(String(120))


class RetrievalConfig(TimestampMixin, Base):
    __tablename__ = "retrieval_configs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    dense_top_k: Mapped[int] = mapped_column(Integer, default=20)
    bm25_top_k: Mapped[int] = mapped_column(Integer, default=20)
    fusion_method: Mapped[str] = mapped_column(String(40), default="rrf")
    dense_weight: Mapped[float] = mapped_column(Float, default=0.7)
    bm25_weight: Mapped[float] = mapped_column(Float, default=0.3)
    rerank_candidate_k: Mapped[int] = mapped_column(Integer, default=20)
    rerank_top_k: Mapped[int] = mapped_column(Integer, default=5)
    final_top_k: Mapped[int] = mapped_column(Integer, default=5)
    chunk_size: Mapped[int] = mapped_column(Integer, default=900)
    chunk_overlap: Mapped[int] = mapped_column(Integer, default=120)


class RAGQuery(TimestampMixin, Base):
    __tablename__ = "rag_queries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    query_text: Mapped[str] = mapped_column(Text)
    filters_json: Mapped[str | None] = mapped_column(Text)
    intent: Mapped[str | None] = mapped_column(String(80))
    dense_latency_ms: Mapped[float | None] = mapped_column(Float)
    bm25_latency_ms: Mapped[float | None] = mapped_column(Float)
    fusion_latency_ms: Mapped[float | None] = mapped_column(Float)
    rerank_latency_ms: Mapped[float | None] = mapped_column(Float)
    llm_latency_ms: Mapped[float | None] = mapped_column(Float)
    total_latency_ms: Mapped[float | None] = mapped_column(Float)
    retrieved_count: Mapped[int] = mapped_column(Integer, default=0)
    citation_count: Mapped[int] = mapped_column(Integer, default=0)
    answer_hash: Mapped[str | None] = mapped_column(String(128))


class SystemConfig(TimestampMixin, Base):
    __tablename__ = "system_configs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    category: Mapped[str] = mapped_column(String(80), index=True)
    key: Mapped[str] = mapped_column(String(160), unique=True, index=True)
    value_text: Mapped[str | None] = mapped_column(Text)
    value_number: Mapped[float | None] = mapped_column(Float)
    description: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=False), default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=False), default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
