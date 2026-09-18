"""Shared test fixtures.

Tests use SQLite and in-memory Qdrant so they do not need Docker.
"""

import os

os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///./.pytest-helion.db"
os.environ["QDRANT_MODE"] = "memory"
os.environ["ENVIRONMENT"] = "development"
os.environ["LOG_LEVEL"] = "WARNING"
os.environ["LOG_FORMAT"] = "json"
os.environ["LLM_PROVIDER"] = "dev"
os.environ["EMBEDDING_PROVIDER"] = "dev"

import pytest
from fastapi.testclient import TestClient

from app.api.deps import get_health_service
from app.core.config import clear_settings_cache, get_settings
from app.db.qdrant import close_qdrant_client
from app.main import app
from app.services.health import HealthService


@pytest.fixture
def settings():
    clear_settings_cache()
    return get_settings()


def _override_health_service(settings, database_checker, qdrant_checker) -> TestClient:
    service = HealthService(
        settings=settings,
        database_checker=database_checker,
        qdrant_checker=qdrant_checker,
    )
    app.dependency_overrides[get_health_service] = lambda: service
    return TestClient(app)


@pytest.fixture
def client_healthy(settings):
    async def database_ok() -> None:
        return None

    async def qdrant_ok() -> None:
        return None

    client = _override_health_service(settings, database_ok, qdrant_ok)
    with client:
        yield client
    app.dependency_overrides.clear()


@pytest.fixture
def client_dependencies_down(settings):
    async def database_fail() -> None:
        raise ConnectionError("connection refused to postgresql")

    async def qdrant_fail() -> None:
        raise TimeoutError("qdrant timed out")

    client = _override_health_service(settings, database_fail, qdrant_fail)
    with client:
        yield client
    app.dependency_overrides.clear()


@pytest.fixture
def api_client():
    clear_settings_cache()
    with TestClient(app) as client:
        yield client
    app.dependency_overrides.clear()


@pytest.fixture(scope="session", autouse=True)
def _cleanup_clients():
    yield
    close_qdrant_client()
