from datetime import UTC, datetime

import pytest

from app.core.exceptions import AppError, ConfigurationError
from app.schemas.errors import ErrorResponse
from app.schemas.health import ComponentStatus
from app.services.health import HealthService


class FakeSettings:
    app_version = "0.1.0"
    environment = "development"

    def public_config(self) -> dict:
        return {
            "app_name": "Helion Bench",
            "version": "0.1.0",
            "environment": "development",
            "log_level": "INFO",
            "log_format": "console",
            "llm_provider": "dev",
            "embedding_provider": "dev",
            "qdrant_url_configured": True,
            "qdrant_api_key_configured": False,
            "database_configured": True,
            "cors_origins": ["http://localhost:5173"],
            "phase": 1,
            "features": {
                "ingestion": False,
                "retrieval": False,
                "generation": False,
                "evaluation": False,
            },
        }


async def _ok() -> None:
    return None


async def _fail() -> None:
    raise RuntimeError("synthetic failure")


@pytest.mark.asyncio
async def test_readiness_ok_when_both_dependencies_pass():
    service = HealthService(FakeSettings(), _ok, _ok)
    result = await service.readiness()
    assert result.status == ComponentStatus.ok
    assert all(item.status == ComponentStatus.ok for item in result.components)


@pytest.mark.asyncio
async def test_readiness_error_when_qdrant_fails():
    service = HealthService(FakeSettings(), _ok, _fail)
    result = await service.readiness()
    assert result.status == ComponentStatus.error
    qdrant = next(item for item in result.components if item.name == "qdrant")
    assert qdrant.status == ComponentStatus.error
    assert "synthetic failure" in qdrant.message
    assert qdrant.latency_ms is not None


def test_api_health_timestamp_is_timezone_aware():
    service = HealthService(FakeSettings(), _ok, _ok)
    health = service.api_health()
    assert health.time.tzinfo is not None
    assert health.time <= datetime.now(UTC)


def test_error_envelope_shape():
    error = AppError("broken", code="test_error", status_code=400, details={"field": "x"})
    body = ErrorResponse.model_validate(
        {"error": {"code": error.code, "message": error.message, "details": error.details}}
    )
    assert body.error.code == "test_error"
    assert body.error.details["field"] == "x"


def test_configuration_error_status():
    error = ConfigurationError("bad config")
    assert error.status_code == 500
    assert error.code == "configuration_error"
