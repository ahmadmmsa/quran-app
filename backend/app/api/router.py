from fastapi import APIRouter

from backend.app.api import bible, quran, admin, auth

api_router = APIRouter()
api_router.include_router(bible.router)
api_router.include_router(quran.router)
api_router.include_router(admin.router)
api_router.include_router(auth.router)