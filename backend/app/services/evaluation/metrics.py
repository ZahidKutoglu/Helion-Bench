"""Evaluation metric helpers.

Recall@k: fraction of expected document IDs that appear in the top-k retrieved set.
This is not a probability of correctness.
"""

from __future__ import annotations


def recall_at_k(expected_ids: list[str], retrieved_ids: list[str], k: int) -> float | None:
    if not expected_ids:
        return None
    retrieved = set(retrieved_ids[:k])
    hits = sum(1 for doc_id in expected_ids if doc_id in retrieved)
    return hits / len(expected_ids)


def citation_validity(citations: list[dict], retrieved_chunk_ids: list[str]) -> float:
    if not citations:
        return 1.0
    allowed = set(retrieved_chunk_ids)
    valid = sum(1 for item in citations if item.get("chunk_id") in allowed)
    return valid / len(citations)


def mean(values: list[float]) -> float | None:
    if not values:
        return None
    return sum(values) / len(values)
