from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, get_settings
from app.core.exceptions import NotFoundError
from app.db.session import get_db
from app.repositories import InvestigationRepository
from app.schemas.documents import InvestigateRequest, InvestigationOut
from app.services.generation.grounded import InvestigationService

router = APIRouter(prefix="/api/v1/investigations", tags=["investigations"])


@router.get("", response_model=list[InvestigationOut])
async def list_investigations(
    limit: int = Query(default=30, ge=1, le=100),
    session: AsyncSession = Depends(get_db),
) -> list[InvestigationOut]:
    items = await InvestigationRepository(session).list_recent(limit=limit)
    return [InvestigationOut.model_validate(item) for item in items]


@router.get("/{investigation_id}", response_model=InvestigationOut)
async def get_investigation(
    investigation_id: str,
    session: AsyncSession = Depends(get_db),
) -> InvestigationOut:
    item = await InvestigationRepository(session).get(investigation_id)
    if item is None:
        raise NotFoundError(f"Investigation {investigation_id} was not found.")
    return InvestigationOut.model_validate(item)


@router.post("", response_model=InvestigationOut, status_code=201)
async def create_investigation(
    body: InvestigateRequest,
    session: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> InvestigationOut:
    service = InvestigationService(session, settings)
    record = await service.investigate(
        body.question,
        component=body.component,
        document_type=body.document_type,
        version=body.version,
        k=body.k,
    )
    return InvestigationOut.model_validate(record)
