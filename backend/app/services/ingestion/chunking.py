"""Split engineering documents into overlapping chunks.

Markdown headings start a new section. Paragraphs are packed until
chunk_size_chars is reached, then the next chunk overlaps by
chunk_overlap_chars so sentences on a boundary are not lost.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

_HEADING = re.compile(r"^(#{1,6})\s+(.*)$")


@dataclass(frozen=True)
class TextChunk:
    ordinal: int
    section: str | None
    content: str


def chunk_document(
    text: str,
    *,
    chunk_size: int = 1200,
    overlap: int = 160,
) -> list[TextChunk]:
    cleaned = text.replace("\r\n", "\n").strip()
    if not cleaned:
        return []

    sections = _split_sections(cleaned)
    packed: list[tuple[str | None, str]] = []
    for section, body in sections:
        packed.extend((section, piece) for piece in _pack(body, chunk_size, overlap))

    return [
        TextChunk(ordinal=index, section=section, content=content)
        for index, (section, content) in enumerate(packed)
        if content.strip()
    ]


def _split_sections(text: str) -> list[tuple[str | None, str]]:
    lines = text.split("\n")
    sections: list[tuple[str | None, list[str]]] = [(None, [])]
    for line in lines:
        match = _HEADING.match(line)
        if match:
            title = match.group(2).strip()
            sections.append((title, [line]))
        else:
            sections[-1][1].append(line)
    result: list[tuple[str | None, str]] = []
    for title, body_lines in sections:
        body = "\n".join(body_lines).strip()
        if body:
            result.append((title, body))
    return result or [(None, text)]


def _pack(text: str, chunk_size: int, overlap: int) -> list[str]:
    if len(text) <= chunk_size:
        return [text]
    paragraphs = [part.strip() for part in re.split(r"\n\s*\n", text) if part.strip()]
    chunks: list[str] = []
    current = ""
    for paragraph in paragraphs or [text]:
        candidate = paragraph if not current else f"{current}\n\n{paragraph}"
        if len(candidate) <= chunk_size:
            current = candidate
            continue
        if current:
            chunks.append(current)
            current = _overlap_suffix(current, overlap)
            current = paragraph if not current else f"{current}\n\n{paragraph}"
            if len(current) > chunk_size:
                chunks.extend(_split_long(current, chunk_size, overlap))
                current = _overlap_suffix(chunks[-1], overlap)
        else:
            pieces = _split_long(paragraph, chunk_size, overlap)
            chunks.extend(pieces)
            current = _overlap_suffix(pieces[-1], overlap)
    if current.strip():
        chunks.append(current.strip())
    return chunks


def _split_long(text: str, chunk_size: int, overlap: int) -> list[str]:
    pieces: list[str] = []
    start = 0
    while start < len(text):
        end = min(len(text), start + chunk_size)
        pieces.append(text[start:end].strip())
        if end >= len(text):
            break
        start = max(0, end - overlap)
    return [piece for piece in pieces if piece]


def _overlap_suffix(text: str, overlap: int) -> str:
    if overlap <= 0 or len(text) <= overlap:
        return text
    return text[-overlap:].lstrip()
