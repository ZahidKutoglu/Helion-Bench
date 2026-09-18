from app.core.config import Settings
from app.providers.embeddings.base import EmbeddingProvider
from app.providers.embeddings.hashing import HashingEmbeddingProvider


def get_embedding_provider(settings: Settings) -> EmbeddingProvider:
    """Only the hashing development provider is shipped.

    A neural provider can be added behind the same Protocol without changing
    retrieval. Until then every environment uses the labeled fallback.
    """
    _ = settings.embedding_provider
    return HashingEmbeddingProvider()
