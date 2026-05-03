from fastapi import APIRouter

from backend.app.api import bible, quran

api_router = APIRouter()
api_router.include_router(bible.router)
api_router.include_router(quran.router)