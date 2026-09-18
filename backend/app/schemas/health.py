"""Pydantic response models for health and system info.

These are the API contract. FastAPI uses them to validate outgoing data
and to generate OpenAPI documentation at /docs.
"""

from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel


class ComponentStatus(StrEnum):
    ok = "ok"
    error = "error"


class HealthResponse(BaseModel):
    status: ComponentStatus
    service: str
    version: str
    environment: str
    time: datetime


class DependencyHealth(BaseModel):
    name: str
    status: ComponentStatus
    latency_ms: float | None = None
    message: str
    checked_at: datetime


class ReadyResponse(BaseModel):
    status: ComponentStatus
    components: list[DependencyHealth]


class FeatureFlags(BaseModel):
    ingestion: bool
    retrieval: bool
    generation: bool
    evaluation: bool


class SystemInfoResponse(BaseModel):
    model_config = {"extra": "allow"}

    app_name: str
    version: str
    environment: str
    log_level: str
    log_format: str
    llm_provider: str
    embedding_provider: str
    qdrant_url_configured: bool
    qdrant_api_key_configured: bool
    database_configured: bool
    cors_origins: list[str]
    phase: int
    features: FeatureFlags
