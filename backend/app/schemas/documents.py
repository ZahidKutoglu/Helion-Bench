from datetime import datetime

from pydantic import BaseModel, Field

from app.core.constants import COMPONENTS, DOCUMENT_TYPES


class DocumentOut(BaseModel):
    id: str
    title: str
    document_type: str
    component: str
    version: str
    source: str
    filename: str | None
    tags: list
    status: str
    error_message: str | None
    chunk_count: int
    created_at: datetime
    updated_at: datetime
    indexed_at: datetime | None

    model_config = {"from_attributes": True}


class ChunkOut(BaseModel):
    id: str
    ordinal: int
    section: str | None
    content: str
    token_count: int

    model_config = {"from_attributes": True}


class DocumentDetail(DocumentOut):
    content: str
    content_hash: str
    chunks: list[ChunkOut] = Field(default_factory=list)


class DocumentList(BaseModel):
    items: list[DocumentOut]
    total: int
    limit: int
    offset: int


class CatalogResponse(BaseModel):
    components: list[str] = list(COMPONENTS)
    document_types: list[str] = list(DOCUMENT_TYPES)
    versions: list[str] = Field(default_factory=list)


class SearchRequest(BaseModel):
    query: str = Field(min_length=2, max_length=2000)
    k: int | None = Field(default=None, ge=1, le=20)
    component: str | None = None
    document_type: str | None = None
    version: str | None = None


class SearchHit(BaseModel):
    document_id: str
    chunk_id: str
    title: str
    section: str | None
    content: str
    component: str
    document_type: str
    version: str
    source: str
    vector_score: float
    lexical_score: float
    combined_score: float
    score_note: str = (
        "combined_score ranks results. It is not a calibrated probability. "
        "vector_score is cosine similarity of hashed n-gram embeddings. "
        "lexical_score is query-token overlap."
    )


class SearchResponse(BaseModel):
    query: str
    hits: list[SearchHit]
    embedding_provider: str


class InvestigateRequest(BaseModel):
    question: str = Field(min_length=8, max_length=4000)
    k: int | None = Field(default=None, ge=1, le=20)
    component: str | None = None
    document_type: str | None = None
    version: str | None = None


class InvestigationOut(BaseModel):
    id: str
    question: str
    filters: dict
    answer: str
    key_findings: list
    hypotheses: list
    missing_information: list
    citations: list
    evidence_coverage: str
    provider: str
    provider_note: str | None
    retrieved_chunk_ids: list
    created_at: datetime

    model_config = {"from_attributes": True}


class EvaluationRunOut(BaseModel):
    id: str
    k: int
    case_count: int
    failed_count: int
    recall_at_k: float | None
    citation_validity_rate: float | None
    retrieval_hit_rate: float | None
    supported_answer_rate: float | None
    provider: str
    cases: list
    notes: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class EvaluationRunRequest(BaseModel):
    k: int | None = Field(default=None, ge=1, le=20)
