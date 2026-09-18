from fastapi import APIRouter, Depends

from app.core.config import Settings, get_settings
from app.providers.embeddings.factory import get_embedding_provider
from app.schemas.documents import SearchHit, SearchRequest, SearchResponse
from app.services.retrieval.hybrid import RetrievalService

router = APIRouter(prefix="/api/v1/search", tags=["search"])


@router.post("", response_model=SearchResponse)
async def search(
    body: SearchRequest,
    settings: Settings = Depends(get_settings),
) -> SearchResponse:
    service = RetrievalService(settings)
    hits = await service.search(
        body.query,
        k=body.k,
        component=body.component,
        document_type=body.document_type,
        version=body.version,
    )
    embedder = get_embedding_provider(settings)
    return SearchResponse(
        query=body.query,
        embedding_provider=getattr(embedder, "name", settings.embedding_provider),
        hits=[
            SearchHit(
                document_id=hit.document_id,
                chunk_id=hit.chunk_id,
                title=hit.title,
                section=hit.section,
                content=hit.content,
                component=hit.component,
                document_type=hit.document_type,
                version=hit.version,
                source=hit.source,
                vector_score=hit.vector_score,
                lexical_score=hit.lexical_score,
                combined_score=hit.combined_score,
            )
            for hit in hits
        ],
    )
