"""Embedding provider abstraction.

Embeddings turn text into numeric vectors so similar passages can be found
with nearest-neighbor search. Concrete providers are added in Phase 3.
"""

from typing import Protocol


class EmbeddingProvider(Protocol):
    name: str
    dimensions: int

    async def embed(self, texts: list[str]) -> list[list[float]]:
        """Return one vector per input string. Not used in Phase 1."""
        ...
