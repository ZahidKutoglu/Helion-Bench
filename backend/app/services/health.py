"""Health check service.

Route handlers stay thin: they call this service and return its result.
A checker can be swapped in tests so we do not need live Postgres or Qdrant
for unit tests.
"""

from collections.abc import Awaitable, Callable
from datetime import UTC, datetime
from time import perf_counter

from app.core.config import Settings
from app.schemas.health import (
    ComponentStatus,
    DependencyHealth,
    HealthResponse,
    ReadyResponse,
    SystemInfoResponse,
)

Checker = Callable[[], Awaitable[None]]


async def _run_checker(name: str, checker: Checker) -> DependencyHealth:
    started = perf_counter()
    checked_at = datetime.now(UTC)
    try:
        await checker()
        latency_ms = round((perf_counter() - started) * 1000, 2)
        return DependencyHealth(
            name=name,
            status=ComponentStatus.ok,
            latency_ms=latency_ms,
            message="Reachable.",
            checked_at=checked_at,
        )
    except Exception as exc:
        latency_ms = round((perf_counter() - started) * 1000, 2)
        return DependencyHealth(
            name=name,
            status=ComponentStatus.error,
            latency_ms=latency_ms,
            message=str(exc) or exc.__class__.__name__,
            checked_at=checked_at,
        )


class HealthService:
    def __init__(
        self,
        settings: Settings,
        database_checker: Checker,
        qdrant_checker: Checker,
    ) -> None:
        self._settings = settings
        self._database_checker = database_checker
        self._qdrant_checker = qdrant_checker

    def api_health(self) -> HealthResponse:
        return HealthResponse(
            status=ComponentStatus.ok,
            service="helion-bench-api",
            version=self._settings.app_version,
            environment=self._settings.environment,
            time=datetime.now(UTC),
        )

    async def database_health(self) -> DependencyHealth:
        result = await _run_checker("database", self._database_checker)
        backend = getattr(self._settings, "database_backend", "database")
        if result.status == ComponentStatus.ok:
            result.message = f"Reachable ({backend})."
        return result

    async def qdrant_health(self) -> DependencyHealth:
        return await _run_checker("qdrant", self._qdrant_checker)

    async def readiness(self) -> ReadyResponse:
        api = DependencyHealth(
            name="api",
            status=ComponentStatus.ok,
            latency_ms=0.0,
            message="Process is running.",
            checked_at=datetime.now(UTC),
        )
        database = await self.database_health()
        qdrant = await self.qdrant_health()
        components = [api, database, qdrant]
        overall = (
            ComponentStatus.ok
            if all(item.status == ComponentStatus.ok for item in components)
            else ComponentStatus.error
        )
        return ReadyResponse(status=overall, components=components)

    def system_info(self) -> SystemInfoResponse:
        return SystemInfoResponse.model_validate(self._settings.public_config())
