"""Hybrid retrieval: hashed-vector cosine plus lexical overlap.

Scores are ranking signals, not calibrated probabilities.
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass

from qdrant_client.models import FieldCondition, Filter, MatchValue

from app.core.config import Settings
from app.core.constants import COLLECTION_NAME
from app.core.exceptions import IngestionError
from app.db.qdrant import ensure_collection, get_qdrant_client
from app.providers.embeddings.hashing import HashingEmbeddingProvider, tokenize

_STOP = {
    "the",
    "a",
    "an",
    "and",
    "or",
    "of",
    "in",
    "on",
    "for",
    "to",
    "why",
    "did",
    "what",
    "how",
    "with",
    "from",
}


@dataclass
class RetrievedChunk:
    document_id: str
    chunk_id: str
    title: str
    section: str | None
    content: str
    component: str
    document_type: str
    version: str
    source: str
    vector_score: float
    lexical_score: float
    combined_score: float


class RetrievalService:
    def __init__(
        self,
        settings: Settings,
        embedder: HashingEmbeddingProvider | None = None,
    ) -> None:
        self.settings = settings
        self.embedder = embedder or HashingEmbeddingProvider()

    async def search(
        self,
        query: str,
        *,
        k: int | None = None,
        component: str | None = None,
        document_type: str | None = None,
        version: str | None = None,
    ) -> list[RetrievedChunk]:
        cleaned = query.strip()
        if len(cleaned) < 2:
            raise IngestionError("Search query must be at least 2 characters.")
        top_k = min(k or self.settings.retrieval_default_k, self.settings.retrieval_max_k)
        vector = self.embedder.embed_one(cleaned)
        query_filter = _metadata_filter(component, document_type, version)
        fetch = max(top_k * 4, 12)

        def _query():
            client = get_qdrant_client()
            ensure_collection(client)
            return client.query_points(
                collection_name=COLLECTION_NAME,
                query=vector,
                query_filter=query_filter,
                limit=fetch,
                with_payload=True,
            )

        try:
            result = await asyncio.to_thread(_query)
        except Exception as exc:
            raise IngestionError(
                "Vector search failed. Check Qdrant on the System Status page."
            ) from exc

        points = getattr(result, "points", result)
        ranked: list[RetrievedChunk] = []
        for point in points:
            payload = point.payload or {}
            content = str(payload.get("content") or "")
            vector_score = float(point.score or 0.0)
            lexical = lexical_score(cleaned, content)
            combined = 0.4 * _clamp(vector_score) + 0.6 * lexical
            ranked.append(
                RetrievedChunk(
                    document_id=str(payload.get("document_id") or ""),
                    chunk_id=str(payload.get("chunk_id") or ""),
                    title=str(payload.get("title") or ""),
                    section=payload.get("section"),
                    content=content,
                    component=str(payload.get("component") or ""),
                    document_type=str(payload.get("document_type") or ""),
                    version=str(payload.get("version") or ""),
                    source=str(payload.get("source") or ""),
                    vector_score=round(vector_score, 4),
                    lexical_score=round(lexical, 4),
                    combined_score=round(combined, 4),
                )
            )
        ranked.sort(key=lambda item: item.combined_score, reverse=True)
        return [item for item in ranked if item.combined_score >= 0.16][:top_k]


def lexical_score(query: str, content: str) -> float:
    query_tokens = [token for token in tokenize(query) if token not in _STOP]
    if not query_tokens:
        return 0.0
    content_tokens = set(tokenize(content))
    hits = sum(1 for token in query_tokens if token in content_tokens)
    phrase_bonus = 0.15 if query.lower() in content.lower() else 0.0
    return min(1.0, hits / len(query_tokens) + phrase_bonus)


def _metadata_filter(component, document_type, version) -> Filter | None:
    conditions = []
    if component:
        conditions.append(FieldCondition(key="component", match=MatchValue(value=component)))
    if document_type:
        conditions.append(
            FieldCondition(key="document_type", match=MatchValue(value=document_type))
        )
    if version:
        conditions.append(FieldCondition(key="version", match=MatchValue(value=version)))
    if not conditions:
        return None
    return Filter(must=conditions)


def _clamp(value: float) -> float:
    return max(0.0, min(1.0, value))
