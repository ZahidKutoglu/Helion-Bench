"""Optional live checks against Docker Compose services.

These tests are skipped unless HELION_INTEGRATION=1 is set and the
services actually accept connections. Unit tests do not require Docker.
"""

import os

import pytest

from app.db.qdrant import close_qdrant_client, ping_qdrant
from app.db.session import dispose_engine, ping_database

RUN_LIVE = os.getenv("HELION_INTEGRATION") == "1"

pytestmark = pytest.mark.skipif(
    not RUN_LIVE,
    reason="Set HELION_INTEGRATION=1 after `docker compose up -d postgres qdrant`.",
)


@pytest.mark.asyncio
async def test_live_postgres_ping():
    try:
        await ping_database()
    finally:
        await dispose_engine()


def test_live_qdrant_ping():
    try:
        ping_qdrant()
    finally:
        close_qdrant_client()
