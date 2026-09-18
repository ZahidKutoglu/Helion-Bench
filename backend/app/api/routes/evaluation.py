from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, get_settings
from app.core.exceptions import NotFoundError
from app.db.session import get_db
from app.repositories import EvaluationRepository
from app.schemas.documents import EvaluationRunOut, EvaluationRunRequest
from app.services.evaluation.runner import EvaluationService, load_cases

router = APIRouter(prefix="/api/v1/evaluation", tags=["evaluation"])


@router.get("/cases")
async def list_cases() -> dict:
    return {"items": load_cases()}


@router.get("/runs", response_model=list[EvaluationRunOut])
async def list_runs(session: AsyncSession = Depends(get_db)) -> list[EvaluationRunOut]:
    items = await EvaluationRepository(session).list_recent()
    return [EvaluationRunOut.model_validate(item) for item in items]


@router.get("/runs/{run_id}", response_model=EvaluationRunOut)
async def get_run(run_id: str, session: AsyncSession = Depends(get_db)) -> EvaluationRunOut:
    item = await EvaluationRepository(session).get(run_id)
    if item is None:
        raise NotFoundError(f"Evaluation run {run_id} was not found.")
    return EvaluationRunOut.model_validate(item)


@router.post("/runs", response_model=EvaluationRunOut, status_code=201)
async def run_evaluation(
    body: EvaluationRunRequest,
    session: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> EvaluationRunOut:
    service = EvaluationService(session, settings)
    run = await service.run(k=body.k)
    return EvaluationRunOut.model_validate(run)
