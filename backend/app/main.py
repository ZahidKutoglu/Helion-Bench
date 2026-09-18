"""FastAPI application entrypoint.

uvicorn loads `app.main:app`. The lifespan function runs once at startup
and once at shutdown: configure logging, then dispose database connections.

If configuration is invalid, the process exits with a readable message
instead of a stack trace about missing environment variables.
"""

from __future__ import annotations

import sys
import time
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from uuid import uuid4

import structlog
from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api.routes import api_router
from app.core.config import get_settings
from app.core.exceptions import AppError, ConfigurationError
from app.core.logging import configure_logging, get_logger
from app.db.qdrant import close_qdrant_client, get_qdrant_client
from app.db.session import dispose_engine, init_database
from app.schemas.errors import ErrorBody, ErrorResponse

logger = get_logger("helion")


def _exit_on_bad_config() -> None:
    try:
        get_settings()
    except ConfigurationError as exc:
        sys.stderr.write(f"\nConfiguration error: {exc.message}\n")
        for error in exc.details.get("errors", []):
            location = ".".join(str(part) for part in error.get("loc", []))
            sys.stderr.write(f"  - {location}: {error.get('msg')}\n")
        sys.stderr.write("Copy .env.example to .env and set DATABASE_URL before starting.\n\n")
        raise SystemExit(1) from exc


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    configure_logging(settings)
    logger.info(
        "api_starting",
        version=settings.app_version,
        environment=settings.environment,
    )
    await init_database()
    get_qdrant_client()
    logger.info("storage_ready", database=settings.database_backend)
    yield
    await dispose_engine()
    close_qdrant_client()
    logger.info("api_stopped")


def create_app() -> FastAPI:
    _exit_on_bad_config()
    settings = get_settings()

    application = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        description=(
            "Engineering intelligence platform for a fictional wireless sensing "
            "and communications verification lab. All data is synthetic."
        ),
        lifespan=lifespan,
        docs_url="/docs",
        redoc_url="/redoc",
    )

    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @application.middleware("http")
    async def add_request_context(request: Request, call_next):
        request_id = request.headers.get("X-Request-ID", str(uuid4()))
        structlog.contextvars.clear_contextvars()
        structlog.contextvars.bind_contextvars(
            request_id=request_id,
            method=request.method,
            path=request.url.path,
        )
        started = time.perf_counter()
        try:
            response = await call_next(request)
        except Exception:
            logger.exception("unhandled_request_error")
            raise
        duration_ms = round((time.perf_counter() - started) * 1000, 2)
        response.headers["X-Request-ID"] = request_id
        logger.info("request_completed", status_code=response.status_code, duration_ms=duration_ms)
        return response

    @application.exception_handler(AppError)
    async def app_error_handler(_request: Request, exc: AppError) -> JSONResponse:
        logger.warning("app_error", code=exc.code, message=exc.message)
        body = ErrorResponse(
            error=ErrorBody(code=exc.code, message=exc.message, details=exc.details)
        )
        return JSONResponse(status_code=exc.status_code, content=body.model_dump())

    @application.exception_handler(RequestValidationError)
    async def validation_handler(_request: Request, exc: RequestValidationError) -> JSONResponse:
        body = ErrorResponse(
            error=ErrorBody(
                code="validation_error",
                message="Request failed validation.",
                details={"errors": jsonable_encoder(exc.errors())},
            )
        )
        return JSONResponse(status_code=422, content=body.model_dump())

    @application.exception_handler(StarletteHTTPException)
    async def http_exception_handler(
        _request: Request,
        exc: StarletteHTTPException,
    ) -> JSONResponse:
        body = ErrorResponse(
            error=ErrorBody(
                code="http_error",
                message=str(exc.detail),
                details={"status_code": exc.status_code},
            )
        )
        return JSONResponse(status_code=exc.status_code, content=body.model_dump())

    @application.exception_handler(Exception)
    async def unhandled_handler(_request: Request, exc: Exception) -> JSONResponse:
        logger.exception("unhandled_exception", error_type=type(exc).__name__)
        body = ErrorResponse(
            error=ErrorBody(
                code="internal_error",
                message="An unexpected error occurred.",
                details={},
            )
        )
        return JSONResponse(status_code=500, content=body.model_dump())

    application.include_router(api_router)
    return application


app = create_app()
