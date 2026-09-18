"""Run retrieval, generate a grounded answer, validate citations, persist."""

from __future__ import annotations

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.core.exceptions import IngestionError
from app.domain.models import Investigation
from app.providers.llm.factory import get_llm_provider
from app.repositories import InvestigationRepository
from app.services.generation.citations import apply_insufficient_if_needed, validate_citations
from app.services.retrieval.hybrid import RetrievalService


class InvestigationService:
    def __init__(self, session: AsyncSession, settings: Settings) -> None:
        self.session = session
        self.settings = settings
        self.retrieval = RetrievalService(settings)
        self.llm = get_llm_provider(settings)
        self.repo = InvestigationRepository(session)

    async def investigate(
        self,
        question: str,
        *,
        component: str | None = None,
        document_type: str | None = None,
        version: str | None = None,
        k: int | None = None,
    ) -> Investigation:
        cleaned = question.strip()
        if len(cleaned) < 8:
            raise IngestionError("Ask a complete engineering question (at least 8 characters).")

        hits = await self.retrieval.search(
            cleaned,
            k=k,
            component=component,
            document_type=document_type,
            version=version,
        )
        evidence = [
            {
                "document_id": hit.document_id,
                "chunk_id": hit.chunk_id,
                "title": hit.title,
                "section": hit.section,
                "content": hit.content,
                "component": hit.component,
                "version": hit.version,
                "combined_score": hit.combined_score,
            }
            for hit in hits
        ]
        raw = await self.llm.generate_grounded(cleaned, evidence)
        citations = validate_citations(raw.get("citation_chunk_ids") or [], evidence)
        if not citations and evidence:
            citations = validate_citations([item["chunk_id"] for item in evidence[:3]], evidence)
        payload = apply_insufficient_if_needed(raw, citations)

        record = Investigation(
            id=f"inv_{uuid.uuid4().hex[:16]}",
            question=cleaned,
            filters={
                "component": component,
                "document_type": document_type,
                "version": version,
                "k": k or self.settings.retrieval_default_k,
            },
            answer=str(payload.get("answer") or ""),
            key_findings=list(payload.get("key_findings") or []),
            hypotheses=list(payload.get("hypotheses") or []),
            missing_information=list(payload.get("missing_information") or []),
            citations=citations,
            evidence_coverage=str(payload.get("evidence_coverage") or "partial"),
            provider=getattr(self.llm, "name", "unknown"),
            provider_note=payload.get("provider_note"),
            retrieved_chunk_ids=[hit.chunk_id for hit in hits],
        )
        await self.repo.add(record)
        await self.session.commit()
        await self.session.refresh(record)
        return record
