"""Keep only citations that refer to actually retrieved chunks."""

from app.core.constants import INSUFFICIENT_EVIDENCE


def validate_citations(requested_ids: list, evidence: list[dict]) -> list[dict]:
    by_chunk = {item["chunk_id"]: item for item in evidence}
    valid: list[dict] = []
    seen: set[str] = set()
    for raw in requested_ids:
        chunk_id = str(raw)
        if chunk_id in seen:
            continue
        source = by_chunk.get(chunk_id)
        if source is None:
            continue
        seen.add(chunk_id)
        valid.append(
            {
                "chunk_id": source["chunk_id"],
                "document_id": source["document_id"],
                "title": source["title"],
                "section": source.get("section"),
                "component": source.get("component"),
                "version": source.get("version"),
                "excerpt": _excerpt(source["content"]),
                "combined_score": source.get("combined_score"),
            }
        )
    return valid


def apply_insufficient_if_needed(payload: dict, citations: list[dict]) -> dict:
    coverage = str(payload.get("evidence_coverage") or "partial")
    if coverage == "insufficient" or not citations:
        payload = {
            **payload,
            "answer": INSUFFICIENT_EVIDENCE
            if coverage == "insufficient" or not citations
            else payload.get("answer"),
            "evidence_coverage": "insufficient" if not citations else coverage,
        }
        if not citations:
            payload["answer"] = INSUFFICIENT_EVIDENCE
            payload["evidence_coverage"] = "insufficient"
            missing = list(payload.get("missing_information") or [])
            if "No validated citations remained after checking retrieved chunk IDs." not in missing:
                missing.append(
                    "No validated citations remained after checking retrieved chunk IDs."
                )
            payload["missing_information"] = missing
    return payload


def _excerpt(content: str, limit: int = 420) -> str:
    compact = " ".join(content.split())
    if len(compact) <= limit:
        return compact
    return compact[: limit - 1] + "…"
