from __future__ import annotations

import logging
from math import log

from sqlalchemy import bindparam, text
from sqlalchemy.exc import ProgrammingError
from sqlalchemy.orm import Session

from backend.app.services.search_utils import build_arabic_comparison_token, is_arabic_stopword, normalize_arabic_token

logger = logging.getLogger(__name__)


def dedupe_preserve_order(values: list[str]) -> list[str]:
    seen: set[str] = set()
    ordered: list[str] = []
    for value in values:
        normalized = str(value or '').strip()
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        ordered.append(normalized)
    return ordered


def compute_inverse_size_weight(size: int | None, corpus_size: int) -> float:
    safe_size = max(int(size or 0), 1)
    safe_corpus_size = max(int(corpus_size or 0), safe_size)
    return round(max(log((safe_corpus_size + 1) / safe_size, 2), 0.25), 4)


def build_capability_summary(
    *,
    morphology_available: bool,
    semantic_expansion_count: int | None = None,
    embeddings_available: bool,
) -> dict:
    # semantic expansions now depend on morphology, but keep the older
    # optional argument for test compatibility.
    semantic_expansions_available = morphology_available
    if semantic_expansion_count is not None:
        semantic_expansions_available = morphology_available and int(semantic_expansion_count) > 0

    fallback_reasons: list[str] = []

    if not morphology_available:
        fallback_reasons.append('quran_arabic_morphology_corpus is unavailable')

    if semantic_expansion_count is not None and int(semantic_expansion_count) <= 0:
        fallback_reasons.append('semantic_expansions has no enabled rows')

    if not embeddings_available:
        fallback_reasons.append('embeddings are not stored in PostgreSQL')

    return {
        'morphology_available': morphology_available,
        'semantic_expansions_available': semantic_expansions_available,
        'embeddings_available': embeddings_available,
        'fallback_reason': '; '.join(fallback_reasons) or None,
    }


def merge_related_term_rows(rows: list[dict], excluded_terms: set[str], limit: int = 12) -> list[dict]:
    merged: dict[str, dict] = {}

    for row in rows:
        term = str(row.get('term') or '').strip()
        normalized_term = normalize_arabic_token(row.get('normalized_term') or term)
        if not term or not normalized_term or normalized_term in excluded_terms:
            continue

        existing = merged.get(normalized_term)
        if existing is None:
            merged[normalized_term] = {
                'term': term,
                'normalized_term': normalized_term,
                'count': int(row.get('count') or 0),
                'weight': float(row.get('weight') or 0.0),
                'relation_types': dedupe_preserve_order([str(row.get('relation_type') or '').strip()]),
                'source_terms': dedupe_preserve_order([str(value) for value in (row.get('source_terms') or [])]),
                'reason': str(row.get('reason') or '').strip() or None,
            }
            continue

        existing['count'] = max(existing['count'], int(row.get('count') or 0))
        existing['weight'] = max(existing['weight'], float(row.get('weight') or 0.0))
        existing['relation_types'] = dedupe_preserve_order(
            existing['relation_types'] + [str(row.get('relation_type') or '').strip()]
        )
        existing['source_terms'] = dedupe_preserve_order(
            existing['source_terms'] + [str(value) for value in (row.get('source_terms') or [])]
        )
        if not existing.get('reason') and row.get('reason'):
            existing['reason'] = str(row.get('reason')).strip()

    related_terms = sorted(merged.values(), key=lambda item: (-item['weight'], -item['count'], item['term']))
    return related_terms[:limit]


class QuranSemanticRepository:
    def __init__(self, db: Session):
        self.db = db
        self._capabilities: dict | None = None
        self._morphology_corpus_size: int | None = None

    def get_capabilities(self) -> dict:
        if self._capabilities is not None:
            return self._capabilities

        morphology_available = self._table_exists('quran_arabic_morphology_corpus')
        
        embeddings_available = bool(
            self._safe_scalar(
                """
                SELECT COUNT(*)
                FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND (column_name ILIKE '%embedding%' OR udt_name = 'vector')
                """,
                default=0,
            )
        )

        self._capabilities = build_capability_summary(
            morphology_available=morphology_available,
            embeddings_available=embeddings_available,
        )
        # Verse-level semantic similarity is independent of the lemma embeddings.
        self._capabilities['verse_embeddings_available'] = self._table_exists('quran_verse_embeddings')
        return self._capabilities

    def fetch_related_verse_candidates(
        self,
        source_verse_id: int,
        *,
        limit: int = 100,
        max_distance: float = 0.6,
    ) -> list[dict]:
        """Verse-to-verse semantic neighbours using the stored verse embeddings.

        Compares against the source verse's own stored vector, so no embedding
        model is needed at request time.
        """
        if not source_verse_id or not self.get_capabilities().get('verse_embeddings_available'):
            return []

        stmt = text("""
            WITH src AS (
                SELECT embedding FROM quran_verse_embeddings WHERE verse_id = :source_id
            )
            SELECT qv.id,
                   qv.suraid,
                   qv.verse_num,
                   (e.embedding <=> src.embedding) AS distance
            FROM quran_verse_embeddings e
            CROSS JOIN src
            JOIN quran_verses qv ON qv.id = e.verse_id
            WHERE e.verse_id <> :source_id
            ORDER BY e.embedding <=> src.embedding ASC
            LIMIT :limit
        """)
        try:
            rows = self.db.execute(stmt, {'source_id': source_verse_id, 'limit': limit})
            return [
                {'id': r.id, 'suraid': r.suraid, 'verse_num': r.verse_num, 'score': 1.0 - r.distance}
                for r in rows
                if r.distance is not None and r.distance < max_distance
            ]
        except Exception:
            logger.warning("Verse semantic search failed; ensure quran_verse_embeddings is populated", exc_info=True)
            return []

    def fetch_query_semantic_candidates(
        self,
        query_text: str,
        *,
        limit: int = 100,
        max_distance: float = 0.6,
    ) -> list[dict]:
        """Whole-verse semantic matches for a free-text query.

        Embeds the full query string (multi-word phrases are handled natively by
        the sentence model) and ANN-searches the stored verse vectors. Returns []
        and degrades gracefully if the model or the embeddings table is missing.
        Stopword-only queries are filtered upstream in QuranService.search before
        this is ever called.
        """
        query_text = str(query_text or '').strip()
        if not query_text or not self.get_capabilities().get('verse_embeddings_available'):
            return []

        try:
            from backend.app.services.embeddings import get_embedding_model, to_pgvector_literal

            query_vector = to_pgvector_literal(get_embedding_model().embed_query(query_text))
        except Exception:
            logger.warning("Query embedding failed; is fastembed installed?", exc_info=True)
            return []

        stmt = text("""
            SELECT qv.id,
                   qv.suraid,
                   qv.verse_num,
                   (e.embedding <=> CAST(:query_vec AS vector)) AS distance
            FROM quran_verse_embeddings e
            JOIN quran_verses qv ON qv.id = e.verse_id
            ORDER BY e.embedding <=> CAST(:query_vec AS vector) ASC
            LIMIT :limit
        """)
        try:
            rows = self.db.execute(stmt, {'query_vec': query_vector, 'limit': limit})
            return [
                {'id': r.id, 'suraid': r.suraid, 'verse_num': r.verse_num, 'score': 1.0 - r.distance}
                for r in rows
                if r.distance is not None and r.distance < max_distance
            ]
        except Exception:
            logger.warning("Query semantic search failed; ensure quran_verse_embeddings is populated", exc_info=True)
            return []

    def build_query_profile(self, terms: list[str], phrases: list[str], language: str) -> dict:
        capabilities = self.get_capabilities()
        exact_terms = dedupe_preserve_order([str(term or '').strip() for term in terms])
        comparison_terms = dedupe_preserve_order([build_arabic_comparison_token(term) for term in exact_terms])
        # Filter stopwords for concept expansion only; exact_terms stays full for direct matching
        if language == 'ar':
            content_comparison_terms = [t for t in comparison_terms if not is_arabic_stopword(t)]
        else:
            content_comparison_terms = comparison_terms
        semantic_expansions = self._fetch_semantic_expansions(content_comparison_terms if language == 'ar' else exact_terms)
        profile = {
            'language': language,
            'exact_terms': exact_terms,
            'comparison_terms': comparison_terms,
            'phrases': dedupe_preserve_order([str(phrase or '').strip() for phrase in phrases]),
            'lemma_concepts': [],
            'root_concepts': [],
            'semantic_expansions': semantic_expansions,
            'highlight_terms': dedupe_preserve_order(exact_terms + [item.get('target_term', '') for item in semantic_expansions]),
            'capabilities': capabilities,
        }

        if language != 'ar' or not capabilities['morphology_available'] or not content_comparison_terms:
            return profile

        token_rows = self._fetch_query_token_concepts(content_comparison_terms)
        corpus_size = self._get_morphology_corpus_size()
        lemma_keys = dedupe_preserve_order([row['lemma'] for row in token_rows if row.get('lemma') and row['lemma'] != '_'])
        root_keys = dedupe_preserve_order([row['root'] for row in token_rows if row.get('root') and row['root'] != '_'])
        lemma_sizes = self._fetch_lexicon_sizes('lemma_lexicon', 'lemma', lemma_keys)
        root_sizes = self._fetch_lexicon_sizes('root_lexicon', 'root', root_keys)

        lemma_concepts: dict[str, dict] = {}
        root_concepts: dict[str, dict] = {}
        for row in token_rows:
            matched_token = normalize_arabic_token(row.get('imlaai_token'))
            if row.get('lemma') and row['lemma'] != '_':
                concept = lemma_concepts.setdefault(
                    row['lemma'],
                    {
                        'relation_type': 'lemma',
                        'concept_key': row['lemma'],
                        'display_term': row.get('lemma_ar') or row['lemma'],
                        'source_terms': [],
                        'matched_tokens': [],
                    },
                )
                concept['source_terms'] = dedupe_preserve_order(concept['source_terms'] + [matched_token])
                concept['matched_tokens'] = dedupe_preserve_order(concept['matched_tokens'] + [row.get('imlaai_token') or matched_token])

            if row.get('root') and row['root'] != '_':
                concept = root_concepts.setdefault(
                    row['root'],
                    {
                        'relation_type': 'root',
                        'concept_key': row['root'],
                        'display_term': row.get('root_ar') or row['root'],
                        'source_terms': [],
                        'matched_tokens': [],
                    },
                )
                concept['source_terms'] = dedupe_preserve_order(concept['source_terms'] + [matched_token])
                concept['matched_tokens'] = dedupe_preserve_order(concept['matched_tokens'] + [row.get('imlaai_token') or matched_token])

        profile['lemma_concepts'] = [
            {
                **concept,
                'weight': compute_inverse_size_weight(lemma_sizes.get(key), corpus_size),
            }
            for key, concept in lemma_concepts.items()
        ]
        
        # IDF Gating for Roots to prevent semantic drift from overly common roots
        ROOT_IDF_THRESHOLD = 3.5 
        
        profile['root_concepts'] = [
            {
                **concept,
                'weight': compute_inverse_size_weight(root_sizes.get(key), corpus_size),
            }
            for key, concept in root_concepts.items()
            if compute_inverse_size_weight(root_sizes.get(key), corpus_size) >= ROOT_IDF_THRESHOLD
        ]
        return profile

    def get_related_terms(self, profile: dict, limit: int = 12) -> list[dict]:
        rows: list[dict] = []
        excluded_terms = set(profile.get('comparison_terms') or [])
        excluded_terms.update(normalize_arabic_token(term) for term in profile.get('exact_terms') or [])

        for item in profile.get('semantic_expansions') or []:
            rows.append(
                {
                    'term': item.get('target_term') or item.get('normalized_target') or '',
                    'normalized_term': item.get('normalized_target') or '',
                    'count': 0,
                    'weight': float(item.get('weight') or 0.0),
                    'relation_type': item.get('relation_type') or 'semantic',
                    'source_terms': [item.get('source_term') or ''],
                    'reason': f"{item.get('relation_type') or 'semantic'} expansion from {item.get('source_term') or 'query'}",
                }
            )

        rows.extend(self._fetch_morphology_related_terms(profile.get('lemma_concepts') or [], concept_field='lemma'))
        rows.extend(self._fetch_morphology_related_terms(profile.get('root_concepts') or [], concept_field='root'))
        return merge_related_term_rows(rows, excluded_terms, limit=limit)

    def fetch_lemma_candidates(self, profile: dict, *, exclude_verse_id: int | None = None) -> list[dict]:
        lemma_keys = [item['concept_key'] for item in profile.get('lemma_concepts') or [] if item.get('concept_key')]
        if not lemma_keys:
            return []

        params = {'lemmas': lemma_keys}
        exclude_clause = ""
        if exclude_verse_id is not None:
            params['exclude_verse_id'] = exclude_verse_id
            exclude_clause = "AND qv.id <> :exclude_verse_id"

        # Group to avoid cartesian explosions and only return id/scores
        stmt = text(f"""
            SELECT qv.id,
                   qv.suraid,
                   qv.verse_num,
                   MAX(1.0) AS score
            FROM quran_verses qv
            JOIN quran_arabic_morphology_corpus mc
              ON mc.sura_no = qv.suraid AND mc.verse_no = qv.verse_num
            WHERE mc.lemma IN :lemmas {exclude_clause}
            GROUP BY qv.id, qv.suraid, qv.verse_num
        """).bindparams(bindparam('lemmas', expanding=True))
        
        return [dict(row._mapping) for row in self.db.execute(stmt, params)]

    def fetch_root_candidates(self, profile: dict, *, exclude_verse_id: int | None = None) -> list[dict]:
        root_keys = [item['concept_key'] for item in profile.get('root_concepts') or [] if item.get('concept_key')]
        if not root_keys:
            return []

        params = {'roots': root_keys}
        exclude_clause = ""
        if exclude_verse_id is not None:
            params['exclude_verse_id'] = exclude_verse_id
            exclude_clause = "AND qv.id <> :exclude_verse_id"

        stmt = text(f"""
            SELECT qv.id,
                   qv.suraid,
                   qv.verse_num,
                   MAX(0.3) AS score
            FROM quran_verses qv
            JOIN quran_arabic_morphology_corpus mc
              ON mc.sura_no = qv.suraid AND mc.verse_no = qv.verse_num
            WHERE mc.root IN :roots {exclude_clause}
            GROUP BY qv.id, qv.suraid, qv.verse_num
        """).bindparams(bindparam('roots', expanding=True))
        
        return [dict(row._mapping) for row in self.db.execute(stmt, params)]

    def fetch_embedding_candidates(self, profile: dict, *, exclude_verse_id: int | None = None) -> list[dict]:
        lemmas = [item['concept_key'] for item in profile.get('lemma_concepts') or [] if item.get('concept_key')]
        if not lemmas or not self.get_capabilities().get('embeddings_available'):
            return []
            
        params = {'lemmas': lemmas}
        exclude_clause = ""
        if exclude_verse_id is not None:
            params['exclude_verse_id'] = exclude_verse_id
            exclude_clause = "AND qv.id <> :exclude_verse_id"

        # Collapse all seed embeddings into a single centroid so the distance
        # comparison is against one query vector. That keeps the scan linear in
        # the table size (instead of rows x seeds) and lets pgvector use the
        # HNSW index on `embedding`.
        stmt = text(f"""
            WITH seed AS (
                SELECT AVG(embedding) AS centroid
                FROM quran_concept_embeddings
                WHERE lemma IN :lemmas
            )
            SELECT qv.id,
                   qv.suraid,
                   qv.verse_num,
                   MIN(e.embedding <=> seed.centroid) AS distance
            FROM quran_concept_embeddings e
            CROSS JOIN seed
            JOIN quran_verses qv ON qv.id = e.verse_id
            WHERE e.lemma NOT IN :lemmas {exclude_clause}
            GROUP BY qv.id, qv.suraid, qv.verse_num
            ORDER BY distance ASC
            LIMIT 100
        """).bindparams(bindparam('lemmas', expanding=True))

        try:
            rows = self.db.execute(stmt, params)
            return [{'id': r.id, 'suraid': r.suraid, 'verse_num': r.verse_num, 'score': 1.0 - r.distance} for r in rows if r.distance < 0.6]
        except Exception:
            logger.warning("Embedding search failed; ensure the pgvector table exists", exc_info=True)
            return []

    def build_source_profile(self, surah_id: int, verse_num: int) -> dict:
        capabilities = self.get_capabilities()
        if not capabilities['morphology_available']:
            return {'source_terms': [], 'lemma_concepts': [], 'root_concepts': [], 'capabilities': capabilities}

        rows = self.db.execute(
            text(
                """
                SELECT imlaai_token,
                       lemma,
                       COALESCE(NULLIF(lemma_ar, ''), lemma) AS lemma_label,
                       root,
                       COALESCE(NULLIF(root_ar, ''), root) AS root_label,
                       pos,
                       pos_ar,
                       COUNT(*) AS token_count
                FROM quran_arabic_morphology_corpus
                WHERE sura_no = :surah_id
                  AND verse_no = :verse_num
                  AND segment = 'STEM'
                  AND pos IN ('N', 'V', 'ADJ', 'PN', 'T', 'LOC')
                  AND COALESCE(imlaai_token, '') <> ''
                  AND imlaai_token NOT LIKE '(%%'
                GROUP BY imlaai_token, lemma, lemma_ar, root, root_ar, pos, pos_ar
                ORDER BY COUNT(*) DESC, imlaai_token ASC
                """
            ),
            {'surah_id': surah_id, 'verse_num': verse_num},
        )
        content_rows = [dict(row._mapping) for row in rows]
        corpus_size = self._get_morphology_corpus_size()

        lemma_keys = dedupe_preserve_order([row['lemma'] for row in content_rows if row.get('lemma') and row['lemma'] != '_'])
        root_keys = dedupe_preserve_order([row['root'] for row in content_rows if row.get('root') and row['root'] != '_'])
        lemma_sizes = self._fetch_lexicon_sizes('lemma_lexicon', 'lemma', lemma_keys)
        root_sizes = self._fetch_lexicon_sizes('root_lexicon', 'root', root_keys)

        lemma_dict = {}
        for row in content_rows:
            if row.get('lemma') and row['lemma'] != '_':
                key = row['lemma']
                if key not in lemma_dict:
                    lemma_dict[key] = {
                        'concept_key': key,
                        'display_term': row.get('lemma_label') or key,
                        'weight': compute_inverse_size_weight(lemma_sizes.get(key), corpus_size),
                    }
        lemma_concepts = sorted(lemma_dict.values(), key=lambda x: -x['weight'])[:7]

        root_dict = {}
        for row in content_rows:
            if row.get('root') and row['root'] != '_':
                key = row['root']
                if key not in root_dict:
                    root_dict[key] = {
                        'concept_key': key,
                        'display_term': row.get('root_label') or key,
                        'weight': compute_inverse_size_weight(root_sizes.get(key), corpus_size),
                    }
        root_concepts = sorted(root_dict.values(), key=lambda x: -x['weight'])[:7]
        source_terms = [
            {
                'term': row.get('imlaai_token') or '',
                'normalized_term': normalize_arabic_token(row.get('imlaai_token')),
                'lemma': row.get('lemma'),
                'root': row.get('root'),
                'pos': row.get('pos'),
                'pos_ar': row.get('pos_ar'),
                'weight': round(
                    compute_inverse_size_weight(lemma_sizes.get(row.get('lemma')), corpus_size)
                    + compute_inverse_size_weight(root_sizes.get(row.get('root')), corpus_size),
                    4,
                ),
            }
            for row in content_rows
            if normalize_arabic_token(row.get('imlaai_token'))
        ]

        return {
            'source_terms': source_terms[:12],
            'lemma_concepts': dedupe_preserve_order([item['concept_key'] for item in lemma_concepts]),
            'root_concepts': dedupe_preserve_order([item['concept_key'] for item in root_concepts]),
            'lemma_weights': {item['concept_key']: item['weight'] for item in lemma_concepts},
            'root_weights': {item['concept_key']: item['weight'] for item in root_concepts},
            'capabilities': capabilities,
        }

    def _table_exists(self, table_name: str) -> bool:
        return bool(
            self._safe_scalar(
                "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = :table_name",
                {'table_name': table_name},
                default=0,
            )
        )

    def _safe_scalar(self, sql: str, params: dict | None = None, *, default: int = 0) -> int:
        try:
            value = self.db.execute(text(sql), params or {}).scalar()
        except ProgrammingError:
            self.db.rollback()
            return default
        return int(value or default)

    def _get_morphology_corpus_size(self) -> int:
        if self._morphology_corpus_size is None:
            self._morphology_corpus_size = self._safe_scalar('SELECT COUNT(*) FROM quran_arabic_morphology_corpus', default=1)
        return self._morphology_corpus_size

    def _fetch_query_token_concepts(self, tokens: list[str]) -> list[dict]:
        if not tokens:
            return []

        statement = text(
            """
            SELECT imlaai_token,
                   lemma,
                   COALESCE(NULLIF(lemma_ar, ''), lemma) AS lemma_ar,
                   root,
                   COALESCE(NULLIF(root_ar, ''), root) AS root_ar,
                   COUNT(*) AS token_count
            FROM quran_arabic_morphology_corpus
            WHERE imlaai_token IN :tokens
            GROUP BY imlaai_token, lemma, lemma_ar, root, root_ar
            ORDER BY COUNT(*) DESC, imlaai_token ASC
            """
        ).bindparams(bindparam('tokens', expanding=True))
        rows = self.db.execute(statement, {'tokens': tokens})
        return [dict(row._mapping) for row in rows]

    def _fetch_lexicon_sizes(self, table_name: str, key_column: str, values: list[str]) -> dict[str, int]:
        if not values or not self._table_exists(table_name):
            return {}

        statement = text(
            f"SELECT {key_column} AS concept_key, size FROM {table_name} WHERE {key_column} IN :values"
        ).bindparams(bindparam('values', expanding=True))
        rows = self.db.execute(statement, {'values': values})
        return {str(row.concept_key): int(row.size or 0) for row in rows}

    def _fetch_semantic_expansions(self, normalized_terms: list[str]) -> list[dict]:
        if not normalized_terms:
            return []

        # 1. Seed rows via lemma match (acts as your "normalized layer")
        seed_stmt = text(
            """
            SELECT DISTINCT root, lemma, pos
            FROM quran_arabic_morphology_corpus
            WHERE lemma IN :terms
            """
        ).bindparams(bindparam("terms", expanding=True))

        seed_rows = self.db.execute(seed_stmt, {"terms": normalized_terms}).fetchall()
        if not seed_rows:
            return []

        roots = list({row.root for row in seed_rows if row.root})
        lemmas = list({row.lemma for row in seed_rows if row.lemma})

        expansions = []

        # 2. Derived forms (same lemma, cross POS)
        derived_stmt = text(
            """
            SELECT DISTINCT
                lemma AS source_term,
                imlaai_token AS target_term,
                lemma AS normalized_target,
                derived_nouns,
                pos
            FROM quran_arabic_morphology_corpus
            WHERE lemma IN :lemmas
            AND (
                    derived_nouns IS NOT NULL
                    OR pos IN ('N', 'ADJ')
            )
            """
        ).bindparams(bindparam("lemmas", expanding=True))

        for row in self.db.execute(derived_stmt, {"lemmas": lemmas}):
            expansions.append({
                "source_term": row.source_term,
                "target_term": row.target_term,
                "normalized_target": row.normalized_target,
                "relation_type": "derived_form",
                "weight": 1.0
            })

        # 3. Verb form expansion
        verb_stmt = text(
            """
            SELECT DISTINCT
                lemma AS source_term,
                imlaai_token AS target_term,
                lemma AS normalized_target,
                verb_form
            FROM quran_arabic_morphology_corpus
            WHERE lemma IN :lemmas
            AND pos = 'V'
            AND verb_form IS NOT NULL
            """
        ).bindparams(bindparam("lemmas", expanding=True))

        for row in self.db.execute(verb_stmt, {"lemmas": lemmas}):
            expansions.append({
                "source_term": row.source_term,
                "target_term": row.target_term,
                "normalized_target": row.normalized_target,
                "relation_type": "verb_form",
                "weight": 0.3
            })

        # 4. Vector Embedding Expansion
        capabilities = self.get_capabilities()
        if capabilities.get('embeddings_available') and lemmas:
            try:
                if not hasattr(self, '_vector_info'):
                    schema_row = self.db.execute(text("""
                        SELECT table_name, column_name
                        FROM information_schema.columns
                        WHERE table_schema = 'public' 
                          AND (column_name ILIKE '%embedding%' OR udt_name = 'vector')
                        LIMIT 1
                    """)).first()
                    if schema_row:
                        cols = self.db.execute(text(
                            "SELECT column_name FROM information_schema.columns WHERE table_name = :t"
                        ), {"t": schema_row.table_name}).fetchall()
                        cnames = [r.column_name for r in cols]
                        id_col = 'lemma' if 'lemma' in cnames else ('term' if 'term' in cnames else cnames[0])
                        self._vector_info = {'table': schema_row.table_name, 'vector_col': schema_row.column_name, 'id_col': id_col}
                    else:
                        self._vector_info = None

                if self._vector_info:
                    t_name = self._vector_info['table']
                    v_col = self._vector_info['vector_col']
                    i_col = self._vector_info['id_col']

                    vec_stmt = text(f"""
                        WITH seed_vectors AS (
                            SELECT {v_col} AS vec, {i_col} AS source_term
                            FROM {t_name}
                            WHERE {i_col} IN :lemmas
                        )
                        SELECT t.{i_col} AS target_term, sv.source_term, (t.{v_col} <=> sv.vec) AS distance
                        FROM {t_name} t
                        JOIN seed_vectors sv ON true
                        WHERE t.{i_col} NOT IN :lemmas
                        ORDER BY distance ASC
                        LIMIT 20
                    """).bindparams(bindparam("lemmas", expanding=True))

                    for row in self.db.execute(vec_stmt, {"lemmas": lemmas}):
                        if row.distance < 0.5:
                            expansions.append({
                                "source_term": row.source_term,
                                "target_term": row.target_term,
                                "normalized_target": row.target_term,
                                "relation_type": "semantic_embedding",
                                "weight": 0.9
                            })
            except Exception:
                logger.warning("Embedding expansion failed", exc_info=True)

        # deduplicate by lemma (normalized_target)
        dedup = {}
        for e in expansions:
            key = e["normalized_target"]
            if key not in dedup or e["weight"] > dedup[key]["weight"]:
                dedup[key] = e

        # Calculate IDF weights for the target lemmas to scale the static relation weights
        target_lemmas = list(dedup.keys())
        corpus_size = self._get_morphology_corpus_size()
        lemma_sizes = self._fetch_lexicon_sizes('lemma_lexicon', 'lemma', target_lemmas)
        
        for e in dedup.values():
            base_weight = e["weight"]
            idf = compute_inverse_size_weight(lemma_sizes.get(e["normalized_target"]), corpus_size)
            e["weight"] = round(base_weight * idf, 4)

        return sorted(
            dedup.values(),
            key=lambda x: (-x["weight"], x["normalized_target"])
        )

    def _fetch_morphology_related_terms(self, concepts: list[dict], *, concept_field: str) -> list[dict]:
        concept_keys = [item.get('concept_key') for item in concepts if item.get('concept_key')]
        if not concept_keys:
            return []

        relation_label = 'lemma' if concept_field == 'lemma' else 'root'
        statement = text(
            f"""
            SELECT imlaai_token,
                   COUNT(*) AS token_count,
                   COUNT(DISTINCT (sura_no::text || ':' || verse_no::text)) AS verse_count,
                   {concept_field} AS concept_key
            FROM quran_arabic_morphology_corpus
            WHERE {concept_field} IN :concept_keys
              AND COALESCE(imlaai_token, '') <> ''
            GROUP BY imlaai_token, {concept_field}
            ORDER BY COUNT(DISTINCT (sura_no::text || ':' || verse_no::text)) DESC,
                     COUNT(*) DESC,
                     imlaai_token ASC
            """
        ).bindparams(bindparam('concept_keys', expanding=True))
        rows = self.db.execute(statement, {'concept_keys': concept_keys})

        concept_sources = {
            item['concept_key']: item.get('source_terms') or []
            for item in concepts
            if item.get('concept_key')
        }
        concept_weights = {
            item['concept_key']: float(item.get('weight') or 0.0)
            for item in concepts
            if item.get('concept_key')
        }
        return [
            {
                'term': row.imlaai_token,
                'normalized_term': normalize_arabic_token(row.imlaai_token),
                'count': int(row.verse_count or 0),
                'weight': concept_weights.get(str(row.concept_key), 0.0),
                'relation_type': relation_label,
                'source_terms': concept_sources.get(str(row.concept_key), []),
                'reason': f"Shares {relation_label} concept {row.concept_key}",
            }
            for row in rows
        ]