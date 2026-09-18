"""Qdrant client factory.

Modes:
- remote: HTTP server (Docker Compose)
- local: embedded Qdrant stored on disk (no Docker)
- memory: in-process, used by tests
- auto: try remote, fall back to local disk

The local/memory modes are real Qdrant engines, not fake search.
"""

from pathlib import Path

from qdrant_client import QdrantClient
from qdrant_client.http.exceptions import UnexpectedResponse
from qdrant_client.models import Distance, VectorParams

from app.core.config import get_settings
from app.core.constants import COLLECTION_NAME, VECTOR_SIZE
from app.core.logging import get_logger
from app.db.session import project_root

logger = get_logger("helion.qdrant")

_client: QdrantClient | None = None
_active_mode: str | None = None


def active_qdrant_mode() -> str:
    return _active_mode or get_settings().qdrant_mode


def _remote_client(settings) -> QdrantClient:
    kwargs: dict = {
        "url": settings.qdrant_url,
        "timeout": settings.qdrant_timeout_seconds,
    }
    if settings.qdrant_api_key:
        kwargs["api_key"] = settings.qdrant_api_key
    return QdrantClient(**kwargs)


def _local_client(settings) -> QdrantClient:
    path = Path(settings.qdrant_path)
    if not path.is_absolute():
        path = project_root() / path
    path.mkdir(parents=True, exist_ok=True)
    return QdrantClient(path=str(path))


def get_qdrant_client() -> QdrantClient:
    global _client, _active_mode
    if _client is not None:
        return _client

    settings = get_settings()
    mode = settings.qdrant_mode

    if mode == "memory":
        _client = QdrantClient(":memory:")
        _active_mode = "memory"
    elif mode == "local":
        _client = _local_client(settings)
        _active_mode = "local"
    elif mode == "remote":
        _client = _remote_client(settings)
        _active_mode = "remote"
    else:
        remote = _remote_client(settings)
        try:
            remote.get_collections()
            _client = remote
            _active_mode = "remote"
            logger.info("qdrant_using_remote", url=settings.qdrant_url)
        except Exception as exc:
            logger.warning(
                "qdrant_remote_unavailable_using_local",
                error=str(exc),
            )
            try:
                remote.close()
            except Exception:
                pass
            _client = _local_client(settings)
            _active_mode = "local"

    ensure_collection(_client)
    return _client


def ensure_collection(client: QdrantClient | None = None) -> None:
    client = client or get_qdrant_client()
    try:
        existing = {item.name for item in client.get_collections().collections}
    except UnexpectedResponse:
        existing = set()
    if COLLECTION_NAME in existing:
        return
    client.create_collection(
        collection_name=COLLECTION_NAME,
        vectors_config=VectorParams(size=VECTOR_SIZE, distance=Distance.COSINE),
    )
    logger.info("qdrant_collection_created", collection=COLLECTION_NAME)


def ping_qdrant() -> None:
    client = get_qdrant_client()
    client.get_collections()


def close_qdrant_client() -> None:
    global _client, _active_mode
    if _client is not None:
        _client.close()
    _client = None
    _active_mode = None
