"""Verse-level semantic embeddings."""
from __future__ import annotations

import logging
from functools import lru_cache
from typing import Sequence

from backend.app.config import get_settings

logger = logging.getLogger(__name__)


def format_verse_for_embedding(row: dict) -> str:
    """Build the text representation that gets embedded for a verse.

    Combines the Arabic source with the English translation so the vector
    carries both, which helps cross-lingual and verse-to-verse similarity.
    Must stay consistent between backfill and any future query embedding.
    """
    arabic = str(row.get('verse_txt_raw') or row.get('verse_txt') or '').strip()
    english = str(row.get('verse_txt_en') or '').strip()
    return '\n'.join(part for part in (arabic, english) if part)


def to_pgvector_literal(vector: Sequence[float]) -> str:
    """Render a vector in pgvector's text input format: ``[a,b,c]``."""
    return '[' + ','.join(str(float(value)) for value in vector) + ']'


class EmbeddingModel:
    def __init__(
        self,
        model_name: str,
        cache_dir: str | None = None,
        query_prefix: str = "",
        passage_prefix: str = "",
        threads: int | None = None,
    ):
        self.model_name = model_name
        self.cache_dir = cache_dir
        self.query_prefix = query_prefix
        self.passage_prefix = passage_prefix
        self.threads = threads
        self._model = None

    def _ensure_loaded(self):
        if self._model is None:
            from fastembed import TextEmbedding  # imported lazily on first use

            logger.info("Loading embedding model %s (threads=%s)", self.model_name, self.threads)
            kwargs = {}
            if self.cache_dir:
                kwargs["cache_dir"] = self.cache_dir
            if self.threads:
                kwargs["threads"] = self.threads  # onnxruntime intra-op threads
            self._model = TextEmbedding(model_name=self.model_name, **kwargs)
        return self._model

    def embed(self, texts: Sequence[str]) -> list[list[float]]:
        model = self._ensure_loaded()
        return [vector.tolist() for vector in model.embed(list(texts))]

    def embed_documents(self, texts: Sequence[str]) -> list[list[float]]:
        """Embed stored documents (verses). Applies the passage prefix."""
        return self.embed([f"{self.passage_prefix}{text}" for text in texts])

    def embed_query(self, text: str) -> list[float]:
        """Embed a search query. Applies the query prefix."""
        return self.embed([f"{self.query_prefix}{text}"])[0]


@lru_cache(maxsize=1)
def get_embedding_model() -> EmbeddingModel:
    settings = get_settings()
    return EmbeddingModel(
        settings.embedding_model_name,
        settings.embedding_cache_dir,
        query_prefix=settings.embedding_query_prefix,
        passage_prefix=settings.embedding_passage_prefix,
        threads=settings.embedding_threads,
    )
