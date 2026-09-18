"""FastAPI dependencies.

Dependencies are small functions FastAPI calls before a route runs.
They are how we inject settings, database sessions, and services into
handlers without constructing them inside every endpoint.
"""

from collections.abc import Awaitable, Callable

from fastapi import Depends

from app.core.config import Settings, get_settings
from app.db.qdrant import ping_qdrant
from app.db.session import ping_database
from app.services.health import HealthService


async def _database_checker() -> None:
    await ping_database()


async def _qdrant_checker() -> None:
    # QdrantClient is synchronous. Run it directly; the call is a short HTTP ping.
    ping_qdrant()


def get_health_service(settings: Settings = Depends(get_settings)) -> HealthService:
    return HealthService(
        settings=settings,
        database_checker=_database_checker,
        qdrant_checker=_qdrant_checker,
    )


HealthServiceDep = HealthService
SettingsDep = Settings
Checker = Callable[[], Awaitable[None]]
