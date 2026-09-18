"""LLM provider abstraction.

Phase 1 only defines the interface. Later phases will add a real provider
and a clearly labeled deterministic development provider. The development
provider must never be presented as a genuine model.
"""

from typing import Protocol


class LLMProvider(Protocol):
    name: str

    async def generate(self, prompt: str) -> str:
        """Return model text for a prompt. Not used in Phase 1."""
        ...
