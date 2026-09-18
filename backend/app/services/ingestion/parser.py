"""Extract text and metadata from uploaded Markdown, TXT, and JSON files."""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass, field

from app.core.constants import COMPONENTS, DOCUMENT_TYPES
from app.core.exceptions import IngestionError

ALLOWED_EXTENSIONS = {".md", ".markdown", ".txt", ".json"}


@dataclass
class ParsedDocument:
    title: str
    content: str
    document_type: str
    component: str
    version: str
    source: str
    tags: list[str] = field(default_factory=list)
    filename: str | None = None

    @property
    def content_hash(self) -> str:
        normalized = "\n".join(line.rstrip() for line in self.content.strip().splitlines())
        return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


def parse_upload(
    *,
    filename: str,
    data: bytes,
    title: str | None = None,
    document_type: str | None = None,
    component: str | None = None,
    version: str | None = None,
    source: str | None = None,
) -> ParsedDocument:
    if not data or not data.strip():
        raise IngestionError("The file is empty.")
    suffix = _extension(filename)
    if suffix not in ALLOWED_EXTENSIONS:
        raise IngestionError(
            "Unsupported file type. Upload Markdown (.md), text (.txt), or JSON (.json)."
        )
    try:
        text = data.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise IngestionError("The file is not valid UTF-8 text.") from exc

    metadata: dict = {}
    content = text
    if suffix == ".json":
        content, metadata = _parse_json(text)

    resolved_type = _normalize_choice(
        document_type or metadata.get("document_type") or metadata.get("type"),
        DOCUMENT_TYPES,
        "document_type",
        default="component_documentation",
    )
    resolved_component = _normalize_choice(
        component or metadata.get("component"),
        COMPONENTS,
        "component",
        default="Verification Framework",
    )
    resolved_title = (
        title
        or metadata.get("title")
        or _title_from_markdown(content)
        or filename.rsplit(".", 1)[0]
    )
    resolved_version = str(
        version or metadata.get("version") or metadata.get("build") or "unspecified"
    )
    resolved_source = str(source or metadata.get("source") or filename)
    tags = metadata.get("tags") or []
    if isinstance(tags, str):
        tags = [part.strip() for part in tags.split(",") if part.strip()]

    return ParsedDocument(
        title=str(resolved_title).strip()[:500],
        content=content.strip(),
        document_type=resolved_type,
        component=resolved_component,
        version=resolved_version[:64],
        source=str(resolved_source)[:255],
        tags=[str(tag) for tag in tags][:20],
        filename=filename,
    )


def _parse_json(text: str) -> tuple[str, dict]:
    try:
        payload = json.loads(text)
    except json.JSONDecodeError as exc:
        raise IngestionError("The JSON file is malformed.") from exc

    if isinstance(payload, str):
        return payload, {}
    if isinstance(payload, list):
        lines = []
        for item in payload:
            if isinstance(item, dict):
                lines.append(json.dumps(item, indent=2))
            else:
                lines.append(str(item))
        return "\n\n".join(lines), {}
    if not isinstance(payload, dict):
        raise IngestionError("JSON must be an object, array, or string.")

    content = payload.get("content") or payload.get("body") or payload.get("text")
    if not content:
        reserved = {
            "title",
            "document_type",
            "type",
            "component",
            "version",
            "build",
            "source",
            "tags",
        }
        leftover = {key: value for key, value in payload.items() if key not in reserved}
        content = json.dumps(leftover or payload, indent=2)
    if not isinstance(content, str):
        content = json.dumps(content, indent=2)
    return content, payload


def _title_from_markdown(content: str) -> str | None:
    for line in content.splitlines():
        stripped = line.strip()
        if stripped.startswith("# "):
            return stripped[2:].strip()
    return None


def _extension(filename: str) -> str:
    name = filename.lower().strip()
    if "." not in name:
        return ""
    return "." + name.rsplit(".", 1)[-1]


def _normalize_choice(value: str | None, allowed: tuple[str, ...], field: str, default: str) -> str:
    if value is None or str(value).strip() == "":
        return default
    raw = str(value).strip()
    lookup = {item.lower(): item for item in allowed}
    slug = raw.lower().replace("_", " ").replace("-", " ")
    if raw in allowed:
        return raw
    if raw.lower() in lookup:
        return lookup[raw.lower()]
    if slug in {item.lower() for item in allowed}:
        return next(item for item in allowed if item.lower() == slug)
    raise IngestionError(f"Invalid {field} '{value}'. Allowed values: {', '.join(allowed)}.")
