from fastapi import APIRouter, Depends, File, Form, Query, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, get_settings
from app.core.exceptions import IngestionError, NotFoundError
from app.db.session import get_db
from app.repositories import DocumentRepository
from app.schemas.documents import CatalogResponse, DocumentDetail, DocumentList, DocumentOut
from app.services.ingestion.parser import parse_upload
from app.services.ingestion.pipeline import IngestionService

router = APIRouter(prefix="/api/v1/documents", tags=["documents"])


def _service(
    session: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> IngestionService:
    return IngestionService(session, settings)


@router.get("/catalog", response_model=CatalogResponse)
async def catalog(
    session: AsyncSession = Depends(get_db),
) -> CatalogResponse:
    versions = await DocumentRepository(session).versions()
    return CatalogResponse(versions=versions)


@router.get("", response_model=DocumentList)
async def list_documents(
    q: str | None = None,
    component: str | None = None,
    document_type: str | None = None,
    version: str | None = None,
    status: str | None = None,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    session: AsyncSession = Depends(get_db),
) -> DocumentList:
    items, total = await DocumentRepository(session).list_documents(
        query=q,
        component=component,
        document_type=document_type,
        version=version,
        status=status,
        limit=limit,
        offset=offset,
    )
    return DocumentList(
        items=[DocumentOut.model_validate(item) for item in items],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/{document_id}", response_model=DocumentDetail)
async def get_document(
    document_id: str,
    session: AsyncSession = Depends(get_db),
) -> DocumentDetail:
    document = await DocumentRepository(session).get(document_id)
    if document is None:
        raise NotFoundError(f"Document {document_id} was not found.")
    return DocumentDetail.model_validate(document)


@router.post("", response_model=DocumentOut, status_code=201)
async def upload_document(
    file: UploadFile = File(...),
    title: str | None = Form(default=None),
    document_type: str | None = Form(default=None),
    component: str | None = Form(default=None),
    version: str | None = Form(default=None),
    source: str | None = Form(default=None),
    settings: Settings = Depends(get_settings),
    service: IngestionService = Depends(_service),
) -> DocumentOut:
    data = await file.read()
    if len(data) > settings.max_upload_bytes:
        raise IngestionError(
            f"File exceeds the {settings.max_upload_bytes} byte upload limit.",
        )
    parsed = parse_upload(
        filename=file.filename or "upload.txt",
        data=data,
        title=title,
        document_type=document_type,
        component=component,
        version=version,
        source=source,
    )
    document = await service.ingest(parsed)
    return DocumentOut.model_validate(document)


@router.post("/{document_id}/reprocess", response_model=DocumentOut)
async def reprocess_document(
    document_id: str,
    service: IngestionService = Depends(_service),
) -> DocumentOut:
    document = await service.reprocess(document_id)
    return DocumentOut.model_validate(document)


@router.delete("/{document_id}", status_code=204)
async def delete_document(
    document_id: str,
    service: IngestionService = Depends(_service),
) -> None:
    await service.delete(document_id)
