from fastapi import APIRouter

from app.api.routes import documents, evaluation, health, investigations, search

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(documents.router)
api_router.include_router(search.router)
api_router.include_router(investigations.router)
api_router.include_router(evaluation.router)
