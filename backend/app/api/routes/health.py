from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_health_service
from app.core.config import Settings, get_settings
from app.db.qdrant import active_qdrant_mode
from app.db.session import get_db
from app.providers.embeddings.factory import get_embedding_provider
from app.providers.llm.factory import get_llm_provider
from app.repositories import DocumentRepository
from app.schemas.health import (
    ComponentStatus,
    DependencyHealth,
    HealthResponse,
    ReadyResponse,
    SystemInfoResponse,
)
from app.services.health import HealthService

router = APIRouter(tags=["health"])


def _status_code(component_status: ComponentStatus) -> int:
    if component_status == ComponentStatus.ok:
        return status.HTTP_200_OK
    return status.HTTP_503_SERVICE_UNAVAILABLE


@router.get(
    "/health",
    response_model=HealthResponse,
    summary="API liveness",
)
async def api_health(
    service: HealthService = Depends(get_health_service),
) -> HealthResponse:
    """Process is running. Does not check Postgres or Qdrant."""
    return service.api_health()


@router.get(
    "/health/database",
    response_model=DependencyHealth,
    summary="PostgreSQL connectivity",
)
async def database_health(
    service: HealthService = Depends(get_health_service),
) -> JSONResponse:
    result = await service.database_health()
    return JSONResponse(
        status_code=_status_code(result.status),
        content=result.model_dump(mode="json"),
    )


@router.get(
    "/health/qdrant",
    response_model=DependencyHealth,
    summary="Qdrant connectivity",
)
async def qdrant_health(
    service: HealthService = Depends(get_health_service),
) -> JSONResponse:
    result = await service.qdrant_health()
    return JSONResponse(
        status_code=_status_code(result.status),
        content=result.model_dump(mode="json"),
    )


@router.get(
    "/health/ready",
    response_model=ReadyResponse,
    summary="Readiness of API, PostgreSQL, and Qdrant",
)
async def ready(
    service: HealthService = Depends(get_health_service),
) -> JSONResponse:
    result = await service.readiness()
    return JSONResponse(
        status_code=_status_code(result.status),
        content=result.model_dump(mode="json"),
    )


@router.get(
    "/api/v1/system/info",
    response_model=SystemInfoResponse,
    summary="Non-secret runtime configuration",
)
async def system_info(
    service: HealthService = Depends(get_health_service),
) -> SystemInfoResponse:
    return service.system_info()


@router.get("/api/v1/system/ingestion")
async def ingestion_summary(session: AsyncSession = Depends(get_db)) -> dict:
    return await DocumentRepository(session).ingestion_summary()


@router.get("/api/v1/system/providers")
async def provider_status(settings: Settings = Depends(get_settings)) -> dict:
    llm = get_llm_provider(settings)
    embedder = get_embedding_provider(settings)
    llm_state = "healthy"
    llm_message = getattr(llm, "description", llm.name)
    if settings.llm_provider in {"openai", "openai_compatible"} and not settings.openai_api_key:
        llm_state = "not_configured"
        llm_message = "OPENAI_API_KEY is not set. Using the labeled development responder."
    elif settings.llm_provider == "dev":
        llm_state = "degraded"
        llm_message = getattr(
            llm,
            "description",
            "Labeled development responder. Not a neural language model.",
        )
    embed_state = "healthy"
    embed_message = getattr(
        embedder,
        "description",
        "Deterministic hashed n-gram embeddings (development fallback).",
    )
    if settings.embedding_provider == "dev":
        embed_state = "degraded"
    return {
        "llm": {
            "name": getattr(llm, "name", "unknown"),
            "state": llm_state,
            "message": llm_message,
        },
        "embeddings": {
            "name": getattr(embedder, "name", "unknown"),
            "state": embed_state,
            "message": embed_message,
        },
        "qdrant_mode": active_qdrant_mode(),
        "database_backend": settings.database_backend,
    }
