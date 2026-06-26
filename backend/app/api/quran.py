from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from backend.app.api.ontology_models import OntologyConceptCreateRequest, OntologySearchRequest, OntologySuggestRequest
from backend.app.session import get_db
from backend.app.services.quran import QuranService
from backend.app.api.auth import get_current_admin_user


router = APIRouter(prefix="/quran", tags=["quran"])

def get_service(db: Session = Depends(get_db)) -> QuranService:
    return QuranService(db)

@router.get("/surahs")
def get_surahs(service: QuranService = Depends(get_service)) -> list[dict]:
    return service.get_all_surahs()

@router.get("/surahs/{surah_id}/verses")
def get_verses(surah_id: int, service: QuranService = Depends(get_service)) -> list[dict]:
    return service.get_verses(surah_id)

@router.get("/related-verses/{surah_id}/{verse_num}")
def get_related_verses(surah_id: int, verse_num: int, limit: int = Query(default=20, ge=1, le=50), service: QuranService = Depends(get_service)) -> dict:
    result = service.get_related_verses_by_subject(surah_id, verse_num, limit)
    if result is None:
        raise HTTPException(status_code=404, detail="Verse not found")
    return result

@router.get("/search")
def search_quran(
    q: str = Query(default=""),
    literal_page: int = Query(default=1, ge=1),
    literal_per_page: int = Query(default=20, ge=0, le=6236),  # 0 = all on one page
    expansion_page: int = Query(default=1, ge=1),
    expansion_per_page: int = Query(default=20, ge=0, le=6236),
    semantic: bool | None = Query(default=None),
    root: str | None = Query(default=None),
    lemma: str | None = Query(default=None),
    pos: str | None = Query(default=None),
    nominal_case: str | None = Query(default=None),
    verb_mood: str | None = Query(default=None),
    verb_voice: str | None = Query(default=None),
    verb_aspect: str | None = Query(default=None),
    gender: str | None = Query(default=None),
    number: str | None = Query(default=None),
    person: str | None = Query(default=None),
    service: QuranService = Depends(get_service),
) -> dict:
    options = {
        "semantic": semantic,
        "root": root,
        "lemma": lemma,
        "pos": pos,
        "nominal_case": nominal_case,
        "verb_mood": verb_mood,
        "verb_voice": verb_voice,
        "verb_aspect": verb_aspect,
        "gender": gender,
        "number": number,
        "person": person,
    }
    return service.search(
        q,
        literal_page=literal_page,
        literal_per_page=literal_per_page,
        expansion_page=expansion_page,
        expansion_per_page=expansion_per_page,
        options=options,
    )

@router.post("/ontology/search")
def search_ontology(
    payload: OntologySearchRequest,
    service: QuranService = Depends(get_service),
) -> dict:
    return service.search_ontology_seed_terms(payload.terms, payload.limit_per_term)

@router.post("/ontology/suggest-verses")
def suggest_ontology_verses(
    payload: OntologySuggestRequest,
    service: QuranService = Depends(get_service),
) -> dict:
    verses = [{"surah": v.surah, "verse": v.verse} for v in payload.verses]
    return service.suggest_concept_verses(payload.text, verses, payload.limit)

@router.post("/ontology/concepts")
def create_ontology_concept(
    payload: OntologyConceptCreateRequest,
    service: QuranService = Depends(get_service),
    admin_user: str = Depends(get_current_admin_user),
) -> dict:
    if not payload.label or not payload.label.strip():
        raise HTTPException(status_code=400, detail="Concept label is required")

    return service.create_ontology_concept(
        payload.label,
        payload.article,
        payload.terms,
        [item.model_dump() for item in payload.selected_verses],
    )

@router.get("/ontology/concepts")
def list_ontology_concepts(
    service: QuranService = Depends(get_service),
) -> list[dict]:
    return service.list_ontology_concepts()

@router.get("/ontology/concepts/{concept_id}")
def get_ontology_concept(
    concept_id: str,
    service: QuranService = Depends(get_service),
) -> dict:
    concept = service.get_ontology_concept(concept_id)
    if concept is None:
        raise HTTPException(status_code=404, detail="Concept not found")
    return concept

@router.put("/ontology/concepts/{concept_id}")
def update_ontology_concept(
    concept_id: str,
    payload: OntologyConceptCreateRequest,
    service: QuranService = Depends(get_service),
    admin_user: str = Depends(get_current_admin_user),
) -> dict:
    if not payload.label or not payload.label.strip():
        raise HTTPException(status_code=400, detail="Concept label is required")

    concept = service.update_ontology_concept(
        concept_id,
        payload.label,
        payload.article,
        payload.terms,
        [item.model_dump() for item in payload.selected_verses],
    )
    if concept is None:
        raise HTTPException(status_code=404, detail="Concept not found")
    return concept

@router.delete("/ontology/concepts/{concept_id}")
def delete_ontology_concept(
    concept_id: str,
    service: QuranService = Depends(get_service),
    admin_user: str = Depends(get_current_admin_user),
) -> dict:
    deleted = service.delete_ontology_concept(concept_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Concept not found")
    return {"deleted": True, "id": concept_id}
