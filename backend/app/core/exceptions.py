"""Typed application errors.

Route handlers raise these. FastAPI handlers turn them into JSON with
`error.code` and `error.message`.
"""


class AppError(Exception):
    def __init__(
        self,
        message: str,
        *,
        code: str,
        status_code: int = 400,
        details: dict | None = None,
    ) -> None:
        super().__init__(message)
        self.message = message
        self.code = code
        self.status_code = status_code
        self.details = details or {}


class ConfigurationError(AppError):
    def __init__(self, message: str, details: dict | None = None) -> None:
        super().__init__(
            message,
            code="configuration_error",
            status_code=500,
            details=details,
        )


class DependencyUnavailableError(AppError):
    def __init__(self, message: str, *, dependency: str, details: dict | None = None) -> None:
        super().__init__(
            message,
            code="dependency_unavailable",
            status_code=503,
            details={"dependency": dependency, **(details or {})},
        )


class NotFoundError(AppError):
    def __init__(self, message: str, details: dict | None = None) -> None:
        super().__init__(message, code="not_found", status_code=404, details=details)


class ConflictError(AppError):
    def __init__(self, message: str, details: dict | None = None) -> None:
        super().__init__(message, code="conflict", status_code=409, details=details)


class IngestionError(AppError):
    def __init__(self, message: str, details: dict | None = None) -> None:
        super().__init__(message, code="ingestion_error", status_code=400, details=details)
