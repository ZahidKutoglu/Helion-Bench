"""Embedding provider: hashed n-gram vectors.

This is a deterministic development fallback. Same token always lands in
the same dimension, so overlapping vocabulary produces similar vectors.
It is NOT a neural semantic embedding model and must not be described as one.
"""

from __future__ import annotations

import hashlib
import math
import re

from app.core.constants import VECTOR_SIZE

_TOKEN = re.compile(r"[a-z0-9][a-z0-9_\-./]*")


def tokenize(text: str) -> list[str]:
    return _TOKEN.findall(text.lower())


class HashingEmbeddingProvider:
    name = "dev-hashing"
    dimensions = VECTOR_SIZE
    description = (
        "Deterministic hashed n-gram embeddings for local development. "
        "Not a production semantic model."
    )

    def __init__(self, dimensions: int = VECTOR_SIZE) -> None:
        self.dimensions = dimensions

    def embed_one(self, text: str) -> list[float]:
        tokens = tokenize(text)
        grams = list(tokens)
        grams.extend(f"{a}_{b}" for a, b in zip(tokens, tokens[1:], strict=False))
        vec = [0.0] * self.dimensions
        if not grams:
            return vec
        for gram in grams:
            digest = hashlib.blake2b(gram.encode("utf-8"), digest_size=8).digest()
            number = int.from_bytes(digest, "little")
            index = number % self.dimensions
            sign = 1.0 if (number >> 20) & 1 == 0 else -1.0
            vec[index] += sign
        norm = math.sqrt(sum(value * value for value in vec)) or 1.0
        return [value / norm for value in vec]

    async def embed(self, texts: list[str]) -> list[list[float]]:
        return [self.embed_one(text) for text in texts]
