from pydantic import BaseModel, Field


class OntologySearchRequest(BaseModel):
    terms: list[str] = Field(default_factory=list)
    limit_per_term: int = Field(default=100, ge=1, le=250)


class OntologyVerseLinkRequest(BaseModel):
    surah: int = Field(ge=1)
    verse: int = Field(ge=1)
    source_terms: list[str] = Field(default_factory=list)


class OntologyConceptCreateRequest(BaseModel):
    label: str | None = None
    terms: list[str] = Field(default_factory=list)
    selected_verses: list[OntologyVerseLinkRequest] = Field(default_factory=list)
