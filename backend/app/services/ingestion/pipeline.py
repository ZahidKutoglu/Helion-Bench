"""Ingest a parsed document: persist, chunk, embed, upsert to Qdrant."""

from __future__ import annotations

import asyncio
import uuid
from datetime import UTC, datetime

from qdrant_client.models import FieldCondition, Filter, FilterSelector, MatchValue, PointStruct
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.core.constants import COLLECTION_NAME, VECTOR_SIZE
from app.core.exceptions import ConflictError, IngestionError, NotFoundError
from app.core.logging import get_logger
from app.db.qdrant import ensure_collection, get_qdrant_client
from app.domain.models import Chunk, Document
from app.domain.models.entities import utcnow
from app.providers.embeddings.hashing import HashingEmbeddingProvider
from app.repositories import DocumentRepository
from app.services.ingestion.chunking import chunk_document
from app.services.ingestion.parser import ParsedDocument

logger = get_logger("helion.ingestion")


def _point_id(chunk_id: str) -> str:
    return str(uuid.uuid5(uuid.NAMESPACE_URL, chunk_id))


class IngestionService:
    def __init__(
        self,
        session: AsyncSession,
        settings: Settings,
        embedder: HashingEmbeddingProvider | None = None,
    ) -> None:
        self.session = session
        self.settings = settings
        self.repo = DocumentRepository(session)
        self.embedder = embedder or HashingEmbeddingProvider()

    async def ingest(
        self,
        parsed: ParsedDocument,
        *,
        document_id: str | None = None,
        allow_duplicate: bool = False,
    ) -> Document:
        existing = await self.repo.get_by_hash(parsed.content_hash)
        if existing and not allow_duplicate:
            raise ConflictError(
                "An identical document is already stored.",
                details={"existing_id": existing.id, "existing_title": existing.title},
            )
        doc = Document(
            id=document_id or f"doc_{uuid.uuid4().hex[:16]}",
            title=parsed.title,
            content=parsed.content,
            document_type=parsed.document_type,
            component=parsed.component,
            version=parsed.version,
            source=parsed.source,
            filename=parsed.filename,
            tags=parsed.tags,
            content_hash=parsed.content_hash,
            status="pending",
        )
        await self.repo.add(doc)
        await self.session.commit()
        await self.session.refresh(doc)
        return await self.process(doc.id)

    async def process(self, document_id: str) -> Document:
        document = await self.repo.get(document_id)
        if document is None:
            raise NotFoundError(f"Document {document_id} was not found.")
        document.status = "processing"
        document.error_message = None
        await self.session.commit()
        try:
            await self._index(document)
            document.status = "indexed"
            document.indexed_at = utcnow()
            document.error_message = None
            await self.session.commit()
            await self.session.refresh(document)
            logger.info("document_indexed", document_id=document.id, chunks=document.chunk_count)
            return document
        except Exception as exc:
            await self.session.rollback()
            document = await self.repo.get(document_id)
            if document is not None:
                document.status = "failed"
                document.error_message = str(exc)
                document.indexed_at = None
                await self.session.commit()
                await self.session.refresh(document)
            logger.exception("document_index_failed", document_id=document_id)
            return document  # type: ignore[return-value]

    async def reprocess(self, document_id: str) -> Document:
        return await self.process(document_id)

    async def delete(self, document_id: str) -> None:
        document = await self.repo.get(document_id)
        if document is None:
            raise NotFoundError(f"Document {document_id} was not found.")
        await asyncio.to_thread(self._delete_vectors, document_id)
        await self.repo.delete(document)
        await self.session.commit()

    async def _index(self, document: Document) -> None:
        pieces = chunk_document(
            document.content,
            chunk_size=self.settings.chunk_size_chars,
            overlap=self.settings.chunk_overlap_chars,
        )
        if not pieces:
            raise IngestionError("The document has no indexable text after parsing.")

        chunks = [
            Chunk(
                id=f"{document.id}::c{piece.ordinal:04d}",
                document_id=document.id,
                ordinal=piece.ordinal,
                section=piece.section,
                content=piece.content,
                token_count=len(piece.content.split()),
            )
            for piece in pieces
        ]
        await self.repo.replace_chunks(document.id, chunks)
        document.chunk_count = len(chunks)

        vectors = await self.embedder.embed([chunk.content for chunk in chunks])
        if any(len(vector) != VECTOR_SIZE for vector in vectors):
            raise IngestionError("Embedding provider returned the wrong vector size.")

        points = [
            PointStruct(
                id=_point_id(chunk.id),
                vector=vector,
                payload={
                    "document_id": document.id,
                    "chunk_id": chunk.id,
                    "title": document.title,
                    "section": chunk.section,
                    "component": document.component,
                    "document_type": document.document_type,
                    "version": document.version,
                    "source": document.source,
                    "content": chunk.content,
                    "created_at": (document.created_at or datetime.now(UTC)).isoformat(),
                },
            )
            for chunk, vector in zip(chunks, vectors, strict=True)
        ]
        await asyncio.to_thread(self._upsert_points, document.id, points)

    def _upsert_points(self, document_id: str, points: list[PointStruct]) -> None:
        client = get_qdrant_client()
        ensure_collection(client)
        self._delete_vectors(document_id)
        client.upsert(collection_name=COLLECTION_NAME, points=points)

    def _delete_vectors(self, document_id: str) -> None:
        client = get_qdrant_client()
        ensure_collection(client)
        client.delete(
            collection_name=COLLECTION_NAME,
            points_selector=FilterSelector(
                filter=Filter(
                    must=[FieldCondition(key="document_id", match=MatchValue(value=document_id))]
                )
            ),
        )
