from uuid import uuid4
from sqlalchemy import text
from sqlalchemy.exc import ProgrammingError
from sqlalchemy.orm import Session
from backend.app.services.search_utils import (
    check_stopword_query,
    detect_language,
    highlight_text,
    normalize_arabic_token,
    parse_search_query,
    tokenize_generic_text,
)
from backend.app.services.quran_semantic import QuranSemanticRepository


class QuranService:
    def __init__(self, db: Session):
        self.db = db
        self.semantic = QuranSemanticRepository(db)

    def get_all_surahs(self) -> list[dict]:
        rows = self.db.execute(text("SELECT suraid, name_ar, name_en, name_he, page FROM quran_chapters ORDER BY suraid ASC"))
        return [dict(row._mapping) for row in rows]

    def get_verses(self, surah_id: int) -> list[dict]:
        rows = self.db.execute(text("""
            SELECT id, suraid, verse_num, verse_txt, verse_txt_en, verse_txt_he, verse_txt_raw, page
            FROM quran_verses
            WHERE suraid = :surah_id
            ORDER BY verse_num ASC
        """), {"surah_id": surah_id})
        return [dict(row._mapping) for row in rows]

    def get_verse_reference(self, surah_id: int, verse_num: int) -> dict | None:
        row = self.db.execute(text("""
            SELECT id, suraid, verse_num, verse_txt, verse_txt_en, verse_txt_he, verse_txt_raw, page, normalized_tokens
            FROM quran_verses
            WHERE suraid = :surah_id AND verse_num = :verse_num
            LIMIT 1
        """), {"surah_id": surah_id, "verse_num": verse_num}).first()
        return dict(row._mapping) if row else None

    def _get_query_terms(self, parsed, language: str) -> list[str]:
        if language == 'ar':
            return [token for token in tokenize_generic_text(parsed.normalized, language) if token]
        return parsed.terms or tokenize_generic_text(parsed.normalized, language)

    def _get_highlight_source(self, row: dict, language: str) -> str:
        if language == 'ar':
            return str(row.get('verse_txt_raw') or row.get('verse_txt') or '')
        if language == 'he':
            return str(row.get('verse_txt_he') or row.get('verse_txt_en') or row.get('verse_txt_raw') or '')
        return str(row.get('verse_txt_en') or row.get('verse_txt_raw') or row.get('verse_txt_he') or '')

    def _build_direct_search_query(self, parsed, language: str) -> tuple[str, dict[str, object], list[str]]:
        conditions: list[str] = []
        params: dict[str, object] = {}
        highlight_terms: list[str] = []

        if language == 'ar':
            query_terms = [normalize_arabic_token(term) for term in self._get_query_terms(parsed, language) if normalize_arabic_token(term)]
            for index, phrase in enumerate(parsed.phrases):
                conditions.append(f"verse_txt_raw ILIKE :phrase_{index}")
                params[f'phrase_{index}'] = f"%{phrase}%"
                highlight_terms.append(phrase)
            for index, term in enumerate(query_terms):
                conditions.append(f"normalized_tokens ILIKE :term_{index}")
                params[f'term_{index}'] = f"%{term}%"
            highlight_terms.extend(self._get_query_terms(parsed, language))
        else:
            column_name = 'verse_txt_he' if language == 'he' else 'verse_txt_en'
            query_terms = [term for term in self._get_query_terms(parsed, language) if term]
            for index, phrase in enumerate(parsed.phrases):
                conditions.append(f"{column_name} ILIKE :phrase_{index}")
                params[f'phrase_{index}'] = f"%{phrase}%"
                highlight_terms.append(phrase)
            for index, term in enumerate(query_terms):
                conditions.append(f"{column_name} ILIKE :term_{index}")
                params[f'term_{index}'] = f"%{term}%"
                highlight_terms.append(term)

        if not conditions:
            if language == 'ar':
                conditions.append('verse_txt_raw ILIKE :normalized')
            elif language == 'he':
                conditions.append('verse_txt_he ILIKE :normalized')
            else:
                conditions.append('verse_txt_en ILIKE :normalized')
            params['normalized'] = f"%{parsed.normalized}%"
            highlight_terms.append(parsed.normalized)

        return ' AND '.join(f'({condition})' for condition in conditions), params, [term for term in highlight_terms if term]

    def _fetch_direct_candidates(self, parsed, language: str) -> list[dict]:
        where_clause, params, _ = self._build_direct_search_query(parsed, language)
        rows = self.db.execute(text(f"""
            SELECT id, suraid, verse_num, verse_txt, verse_txt_en, verse_txt_he, verse_txt_raw, page, normalized_tokens
            FROM quran_verses
            WHERE {where_clause}
            ORDER BY suraid ASC, verse_num ASC
        """), params)
        return [dict(row._mapping) for row in rows]

    def _match_query_terms(self, row: dict, language: str, profile: dict) -> list[str]:
        search_text = self._get_highlight_source(row, language)
        if language == 'ar':
            normalized_search = normalize_arabic_token(search_text)
            return [term for term in profile.get('exact_terms') or [] if normalize_arabic_token(term) and normalize_arabic_token(term) in normalized_search]

        lowered = search_text.lower()
        return [term for term in profile.get('exact_terms') or [] if term.lower() in lowered]

    def _create_result_bucket(self, row: dict, language: str) -> dict:
        item = {**row}
        item['versenum'] = item.get('verse_num')
        item['suranum'] = item.get('suraid')
        item['_highlight_terms'] = []
        item['_exact_matches'] = []
        item['_concept_matches'] = []
        item['_concept_match_keys'] = set()
        item['_semantic_matches'] = []
        item['_score'] = 0.0
        item['_language'] = language
        return item

    def _apply_direct_matches(self, bucket: dict, profile: dict) -> None:
        exact_matches = self._match_query_terms(bucket, bucket['_language'], profile)
        bucket['_exact_matches'] = exact_matches
        bucket['_highlight_terms'] = list(dict.fromkeys(bucket['_highlight_terms'] + exact_matches + (profile.get('phrases') or [])))
        bucket['_score'] += float(len(exact_matches)) * 3.0

    def _apply_concept_row(self, bucket: dict, row: dict, profile: dict) -> None:
        lemma_weights = {item['concept_key']: float(item.get('weight') or 0.0) for item in profile.get('lemma_concepts') or []}
        root_weights = {item['concept_key']: float(item.get('weight') or 0.0) for item in profile.get('root_concepts') or []}
        relation_type = None
        concept_key = None
        concept_label = None
        weight = 0.0

        if row.get('lemma') in lemma_weights:
            relation_type = 'lemma'
            concept_key = row.get('lemma')
            concept_label = row.get('lemma_label') or row.get('lemma')
            weight = lemma_weights.get(row.get('lemma'), 0.0)
        elif row.get('root') in root_weights:
            relation_type = 'root'
            concept_key = row.get('root')
            concept_label = row.get('root_label') or row.get('root')
            weight = root_weights.get(row.get('root'), 0.0)

        if not relation_type or not concept_key:
            return

        evidence_key = f"{relation_type}:{concept_key}:{row.get('imlaai_token') or ''}"
        if evidence_key in bucket['_concept_match_keys']:
            return
        bucket['_concept_match_keys'].add(evidence_key)
        bucket['_concept_matches'].append(
            {
                'term': row.get('imlaai_token') or '',
                'concept_key': concept_key,
                'concept_label': concept_label,
                'relation_type': relation_type,
                'weight': round(weight, 4),
            }
        )
        if row.get('imlaai_token'):
            bucket['_highlight_terms'] = list(dict.fromkeys(bucket['_highlight_terms'] + [row['imlaai_token']]))
        bucket['_score'] += weight

    def _apply_semantic_row(self, bucket: dict, expansion: dict) -> None:
        evidence_key = f"semantic:{expansion.get('normalized_target') or expansion.get('target_term') or ''}"
        if evidence_key in bucket['_concept_match_keys']:
            return
        bucket['_concept_match_keys'].add(evidence_key)
        bucket['_semantic_matches'].append(
            {
                'term': expansion.get('target_term') or expansion.get('normalized_target') or '',
                'relation_type': expansion.get('relation_type') or 'semantic',
                'source_term': expansion.get('source_term') or '',
                'weight': round(float(expansion.get('weight') or 0.0), 4),
            }
        )
        if expansion.get('target_term'):
            bucket['_highlight_terms'] = list(dict.fromkeys(bucket['_highlight_terms'] + [str(expansion['target_term'])]))
        bucket['_score'] += float(expansion.get('weight') or 0.0)

    def _finalize_search_results(self, buckets: dict[int, dict], profile: dict, offset: int, limit: int) -> list[dict]:
        finalized: list[dict] = []
        for item in buckets.values():
            language = item.pop('_language')
            highlight_source = self._get_highlight_source(item, language)
            highlight_terms = item.pop('_highlight_terms')
            exact_matches = item.pop('_exact_matches')
            concept_matches = item.pop('_concept_matches')
            semantic_matches = item.pop('_semantic_matches')
            item.pop('_concept_match_keys')
            search_score = round(float(item.pop('_score')), 4)
            item['verse_txt_highlighted'] = highlight_text(highlight_source, highlight_terms)
            item['search_mode'] = 'phrase' if profile.get('phrases') else 'hybrid'
            item['exact_match_count'] = len(exact_matches)
            item['occurrence_count'] = len(exact_matches) + len(concept_matches) + len(semantic_matches)
            item['matched_terms'] = exact_matches
            item['search_score'] = search_score
            if exact_matches and (concept_matches or semantic_matches):
                match_type = 'hybrid'
            elif exact_matches:
                match_type = 'exact'
            else:
                match_type = 'concept'
            item['match_explanation'] = {
                'match_type': match_type,
                'matched_terms': exact_matches,
                'concept_matches': concept_matches,
                'semantic_matches': semantic_matches,
            }
            finalized.append(item)

        finalized.sort(
            key=lambda item: (
                -int(item['exact_match_count'] > 0),
                -int(item['exact_match_count']),
                -float(item['search_score']),
                -int(item['occurrence_count']),
                item['suraid'],
                item['verse_num'],
            )
        )
        return finalized[offset:offset + limit]

    def get_related_verses_by_subject(self, surah_id: int, verse_num: int, limit: int = 20) -> dict | None:
        source = self.get_verse_reference(surah_id, verse_num)
        if not source:
            return None
        source_profile = self.semantic.build_source_profile(surah_id, verse_num)
        candidate_rows = self.semantic.fetch_concept_candidate_rows(
            {
                'lemma_concepts': [{'concept_key': key, 'weight': weight} for key, weight in (source_profile.get('lemma_weights') or {}).items()],
                'root_concepts': [{'concept_key': key, 'weight': weight} for key, weight in (source_profile.get('root_weights') or {}).items()],
            },
            exclude_verse_id=source['id'],
        )

        if not candidate_rows:
            return {"source_verse": {**source, "versenum": source["verse_num"], "suranum": source["suraid"]}, "source_terms": source_profile.get('source_terms') or [], "count": 0, "results": []}

        results_by_id: dict[int, dict] = {}
        lemma_weights = source_profile.get('lemma_weights') or {}
        root_weights = source_profile.get('root_weights') or {}
        for row in candidate_rows:
            bucket = results_by_id.get(row['id'])
            if bucket is None:
                bucket = {**row, 'versenum': row['verse_num'], 'suranum': row['suraid'], 'matched_terms': [], 'match_details': [], 'subject_score': 0.0}
                results_by_id[row['id']] = bucket

            relation_type = None
            concept_key = None
            concept_weight = 0.0
            if row.get('lemma') in lemma_weights:
                relation_type = 'lemma'
                concept_key = row.get('lemma')
                concept_weight = float(lemma_weights.get(row.get('lemma'), 0.0))
            elif row.get('root') in root_weights:
                relation_type = 'root'
                concept_key = row.get('root')
                concept_weight = float(root_weights.get(row.get('root'), 0.0))

            if not relation_type or not concept_key:
                continue

            detail_key = f"{relation_type}:{concept_key}:{row.get('imlaai_token') or ''}"
            existing_keys = {f"{item['relation_type']}:{item['concept_key']}:{item['term']}" for item in bucket['match_details']}
            if detail_key in existing_keys:
                continue

            matched_term = str(row.get('imlaai_token') or '')
            if matched_term:
                bucket['matched_terms'].append(matched_term)
            bucket['match_details'].append(
                {
                    'term': matched_term,
                    'relation_type': relation_type,
                    'concept_key': concept_key,
                    'weight': round(concept_weight, 4),
                }
            )
            bucket['subject_score'] = round(float(bucket['subject_score']) + concept_weight, 4)

        results = []
        for item in results_by_id.values():
            item['matched_terms'] = list(dict.fromkeys(item['matched_terms']))[:8]
            item['occurrence_count'] = len(item['match_details'])
            item['verse_txt_highlighted'] = highlight_text(item.get('verse_txt_raw'), item['matched_terms'])
            item['signal_scores'] = {
                'concepts': len(item['match_details']),
                'score': item['subject_score'],
            }
            results.append(item)

        results.sort(key=lambda item: (-float(item['subject_score']), -int(item['occurrence_count']), item['suraid'], item['verse_num']))
        results = results[:limit]

        return {
            "source_verse": {**source, "versenum": source["verse_num"], "suranum": source["suraid"]},
            "source_terms": source_profile.get('source_terms') or [],
            "count": len(results),
            "results": results,
        }

    def search_ontology_seed_terms(self, terms: list[str], limit_per_term: int = 100) -> dict:
        normalized_terms: list[str] = []
        seen_terms: set[str] = set()
        for term in terms:
            cleaned = str(term or '').strip()
            if not cleaned or cleaned in seen_terms:
                continue
            seen_terms.add(cleaned)
            normalized_terms.append(cleaned)

        results_by_reference: dict[tuple[int, int], dict] = {}

        overfetch  = 100

        for term in normalized_terms:
            is_stopword_only, _ = check_stopword_query(term)
            if is_stopword_only:
                continue

            # search_result = self.search(term, limit_per_term, 0, {})            
            search_result = self.search(term, overfetch, 0, {})



            for verse in search_result.get('results') or []:
                surah = int(verse.get('suraid') or verse.get('suranum') or 0)
                verse_num = int(verse.get('verse_num') or verse.get('versenum') or 0)
                if not surah or not verse_num:
                    continue

                key = (surah, verse_num)
                bucket = results_by_reference.get(key)
                if bucket is None:
                    bucket = {
                        **verse,
                        'suraid': surah,
                        'suranum': surah,
                        'verse_num': verse_num,
                        'versenum': verse_num,
                        'source_terms': [],
                        'aggregated_search_score': 0.0,
                        'match_count': 0,
                    }
                    results_by_reference[key] = bucket

                if term not in bucket['source_terms']:
                    bucket['source_terms'].append(term)
                bucket['aggregated_search_score'] = round(
                    float(bucket['aggregated_search_score']) + float(verse.get('search_score') or 0.0),
                    4,
                )
                bucket['match_count'] += 1

        results = list(results_by_reference.values())
        results.sort(
            key=lambda item: (
                -len(item.get('source_terms') or []),
                -float(item.get('aggregated_search_score') or 0.0),
                item['suraid'],
                item['verse_num'],
            )
        )

        return {
            'terms': normalized_terms,
            'count': len(results),
            # 'results': results,
            'results': results[:20],
        }

    def create_ontology_concept(self, label: str | None, terms: list[str], selected_verses: list[dict]) -> dict:
        concept_id = uuid4()
        return self._save_ontology_concept(concept_id, label, terms, selected_verses, replace_existing=False)

    def update_ontology_concept(self, concept_id: str, label: str | None, terms: list[str], selected_verses: list[dict]) -> dict | None:
        concept_exists = self.db.execute(
            text(
                """
                SELECT 1
                FROM concepts
                WHERE id = :concept_id
                LIMIT 1
                """
            ),
            {'concept_id': concept_id},
        ).first()
        if not concept_exists:
            return None

        return self._save_ontology_concept(concept_id, label, terms, selected_verses, replace_existing=True)

    def delete_ontology_concept(self, concept_id: str) -> bool:
        concept_exists = self.db.execute(
            text(
                """
                SELECT 1
                FROM concepts
                WHERE id = :concept_id
                LIMIT 1
                """
            ),
            {'concept_id': concept_id},
        ).first()
        if not concept_exists:
            return False

        try:
            self.db.execute(
                text(
                    """
                    DELETE FROM concept_seed_terms
                    WHERE concept_id = :concept_id
                    """
                ),
                {'concept_id': concept_id},
            )
            self.db.execute(
                text(
                    """
                    DELETE FROM concept_verse_links
                    WHERE concept_id = :concept_id
                    """
                ),
                {'concept_id': concept_id},
            )
            self.db.execute(
                text(
                    """
                    DELETE FROM concepts
                    WHERE id = :concept_id
                    """
                ),
                {'concept_id': concept_id},
            )
            self.db.commit()
        except Exception:
            self.db.rollback()
            raise

        return True

    def _save_ontology_concept(self, concept_id: str | object, label: str | None, terms: list[str], selected_verses: list[dict], *, replace_existing: bool) -> dict:
        concept_label = str(label or '').strip() or None

        normalized_terms: list[str] = []
        seen_terms: set[str] = set()
        for term in terms:
            cleaned = str(term or '').strip()
            if not cleaned or cleaned in seen_terms:
                continue
            seen_terms.add(cleaned)
            normalized_terms.append(cleaned)

        verse_rows: list[dict] = []
        seen_references: set[tuple[int, int]] = set()
        for item in selected_verses:
            surah = int(item.get('surah') or 0)
            verse = int(item.get('verse') or 0)
            if not surah or not verse:
                continue

            reference = (surah, verse)
            if reference in seen_references:
                continue
            seen_references.add(reference)

            source_terms = []
            seen_source_terms: set[str] = set()
            for term in item.get('source_terms') or []:
                cleaned_term = str(term or '').strip()
                if not cleaned_term or cleaned_term in seen_source_terms:
                    continue
                seen_source_terms.add(cleaned_term)
                source_terms.append(cleaned_term)

            verse_rows.append(
                {
                    'surah': surah,
                    'verse': verse,
                    'source_terms': source_terms,
                }
            )

        with self.db.begin():
            if replace_existing:
                self.db.execute(
                    text(
                        """
                        UPDATE concepts
                        SET label = :label
                        WHERE id = :id
                        """
                    ),
                    {'id': concept_id, 'label': concept_label},
                )
                self.db.execute(
                    text(
                        """
                        DELETE FROM concept_seed_terms
                        WHERE concept_id = :concept_id
                        """
                    ),
                    {'concept_id': concept_id},
                )
                self.db.execute(
                    text(
                        """
                        DELETE FROM concept_verse_links
                        WHERE concept_id = :concept_id
                        """
                    ),
                    {'concept_id': concept_id},
                )
            else:
                self.db.execute(
                    text(
                        """
                        INSERT INTO concepts (id, label)
                        VALUES (:id, :label)
                        """
                    ),
                    {'id': concept_id, 'label': concept_label},
                )

            for term in normalized_terms:
                self.db.execute(
                    text(
                        """
                        INSERT INTO concept_seed_terms (concept_id, term)
                        VALUES (:concept_id, :term)
                        ON CONFLICT (concept_id, term) DO NOTHING
                        """
                    ),
                    {'concept_id': concept_id, 'term': term},
                )

            for verse_row in verse_rows:
                self.db.execute(
                    text(
                        """
                        INSERT INTO concept_verse_links (concept_id, surah, verse, source_terms, approved)
                        VALUES (:concept_id, :surah, :verse, :source_terms, TRUE)
                        ON CONFLICT (concept_id, surah, verse) DO UPDATE
                        SET source_terms = EXCLUDED.source_terms,
                            approved = EXCLUDED.approved
                        """
                    ),
                    {
                        'concept_id': concept_id,
                        'surah': verse_row['surah'],
                        'verse': verse_row['verse'],
                        'source_terms': verse_row['source_terms'],
                    },
                )

        return {
            'id': str(concept_id),
            'label': concept_label,
            'display_label': concept_label or 'Untitled concept',
            'terms': normalized_terms,
            'selected_verse_count': len(verse_rows),
        }

    def list_ontology_concepts(self) -> list[dict]:
        rows = self.db.execute(
            text(
                """
                SELECT c.id,
                       c.label,
                       c.created_at,
                       COALESCE(
                         ARRAY(
                           SELECT cst.term
                           FROM concept_seed_terms cst
                           WHERE cst.concept_id = c.id
                           ORDER BY cst.term ASC
                         ),
                         ARRAY[]::TEXT[]
                       ) AS terms,
                       COALESCE(
                         (
                           SELECT COUNT(*)
                           FROM concept_verse_links cvl
                           WHERE cvl.concept_id = c.id
                             AND cvl.approved = TRUE
                         ),
                         0
                       ) AS approved_verse_count
                FROM concepts c
                ORDER BY c.created_at DESC
                """
            )
        )
        items = []
        for row in rows:
            item = dict(row._mapping)
            item['id'] = str(item['id'])
            item['display_label'] = item.get('label') or 'Untitled concept'
            items.append(item)
        return items

    def get_ontology_concept(self, concept_id: str) -> dict | None:
        concept_row = self.db.execute(
            text(
                """
                SELECT id, label, created_at
                FROM concepts
                WHERE id = :concept_id
                LIMIT 1
                """
            ),
            {'concept_id': concept_id},
        ).first()
        if not concept_row:
            return None

        terms_rows = self.db.execute(
            text(
                """
                SELECT term
                FROM concept_seed_terms
                WHERE concept_id = :concept_id
                ORDER BY term ASC
                """
            ),
            {'concept_id': concept_id},
        )
        verse_rows = self.db.execute(
            text(
                """
                SELECT cvl.surah,
                       cvl.verse,
                       cvl.source_terms,
                       cvl.approved,
                       cvl.created_at,
                       qv.verse_txt,
                       qv.verse_txt_en,
                       qv.verse_txt_he,
                       qv.verse_txt_raw
                FROM concept_verse_links cvl
                LEFT JOIN quran_verses qv
                  ON qv.suraid = cvl.surah
                 AND qv.verse_num = cvl.verse
                WHERE cvl.concept_id = :concept_id
                ORDER BY cvl.surah ASC, cvl.verse ASC
                """
            ),
            {'concept_id': concept_id},
        )

        concept = dict(concept_row._mapping)
        concept['id'] = str(concept['id'])
        concept['display_label'] = concept.get('label') or 'Untitled concept'
        concept['terms'] = [str(row.term) for row in terms_rows]
        concept['verses'] = [dict(row._mapping) for row in verse_rows]
        return concept

    def search(self, query: str, limit: int, offset: int, options: dict | None = None) -> dict:
        parsed = parse_search_query(query)
        capabilities = self.semantic.get_capabilities()
        if not parsed.normalized:
            return {
                'count': 0,
                'results': [],
                'related_terms': [],
                'search_info': {
                    'query_normalized': '',
                    'language': 'en',
                    'query_expansions': [],
                    'semantic_capabilities': capabilities,
                    'fallback_reason': capabilities.get('fallback_reason'),
                },
            }

        is_stopword_only, language = check_stopword_query(query)
        if is_stopword_only:
            return {
                'count': 0,
                'results': [],
                'related_terms': [],
                'search_info': {
                    'query_normalized': parsed.normalized,
                    'language': language,
                    'query_expansions': [],
                    'semantic_capabilities': capabilities,
                    'fallback_reason': capabilities.get('fallback_reason'),
                    'stopword_only': True,
                },
            }

        language = detect_language(parsed.normalized)
        query_terms = self._get_query_terms(parsed, language)
        profile = self.semantic.build_query_profile(query_terms, parsed.phrases, language)

        direct_rows = self._fetch_direct_candidates(parsed, language)
        concept_rows = self.semantic.fetch_concept_candidate_rows(profile)
        semantic_rows = self.semantic.fetch_semantic_candidate_rows(profile)
        expansion_lookup = {
            item.get('normalized_target'): item
            for item in profile.get('semantic_expansions') or []
            if item.get('normalized_target')
        }

        results_by_id: dict[int, dict] = {}
        for row in direct_rows:
            bucket = results_by_id.setdefault(row['id'], self._create_result_bucket(row, language))
            self._apply_direct_matches(bucket, profile)

        for row in concept_rows:
            bucket = results_by_id.setdefault(row['id'], self._create_result_bucket(row, language))
            self._apply_concept_row(bucket, row, profile)

        for row in semantic_rows:
            bucket = results_by_id.setdefault(row['id'], self._create_result_bucket(row, language))
            matched_targets = []
            normalized_tokens = [normalize_arabic_token(token) for token in tokenize_generic_text(row.get('verse_txt_raw'), 'ar')]
            for token in normalized_tokens:
                if token in expansion_lookup:
                    matched_targets.append(expansion_lookup[token])
            for expansion in matched_targets:
                self._apply_semantic_row(bucket, expansion)

        all_results = self._finalize_search_results(results_by_id, profile, 0, len(results_by_id))
        related_terms = self.semantic.get_related_terms(profile)
        search_info = {
            'query_normalized': parsed.normalized,
            'language': language,
            'query_expansions': [
                {
                    'term': item.get('target_term') or item.get('normalized_target') or '',
                    'relation_type': item.get('relation_type') or 'semantic',
                    'weight': float(item.get('weight') or 0.0),
                }
                for item in profile.get('semantic_expansions') or []
            ]
            + [
                {
                    'term': item.get('display_term') or item.get('concept_key') or '',
                    'relation_type': item.get('relation_type') or 'concept',
                    'weight': float(item.get('weight') or 0.0),
                }
                for item in (profile.get('lemma_concepts') or []) + (profile.get('root_concepts') or [])
            ],
            'semantic_capabilities': capabilities,
            'fallback_reason': capabilities.get('fallback_reason'),
        }
        return {
            'count': len(all_results),
            'results': all_results[offset:offset + limit],
            'related_terms': related_terms,
            'search_info': search_info,
        }
