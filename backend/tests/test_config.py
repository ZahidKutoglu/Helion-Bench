import pytest
from pydantic import ValidationError

from app.core.config import Settings, clear_settings_cache, get_settings
from app.core.exceptions import ConfigurationError


def test_settings_load_from_environment(monkeypatch):
    monkeypatch.setenv(
        "DATABASE_URL",
        "postgresql+asyncpg://helion:helion@localhost:5432/helion_bench",
    )
    monkeypatch.setenv("LLM_PROVIDER", "dev")
    clear_settings_cache()
    settings = get_settings()
    assert settings.app_name
    assert settings.llm_provider == "dev"
    assert "asyncpg" in settings.database_url
    public = settings.public_config()
    assert "database_url" not in public
    assert public["qdrant_api_key_configured"] is False
    assert public["features"]["ingestion"] is True


def test_empty_qdrant_api_key_is_none():
    settings = Settings(
        database_url="postgresql+asyncpg://helion:helion@localhost:5432/helion_bench",
        qdrant_api_key="  ",
        _env_file=None,
    )
    assert settings.qdrant_api_key is None


def test_rejects_unsupported_database_url():
    with pytest.raises(ValidationError) as exc:
        Settings(database_url="mysql://localhost/helion", _env_file=None)
    assert "postgresql+asyncpg" in str(exc.value)


def test_accepts_sqlite_aiosqlite():
    settings = Settings(
        database_url="sqlite+aiosqlite:///./data/helion.db",
        _env_file=None,
    )
    assert settings.database_backend == "sqlite"


def test_rejects_sync_postgres_url():
    with pytest.raises(ValidationError) as exc:
        Settings(
            database_url="postgresql://helion:helion@localhost:5432/helion_bench",
            _env_file=None,
        )
    assert "asyncpg" in str(exc.value)


def test_default_database_url_is_sqlite():
    settings = Settings(_env_file=None)
    assert settings.database_url.startswith("sqlite+aiosqlite")


def test_get_settings_wraps_invalid_database_url(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "sqlite:///")
    clear_settings_cache()
    with pytest.raises(ConfigurationError) as exc:
        get_settings()
    assert exc.value.code == "configuration_error"
    assert "invalid" in exc.value.message.lower()
    clear_settings_cache()


def test_cors_origin_list_parsing():
    settings = Settings(
        database_url="postgresql+asyncpg://helion:helion@localhost:5432/helion_bench",
        cors_origins="http://localhost:5173, http://127.0.0.1:5173",
        _env_file=None,
    )
    assert settings.cors_origin_list == [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]
