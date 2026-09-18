"""Grounded development LLM.

This provider does not call a neural model. It extracts sentences from
retrieved chunks that overlap the question and returns a structured
response labeled as a development fallback.
"""

from __future__ import annotations

import re

from app.core.constants import INSUFFICIENT_EVIDENCE

_SENTENCE = re.compile(r"(?<=[.!?])\s+")
_TOKEN = re.compile(r"[a-z0-9][a-z0-9_\-./]*")

STOPWORDS = {
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
    "does",
    "what",
    "how",
    "when",
    "with",
    "from",
    "that",
    "this",
    "was",
    "were",
    "is",
    "are",
}


def _tokens(text: str) -> set[str]:
    return {
        token for token in _TOKEN.findall(text.lower()) if token not in STOPWORDS and len(token) > 1
    }


def _sentences(text: str) -> list[str]:
    parts = _SENTENCE.split(text.replace("\n", " ").strip())
    return [part.strip() for part in parts if len(part.strip()) > 20]


class DevLLMProvider:
    name = "dev"
    description = (
        "Deterministic development responder. Builds an answer from retrieved "
        "chunk sentences. Not a live language model."
    )

    async def generate_grounded(
        self,
        question: str,
        evidence: list[dict],
    ) -> dict:
        if not evidence:
            return {
                "answer": INSUFFICIENT_EVIDENCE,
                "key_findings": [],
                "hypotheses": [],
                "missing_information": [
                    "No indexed chunks matched this question under the current filters."
                ],
                "citation_chunk_ids": [],
                "evidence_coverage": "insufficient",
                "provider_note": (
                    "DEVELOPMENT PROVIDER — this is not output from a neural language model."
                ),
            }

        question_tokens = _tokens(question)
        selected: list[tuple[dict, str, int]] = []
        for item in evidence:
            for sentence in _sentences(item["content"]):
                overlap = len(question_tokens & _tokens(sentence))
                if overlap >= 1:
                    selected.append((item, sentence, overlap))
        selected.sort(key=lambda row: row[2], reverse=True)
        top_sentences = selected[:8]

        if not top_sentences:
            excerpts = [item["content"].strip().split("\n")[0][:240] for item in evidence[:3]]
            answer = (
                "DEVELOPMENT PROVIDER — not a live language model.\n\n"
                "Retrieved chunks did not share enough terms with the question to extract "
                "a supported finding. The highest-ranked excerpts are listed as unverified "
                "context, not as a root cause.\n\n"
                + "\n".join(f"- {excerpt}" for excerpt in excerpts)
            )
            return {
                "answer": answer,
                "key_findings": [],
                "hypotheses": [],
                "missing_information": [
                    "Query terms did not align tightly with retrieved sentences."
                ],
                "citation_chunk_ids": [item["chunk_id"] for item in evidence[:3]],
                "evidence_coverage": "partial",
                "provider_note": (
                    "DEVELOPMENT PROVIDER — this is not output from a neural language model."
                ),
            }

        findings = []
        seen = set()
        for item, sentence, _overlap in top_sentences:
            if sentence in seen:
                continue
            seen.add(sentence)
            findings.append(f"{sentence} (source: {item['title']}, {item['chunk_id']})")

        hypotheses = [
            row
            for row in findings
            if any(
                marker in row.lower()
                for marker in ("may ", "possible", "suspect", "could ", "hypothes")
            )
        ]
        facts = [row for row in findings if row not in hypotheses]

        answer_lines = [
            "DEVELOPMENT PROVIDER — not a live language model. The following is assembled "
            "from retrieved Helion Wireless Lab (synthetic) evidence.",
            "",
            "Supported statements from retrieved sources:",
        ]
        answer_lines.extend(f"- {fact}" for fact in facts[:6] or findings[:6])
        if hypotheses:
            answer_lines.append("")
            answer_lines.append("Hypotheses recorded in the sources (not confirmed root causes):")
            answer_lines.extend(f"- {item}" for item in hypotheses[:4])

        coverage = "sufficient" if len(facts) >= 2 else "partial"
        return {
            "answer": "\n".join(answer_lines),
            "key_findings": facts[:6] or findings[:4],
            "hypotheses": hypotheses[:4],
            "missing_information": [],
            "citation_chunk_ids": [item["chunk_id"] for item, _s, _o in top_sentences],
            "evidence_coverage": coverage,
            "provider_note": (
                "DEVELOPMENT PROVIDER — this is not output from a neural language model."
            ),
        }

    async def generate(self, prompt: str) -> str:
        return prompt
