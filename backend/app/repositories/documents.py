"""Persist documents, chunks, and Qdrant points."""

from __future__ import annotations

from sqlalchemy import Select, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.models import Chunk, Document, EvaluationRun, Investigation


class DocumentRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get(self, document_id: str) -> Document | None:
        from sqlalchemy.orm import selectinload

        result = await self.session.execute(
            select(Document)
            .options(selectinload(Document.chunks))
            .where(Document.id == document_id)
        )
        return result.scalar_one_or_none()

    async def get_by_hash(self, content_hash: str) -> Document | None:
        result = await self.session.execute(
            select(Document).where(Document.content_hash == content_hash)
        )
        return result.scalar_one_or_none()

    async def add(self, document: Document) -> Document:
        self.session.add(document)
        await self.session.flush()
        return document

    async def delete(self, document: Document) -> None:
        await self.session.delete(document)

    async def list_documents(
        self,
        *,
        query: str | None = None,
        component: str | None = None,
        document_type: str | None = None,
        version: str | None = None,
        status: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[Document], int]:
        stmt: Select = select(Document)
        count_stmt = select(func.count()).select_from(Document)
        if query:
            pattern = f"%{query}%"
            filt = Document.title.ilike(pattern) | Document.id.ilike(pattern)
            stmt = stmt.where(filt)
            count_stmt = count_stmt.where(filt)
        if component:
            stmt = stmt.where(Document.component == component)
            count_stmt = count_stmt.where(Document.component == component)
        if document_type:
            stmt = stmt.where(Document.document_type == document_type)
            count_stmt = count_stmt.where(Document.document_type == document_type)
        if version:
            stmt = stmt.where(Document.version == version)
            count_stmt = count_stmt.where(Document.version == version)
        if status:
            stmt = stmt.where(Document.status == status)
            count_stmt = count_stmt.where(Document.status == status)
        total = int((await self.session.execute(count_stmt)).scalar_one())
        rows = await self.session.execute(
            stmt.order_by(Document.created_at.desc()).limit(limit).offset(offset)
        )
        return list(rows.scalars().all()), total

    async def replace_chunks(self, document_id: str, chunks: list[Chunk]) -> None:
        existing = await self.session.execute(select(Chunk).where(Chunk.document_id == document_id))
        for row in existing.scalars().all():
            await self.session.delete(row)
        for chunk in chunks:
            self.session.add(chunk)
        await self.session.flush()

    async def ingestion_summary(self) -> dict:
        result = await self.session.execute(
            select(Document.status, func.count()).group_by(Document.status)
        )
        counts = {status: count for status, count in result.all()}
        failed = await self.session.execute(
            select(Document)
            .where(Document.status == "failed")
            .order_by(Document.updated_at.desc())
            .limit(8)
        )
        recent_failed = [
            {
                "id": doc.id,
                "title": doc.title,
                "error_message": doc.error_message,
                "updated_at": doc.updated_at.isoformat() if doc.updated_at else None,
            }
            for doc in failed.scalars().all()
        ]
        return {
            "counts": counts,
            "recent_failures": recent_failed,
        }

    async def versions(self) -> list[str]:
        result = await self.session.execute(
            select(Document.version).distinct().order_by(Document.version)
        )
        return [row[0] for row in result.all() if row[0]]


class InvestigationRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def add(self, investigation: Investigation) -> Investigation:
        self.session.add(investigation)
        await self.session.flush()
        return investigation

    async def get(self, investigation_id: str) -> Investigation | None:
        return await self.session.get(Investigation, investigation_id)

    async def list_recent(self, limit: int = 30) -> list[Investigation]:
        result = await self.session.execute(
            select(Investigation).order_by(Investigation.created_at.desc()).limit(limit)
        )
        return list(result.scalars().all())


class EvaluationRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def add(self, run: EvaluationRun) -> EvaluationRun:
        self.session.add(run)
        await self.session.flush()
        return run

    async def list_recent(self, limit: int = 10) -> list[EvaluationRun]:
        result = await self.session.execute(
            select(EvaluationRun).order_by(EvaluationRun.created_at.desc()).limit(limit)
        )
        return list(result.scalars().all())

    async def get(self, run_id: str) -> EvaluationRun | None:
        return await self.session.get(EvaluationRun, run_id)
