from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from backend.app.session import get_db
from backend.app.services.bible import BibleService


router = APIRouter(prefix="/bible", tags=["bible"])

def get_service(db: Session = Depends(get_db)) -> BibleService:
    return BibleService(db)

@router.get("/books")
def get_books(service: BibleService = Depends(get_service)) -> list[dict]:
    return service.get_all_books()

@router.get("/books/{book_id}")
def get_book(book_id: int, service: BibleService = Depends(get_service)) -> dict:
    return service.get_book_info(book_id) or {}

@router.get("/books/{book_id}/chapters-count")
def get_chapters_count(book_id: int, service: BibleService = Depends(get_service)) -> dict:
    return {"count": service.get_chapters_count(book_id)}

@router.get("/books/{book_id}/chapters/{chapter_id}/verses")
def get_verses(book_id: int, chapter_id: int, service: BibleService = Depends(get_service)) -> list[dict]:
    return service.get_verses(book_id, chapter_id)

@router.get("/search")
def search_bible(q: str = Query(default=""), limit: int = Query(default=100, ge=1, le=250), offset: int = Query(default=0, ge=0), service: BibleService = Depends(get_service)) -> dict:
    stopword_only = service.is_stopword_only_query(q)
    if stopword_only:
        return {"count": 0, "results": [], "related_terms": [], "limit": limit, "offset": offset, "stopword_only": True}
    results = service.search_verses(q, limit, offset)
    count = service.count_search_results(q)
    related_terms = service.build_generic_related_terms(q, results)
    return {"count": count, "results": results, "related_terms": related_terms, "limit": limit, "offset": offset}