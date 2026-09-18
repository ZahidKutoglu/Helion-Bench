"""Application settings.

Pydantic Settings reads environment variables (and an optional .env file)
into a typed object. Secrets stay in the environment, never in source.
"""

from functools import lru_cache
from typing import Literal

from pydantic import Field, ValidationError, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

from app.core.exceptions import ConfigurationError


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=("../.env", ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    app_name: str = "Helion Bench"
    app_version: str = "0.2.0"
    environment: str = "development"
    log_level: str = "INFO"
    log_format: Literal["console", "json"] = "console"

    api_host: str = "0.0.0.0"
    api_port: int = 8000
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    # Async SQLAlchemy URL. Postgres is preferred; SQLite is the local fallback.
    database_url: str = Field(
        default="sqlite+aiosqlite:///../data/helion.db",
        description="SQLAlchemy async URL (postgresql+asyncpg or sqlite+aiosqlite)",
    )
    db_pool_size: int = 5
    db_echo: bool = False

    qdrant_mode: Literal["auto", "local", "remote", "memory"] = "auto"
    qdrant_url: str = "http://localhost:6333"
    qdrant_api_key: str | None = None
    qdrant_timeout_seconds: float = 5.0
    qdrant_path: str = "../data/qdrant"

    llm_provider: str = "dev"
    embedding_provider: str = "dev"
    openai_api_key: str | None = None
    openai_base_url: str = "https://api.openai.com/v1"
    openai_model: str = "gpt-4o-mini"
    llm_timeout_seconds: float = 30.0

    max_upload_bytes: int = 2_000_000
    chunk_size_chars: int = 1200
    chunk_overlap_chars: int = 160
    retrieval_default_k: int = 8
    retrieval_max_k: int = 20

    @field_validator("database_url")
    @classmethod
    def database_url_must_be_async(cls, value: str) -> str:
        if value.startswith("postgresql") and "+asyncpg" not in value:
            raise ValueError(
                "PostgreSQL DATABASE_URL must use the asyncpg driver (postgresql+asyncpg://...)."
            )
        if value.startswith("sqlite") and "+aiosqlite" not in value:
            raise ValueError("SQLite DATABASE_URL must use aiosqlite (sqlite+aiosqlite:///...).")
        if not (value.startswith("postgresql") or value.startswith("sqlite")):
            raise ValueError(
                "DATABASE_URL must be postgresql+asyncpg://... or sqlite+aiosqlite:///..."
            )
        return value

    @field_validator("qdrant_api_key", "openai_api_key", mode="before")
    @classmethod
    def empty_secret_becomes_none(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = str(value).strip()
        return stripped or None

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def is_development(self) -> bool:
        return self.environment.lower() in {"development", "dev", "local"}

    @property
    def database_backend(self) -> str:
        if self.database_url.startswith("sqlite"):
            return "sqlite"
        return "postgresql"

    @property
    def llm_provider_resolved(self) -> str:
        if self.llm_provider in {"openai", "openai_compatible"} and not self.openai_api_key:
            return "dev"
        return self.llm_provider

    def public_config(self) -> dict[str, object]:
        """Values that are safe to show in the UI. Secrets are never included."""
        return {
            "app_name": self.app_name,
            "version": self.app_version,
            "environment": self.environment,
            "log_level": self.log_level,
            "log_format": self.log_format,
            "llm_provider": self.llm_provider_resolved,
            "llm_provider_requested": self.llm_provider,
            "embedding_provider": self.embedding_provider,
            "database_backend": self.database_backend,
            "qdrant_mode": self.qdrant_mode,
            "qdrant_url_configured": bool(self.qdrant_url),
            "qdrant_api_key_configured": bool(self.qdrant_api_key),
            "openai_api_key_configured": bool(self.openai_api_key),
            "database_configured": bool(self.database_url),
            "cors_origins": self.cors_origin_list,
            "phase": 2,
            "features": {
                "ingestion": True,
                "retrieval": True,
                "generation": True,
                "evaluation": True,
            },
        }


@lru_cache
def get_settings() -> Settings:
    try:
        return Settings()
    except ValidationError as exc:
        raise ConfigurationError(
            "Application configuration is invalid. Check .env against .env.example.",
            details={"errors": exc.errors(include_url=False, include_input=False)},
        ) from exc


def clear_settings_cache() -> None:
    get_settings.cache_clear()
