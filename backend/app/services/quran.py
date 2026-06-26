import json
from uuid import uuid4
from sqlalchemy import text, bindparam
from sqlalchemy.orm import Session
from backend.app.services.search_utils import (
    check_stopword_query,
    detect_language,
    escape_like,
    highlight_text,
    normalize_arabic_token,
    parse_search_query,
    tokenize_generic_text,
)
from backend.app.services.quran_semantic import QuranSemanticRepository
from backend.app.services.ranking import reciprocal_rank_fusion, rerank_candidates


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
                params[f'phrase_{index}'] = f"%{escape_like(phrase)}%"
                highlight_terms.append(phrase)
            for index, term in enumerate(query_terms):
                conditions.append(f"normalized_tokens ILIKE :term_{index}")
                params[f'term_{index}'] = f"%{escape_like(term)}%"
            highlight_terms.extend(self._get_query_terms(parsed, language))
        else:
            column_name = 'verse_txt_he' if language == 'he' else 'verse_txt_en'
            query_terms = [term for term in self._get_query_terms(parsed, language) if term]
            for index, phrase in enumerate(parsed.phrases):
                conditions.append(f"{column_name} ILIKE :phrase_{index}")
                params[f'phrase_{index}'] = f"%{escape_like(phrase)}%"
                highlight_terms.append(phrase)
            for index, term in enumerate(query_terms):
                conditions.append(f"{column_name} ILIKE :term_{index}")
                params[f'term_{index}'] = f"%{escape_like(term)}%"
                highlight_terms.append(term)

        if not conditions:
            if language == 'ar':
                conditions.append('verse_txt_raw ILIKE :normalized')
            elif language == 'he':
                conditions.append('verse_txt_he ILIKE :normalized')
            else:
                conditions.append('verse_txt_en ILIKE :normalized')
            params['normalized'] = f"%{escape_like(parsed.normalized)}%"
            highlight_terms.append(parsed.normalized)

        return ' AND '.join(f'({condition})' for condition in conditions), params, [term for term in highlight_terms if term]

    def _fetch_direct_candidates(self, parsed, language: str) -> list[dict]:
        where_clause, params, _ = self._build_direct_search_query(parsed, language)
        rows = self.db.execute(text(f"""
            SELECT id, suraid, verse_num
            FROM quran_verses
            WHERE {where_clause}
            ORDER BY suraid ASC, verse_num ASC
        """), params)
        return [dict(row._mapping) for row in rows]

    def _fetch_verses_by_ids(self, verse_ids: list[int]) -> list[dict]:
        if not verse_ids:
            return []
        rows = self.db.execute(text("""
            SELECT id, suraid, verse_num, verse_txt, verse_txt_en, verse_txt_he, verse_txt_raw, page, normalized_tokens
            FROM quran_verses
            WHERE id IN :ids
        """).bindparams(bindparam('ids', expanding=True)), {'ids': verse_ids})
        return [dict(row._mapping) for row in rows]

    def get_related_verses_by_subject(self, surah_id: int, verse_num: int, limit: int = 20) -> dict | None:
        source = self.get_verse_reference(surah_id, verse_num)
        if not source:
            return None
        source_profile = self.semantic.build_source_profile(surah_id, verse_num)
        search_profile = {
            'lemma_concepts': [{'concept_key': key, 'weight': weight} for key, weight in (source_profile.get('lemma_weights') or {}).items()],
            'root_concepts': [{'concept_key': key, 'weight': weight} for key, weight in (source_profile.get('root_weights') or {}).items()],
        }
        
        lemma_cands = self.semantic.fetch_lemma_candidates(search_profile, exclude_verse_id=source['id'])
        root_cands = self.semantic.fetch_root_candidates(search_profile, exclude_verse_id=source['id'])
        # True verse-to-verse semantic neighbours from stored verse embeddings.
        verse_semantic_cands = self.semantic.fetch_related_verse_candidates(source['id'])

        channel_results = {'lemma': lemma_cands, 'root': root_cands, 'verse_semantic': verse_semantic_cands}
        candidates = reciprocal_rank_fusion(channel_results)
        
        top_cands = candidates[:max(200, limit)]
        verse_ids = [c.verse_id for c in top_cands]
        
        if not verse_ids:
            return {"source_verse": {**source, "versenum": source["verse_num"], "suranum": source["suraid"]}, "source_terms": source_profile.get('source_terms') or [], "count": 0, "results": []}
            
        hydrated_rows = self._fetch_verses_by_ids(verse_ids)
        row_map = {r['id']: r for r in hydrated_rows}
        for c in top_cands:
            c.verse_data = row_map.get(c.verse_id)

        reranked = rerank_candidates(top_cands, search_profile)
        
        results = []
        for c in reranked:
            if not c.verse_data:
                continue
            item = {**c.verse_data}
            item['versenum'] = item['verse_num']
            item['suranum'] = item['suraid']
            item['matched_terms'] = []
            item['occurrence_count'] = len(c.match_evidence)
            item['verse_txt_highlighted'] = highlight_text(item.get('verse_txt_raw'), item['matched_terms'])
            item['signal_scores'] = {
                'concepts': len(c.match_evidence),
                'score': c.final_score,
            }
            results.append(item)

        results.sort(key=lambda item: (-float(item['signal_scores']['score']), -int(item['occurrence_count']), item['suraid'], item['verse_num']))
        results = results[:limit]

        return {
            "source_verse": {**source, "versenum": source["verse_num"], "suranum": source["suraid"]},
            "source_terms": source_profile.get('source_terms') or [],
            "count": len(results),
            "results": results,
        }

    def suggest_concept_verses(self, text: str | None, verses: list[dict] | None, limit: int = 15) -> dict:
        """Semantic verse suggestions for an ontology node.

        Merges two signals: text->verse (embed the node's title/article and ANN
        search) and verse-to-verse (neighbours of each already-connected verse).
        Already-connected verses are excluded; multi-signal hits rank higher.
        """
        verses = verses or []
        capabilities = self.semantic.get_capabilities()
        connected = {
            (int(v.get('surah') or v.get('suraid') or 0), int(v.get('verse') or v.get('verse_num') or 0))
            for v in verses
        }

        merged: dict[int, dict] = {}

        def add(rows: list[dict], source: str) -> None:
            for row in rows:
                vid = row['id']
                score = float(row.get('score') or 0.0)
                bucket = merged.get(vid)
                if bucket is None:
                    merged[vid] = {'id': vid, 'suraid': row['suraid'], 'verse_num': row['verse_num'],
                                   'score': score, 'sources': {source}}
                else:
                    bucket['score'] = max(bucket['score'], score)
                    bucket['sources'].add(source)

        text = str(text or '').strip()
        if text:
            add(self.semantic.fetch_query_semantic_candidates(text, limit=limit * 3), 'text')
        for ref in connected:
            source = self.get_verse_reference(ref[0], ref[1])
            if source:
                add(self.semantic.fetch_related_verse_candidates(source['id'], limit=limit * 2), 'verses')

        ranked = [c for c in merged.values() if (c['suraid'], c['verse_num']) not in connected]
        # Small bonus when both signals agree on a verse.
        ranked.sort(key=lambda c: (-(c['score'] + (0.1 if len(c['sources']) > 1 else 0.0)), c['suraid'], c['verse_num']))
        ranked = ranked[:limit]

        hydrated = {r['id']: r for r in self._fetch_verses_by_ids([c['id'] for c in ranked])}
        results = []
        for c in ranked:
            verse_data = hydrated.get(c['id'])
            if not verse_data:
                continue
            results.append({
                **verse_data,
                'surah': verse_data['suraid'],
                'verse': verse_data['verse_num'],
                'suranum': verse_data['suraid'],
                'versenum': verse_data['verse_num'],
                'score': round(c['score'], 4),
                'sources': sorted(c['sources']),
            })

        return {'count': len(results), 'results': results, 'semantic_capabilities': capabilities}

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

        for term in normalized_terms:
            is_stopword_only, _ = check_stopword_query(term)
            if is_stopword_only:
                continue

            search_result = self.search(
                term,
                literal_per_page=limit_per_term,
                expansion_per_page=limit_per_term,
                options={},
            )

            term_verses = (search_result['literal']['results'] + search_result['expansion']['results'])
            for verse in term_verses:
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
            'results': results[:20],
        }

    def create_ontology_concept(self, label: str | None, article: dict | None, terms: list[str], selected_verses: list[dict]) -> dict:
        concept_id = uuid4()
        return self._save_ontology_concept(concept_id, label, article, terms, selected_verses, replace_existing=False)

    def update_ontology_concept(self, concept_id: str, label: str | None, article: dict | None, terms: list[str], selected_verses: list[dict]) -> dict | None:
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

        return self._save_ontology_concept(concept_id, label, article, terms, selected_verses, replace_existing=True)

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

    def _save_ontology_concept(self, concept_id: str | object, label: str | None, article: dict | None, terms: list[str], selected_verses: list[dict], *, replace_existing: bool) -> dict:
        concept_label = str(label or '').strip() or None
        article_json = json.dumps(article) if article is not None else None

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

        try:
            if replace_existing:
                self.db.execute(
                    text(
                        """
                        UPDATE concepts
                        SET label = :label,
                            article = :article
                        WHERE id = :id
                        """
                    ),
                    {'id': concept_id, 'label': concept_label, 'article': article_json},
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
                        INSERT INTO concepts (id, label, article)
                        VALUES (:id, :label, :article)
                        """
                    ),
                    {'id': concept_id, 'label': concept_label, 'article': article_json},
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
            self.db.commit()
        except Exception:
            self.db.rollback()
            raise

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
                SELECT id, label, article, created_at
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

    @staticmethod
    def _slice_page(refs: list[dict], page: int, per_page: int) -> tuple[int, int, list[dict]]:
        """Return (clamped_page, total_pages, page_slice). per_page <= 0 = all."""
        total = len(refs)
        if per_page <= 0:
            return 1, (1 if total else 0), refs
        total_pages = (total + per_page - 1) // per_page
        page = min(max(1, page), total_pages) if total_pages else 1
        start = (page - 1) * per_page
        return page, total_pages, refs[start:start + per_page]

    def _build_group_results(self, page_refs: list[dict], hydrated: dict, language: str, profile: dict) -> list[dict]:
        results = []
        for item in page_refs:
            verse_data = hydrated.get(item['id'])
            if not verse_data:
                continue
            res = {**verse_data}
            res['versenum'] = res['verse_num']
            res['suranum'] = res['suraid']
            res['match_group'] = item['group']
            res['match_channels'] = item['channels']
            res['search_score'] = item['score']
            res['search_mode'] = 'phrase' if profile.get('phrases') else 'literal'
            highlight_source = self._get_highlight_source(res, language)
            res['verse_txt_highlighted'] = highlight_text(highlight_source, profile.get('exact_terms') or [])
            results.append(res)
        return results

    def _empty_search_response(self, *, literal_per_page: int, expansion_per_page: int, search_info: dict) -> dict:
        empty_block = lambda per_page: {'count': 0, 'page': 1, 'per_page': per_page, 'total_pages': 0, 'results': []}
        return {
            'count': 0,
            'literal': empty_block(literal_per_page),
            'expansion': empty_block(expansion_per_page),
            'related_terms': [],
            'search_info': search_info,
        }

    def search(
        self,
        query: str,
        *,
        literal_page: int = 1,
        literal_per_page: int = 20,
        expansion_page: int = 1,
        expansion_per_page: int = 20,
        options: dict | None = None,
    ) -> dict:
        """Grouped search with each group paginated independently.

        Two groups, returned as separate ``literal`` and ``expansion`` blocks,
        each with its own ``page`` / ``per_page`` / ``total_pages``:
          1. ``literal``   - every verse that literally contains the query term
                             (diacritic-insensitive), mushaf order, uncapped.
          2. ``expansion`` - lemma/root (and, for multi-word queries, whole-verse
                             semantic) matches that are NOT literal hits.
        Only the current page of each group is hydrated. ``per_page <= 0`` = all.
        """
        literal_page = max(1, int(literal_page or 1))
        expansion_page = max(1, int(expansion_page or 1))
        literal_per_page = int(literal_per_page if literal_per_page is not None else 20)
        expansion_per_page = int(expansion_per_page if expansion_per_page is not None else 20)

        parsed = parse_search_query(query)
        capabilities = self.semantic.get_capabilities()
        if not parsed.normalized:
            return self._empty_search_response(literal_per_page=literal_per_page, expansion_per_page=expansion_per_page, search_info={
                'query_normalized': '',
                'language': 'en',
                'query_expansions': [],
                'semantic_capabilities': capabilities,
                'fallback_reason': capabilities.get('fallback_reason'),
            })

        is_stopword_only, language = check_stopword_query(query)
        if is_stopword_only:
            return self._empty_search_response(literal_per_page=literal_per_page, expansion_per_page=expansion_per_page, search_info={
                'query_normalized': parsed.normalized,
                'language': language,
                'query_expansions': [],
                'semantic_capabilities': capabilities,
                'fallback_reason': capabilities.get('fallback_reason'),
                'stopword_only': True,
            })

        language = detect_language(parsed.normalized)
        query_terms = self._get_query_terms(parsed, language)
        profile = self.semantic.build_query_profile(query_terms, parsed.phrases, language)

        # --- Group 1: literal matches (ALL verses containing the term) ---
        direct_rows = self._fetch_direct_candidates(parsed, language)  # ordered sura:verse, uncapped
        literal_id_set = {r['id'] for r in direct_rows}
        literal_refs = [
            {'id': r['id'], 'suraid': r['suraid'], 'verse_num': r['verse_num'],
             'group': 'literal', 'score': 100.0, 'channels': ['lexical']}
            for r in direct_rows
        ]

        # --- Group 2: expansion (lemma/root, + semantic for multi-word queries) ---
        # A bare keyword gives the sentence model no context, so whole-verse
        # semantic only runs for multi-word / natural-language queries.
        is_multi_word_query = len(parsed.normalized.split()) >= 2
        expansion_channels = {
            'lemma': self.semantic.fetch_lemma_candidates(profile),
            'root': self.semantic.fetch_root_candidates(profile),
            'embedding': self.semantic.fetch_embedding_candidates(profile),
        }
        if is_multi_word_query:
            # Multilingual: an English query can surface Arabic verses by meaning.
            expansion_channels['verse_semantic'] = self.semantic.fetch_query_semantic_candidates(parsed.normalized)

        fused = reciprocal_rank_fusion(expansion_channels)
        expansion = [c for c in fused if c.verse_id not in literal_id_set]
        # More channel agreement first, then stronger fusion score, then mushaf order.
        expansion.sort(key=lambda c: (-len(c.channel_ranks), -c.rrf_score, c.suraid, c.verse_num))
        expansion_refs = [
            {'id': c.verse_id, 'suraid': c.suraid, 'verse_num': c.verse_num,
             'group': 'expansion', 'score': round(c.rrf_score * 10.0, 4),
             'channels': list(c.channel_ranks.keys())}
            for c in expansion
        ]

        # --- Paginate each group independently, then hydrate both pages at once ---
        lit_page, lit_total_pages, lit_slice = self._slice_page(literal_refs, literal_page, literal_per_page)
        exp_page, exp_total_pages, exp_slice = self._slice_page(expansion_refs, expansion_page, expansion_per_page)

        hydrated = {r['id']: r for r in self._fetch_verses_by_ids([item['id'] for item in (lit_slice + exp_slice)])}

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
            'count': len(literal_refs) + len(expansion_refs),
            'literal': {
                'count': len(literal_refs),
                'page': lit_page,
                'per_page': literal_per_page,
                'total_pages': lit_total_pages,
                'results': self._build_group_results(lit_slice, hydrated, language, profile),
            },
            'expansion': {
                'count': len(expansion_refs),
                'page': exp_page,
                'per_page': expansion_per_page,
                'total_pages': exp_total_pages,
                'results': self._build_group_results(exp_slice, hydrated, language, profile),
            },
            'related_terms': related_terms,
            'search_info': search_info,
        }
