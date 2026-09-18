"""Run the synthetic evaluation set against the live index."""

from __future__ import annotations

import json
import uuid
from pathlib import Path

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.core.constants import INSUFFICIENT_EVIDENCE
from app.domain.models import EvaluationRun
from app.providers.llm.factory import get_llm_provider
from app.repositories import EvaluationRepository
from app.services.evaluation.metrics import citation_validity, mean, recall_at_k
from app.services.generation.citations import validate_citations
from app.services.retrieval.hybrid import RetrievalService

CASES_PATH = Path(__file__).with_name("cases.json")


def load_cases() -> list[dict]:
    return json.loads(CASES_PATH.read_text(encoding="utf-8"))


class EvaluationService:
    def __init__(self, session: AsyncSession, settings: Settings) -> None:
        self.session = session
        self.settings = settings
        self.retrieval = RetrievalService(settings)
        self.llm = get_llm_provider(settings)
        self.repo = EvaluationRepository(session)

    async def run(self, k: int | None = None) -> EvaluationRun:
        top_k = k or self.settings.retrieval_default_k
        cases = load_cases()
        results = []
        recall_values: list[float] = []
        citation_values: list[float] = []
        hit_flags: list[float] = []
        support_flags: list[float] = []
        failed = 0

        for case in cases:
            try:
                row = await self._evaluate_case(case, top_k)
            except Exception as exc:
                failed += 1
                row = {
                    "id": case["id"],
                    "question": case["question"],
                    "error": str(exc),
                    "passed": False,
                }
            results.append(row)
            if row.get("recall_at_k") is not None:
                recall_values.append(row["recall_at_k"])
            if row.get("citation_validity") is not None:
                citation_values.append(row["citation_validity"])
            if row.get("retrieval_hit") is not None:
                hit_flags.append(1.0 if row["retrieval_hit"] else 0.0)
            if row.get("answer_supported") is not None:
                support_flags.append(1.0 if row["answer_supported"] else 0.0)

        run = EvaluationRun(
            id=f"eval_{uuid.uuid4().hex[:16]}",
            k=top_k,
            case_count=len(cases),
            failed_count=failed,
            recall_at_k=mean(recall_values),
            citation_validity_rate=mean(citation_values),
            retrieval_hit_rate=mean(hit_flags),
            supported_answer_rate=mean(support_flags),
            provider=getattr(self.llm, "name", "unknown"),
            cases=results,
            notes=(
                "Metrics are computed on the synthetic Helion Lab set. "
                "They do not generalize to real engineering corpora. "
                "Recall@k is the fraction of expected document IDs found in top-k. "
                "Scores are not calibrated probabilities."
            ),
        )
        await self.repo.add(run)
        await self.session.commit()
        await self.session.refresh(run)
        return run

    async def _evaluate_case(self, case: dict, k: int) -> dict:
        question = case["question"]
        expected = list(case.get("expected_document_ids") or [])
        expect_insufficient = bool(case.get("expect_insufficient"))
        hits = await self.retrieval.search(question, k=k)
        retrieved_docs = []
        for hit in hits:
            if hit.document_id not in retrieved_docs:
                retrieved_docs.append(hit.document_id)
        evidence = [
            {
                "document_id": hit.document_id,
                "chunk_id": hit.chunk_id,
                "title": hit.title,
                "section": hit.section,
                "content": hit.content,
                "combined_score": hit.combined_score,
            }
            for hit in hits
        ]
        raw = await self.llm.generate_grounded(question, evidence)
        citations = validate_citations(raw.get("citation_chunk_ids") or [], evidence)
        coverage = str(raw.get("evidence_coverage") or "")
        answer = str(raw.get("answer") or "")
        insufficient = coverage == "insufficient" or INSUFFICIENT_EVIDENCE in answer

        recall = recall_at_k(expected, retrieved_docs, k)
        if expect_insufficient:
            retrieval_hit = insufficient or len(hits) == 0
            answer_supported = insufficient
        else:
            retrieval_hit = bool(expected) and any(doc_id in retrieved_docs for doc_id in expected)
            answer_supported = (not insufficient) and bool(citations)

        passed = retrieval_hit and answer_supported
        if expected and recall is not None:
            passed = passed and recall > 0

        return {
            "id": case["id"],
            "question": question,
            "expected_document_ids": expected,
            "retrieved_document_ids": retrieved_docs,
            "retrieved_chunk_ids": [hit.chunk_id for hit in hits],
            "citations": citations,
            "expect_insufficient": expect_insufficient,
            "evidence_coverage": coverage,
            "recall_at_k": recall,
            "citation_validity": citation_validity(citations, [hit.chunk_id for hit in hits]),
            "retrieval_hit": retrieval_hit,
            "answer_supported": answer_supported,
            "passed": passed,
        }
