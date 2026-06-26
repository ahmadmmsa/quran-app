from sqlalchemy import text
from sqlalchemy.orm import Session
from backend.app.services.search_utils import check_stopword_query, detect_language, escape_like, highlight_text, parse_search_query, tokenize_generic_text


class BibleService:
    def __init__(self, db: Session):
        self.db = db

    def get_all_books(self) -> list[dict]:
        rows = self.db.execute(text("SELECT id, name, name_ar FROM bible_chapters ORDER BY id ASC"))
        return [dict(row._mapping) for row in rows]

    def get_book_info(self, book_id: int) -> dict | None:
        row = self.db.execute(text("SELECT id, name, name_ar FROM bible_chapters WHERE id = :book_id LIMIT 1"), {"book_id": book_id}).first()
        return dict(row._mapping) if row else None

    def get_chapters_count(self, book_id: int) -> int:
        row = self.db.execute(text("SELECT COALESCE(MAX(chapter), 0) AS n FROM bible_verses WHERE book = :book_id"), {"book_id": book_id}).one()
        return int(row.n or 0)

    def get_verses(self, book_id: int, chapter_id: int) -> list[dict]:
        rows = self.db.execute(text("""
            SELECT book AS \"Book\",
                   chapter AS \"Chapter\",
                   verse_number,
                   text,
                   text_ar,
                   text_he
            FROM bible_verses
            WHERE book = :book_id AND chapter = :chapter_id
            ORDER BY verse_number ASC
        """), {"book_id": book_id, "chapter_id": chapter_id})
        return [dict(row._mapping) for row in rows]

    def is_stopword_only_query(self, query: str) -> bool:
        is_stopword_only, _ = check_stopword_query(query)
        return is_stopword_only

    def count_search_results(self, query: str) -> int:
        parsed = parse_search_query(query)
        if not parsed.normalized:
            return 0
        if self.is_stopword_only_query(query):
            return 0
        like_term = f"%{escape_like(parsed.normalized)}%"
        row = self.db.execute(text("""
            SELECT COUNT(*) AS count
            FROM bible_verses
            WHERE text ILIKE :term OR text_ar ILIKE :term OR text_he ILIKE :term
        """), {"term": like_term}).one()
        return int(row.count or 0)

    def search_verses(self, query: str, limit: int, offset: int) -> list[dict]:
        parsed = parse_search_query(query)
        if not parsed.normalized:
            return []
        if self.is_stopword_only_query(query):
            return []
        like_term = f"%{escape_like(parsed.normalized)}%"
        rows = self.db.execute(text("""
            SELECT bv.book AS \"Book\",
                   bv.chapter AS \"Chapter\",
                   bv.verse_number,
                   bv.text,
                   bv.text_ar,
                   bv.text_he,
                   b.name AS book_name,
                   b.name_ar AS book_name_ar
            FROM bible_verses bv
            JOIN bible_chapters b ON b.id = bv.book
            WHERE bv.text ILIKE :term OR bv.text_ar ILIKE :term OR bv.text_he ILIKE :term
            ORDER BY bv.book ASC, bv.chapter ASC, bv.verse_number ASC
            LIMIT :limit OFFSET :offset
        """), {"term": like_term, "limit": limit, "offset": offset})

        # Sanitize query terms to ensure no None or empty string values are passed
        raw_terms = parsed.phrases or parsed.terms or [parsed.normalized]
        query_terms = [t for t in raw_terms if t]

        results = []
        for row in rows:
            item = dict(row._mapping)
            
            highlighted = ""
            # Explicitly iterate through languages to find the match
            for col in ["text", "text_ar", "text_he"]:
                text_val = item.get(col)
                if text_val:
                    processed = highlight_text(text_val, query_terms)
                    # If the text was modified, we found our highlight
                    if processed != text_val:
                        highlighted = processed
                        break
            
            # Fallback to standard English text if highlighting failed or found no match
            if not highlighted:
                highlighted = item.get("text", "")
                
            item["highlighted_text"] = highlighted
            item["search_mode"] = "phrase" if parsed.has_quoted_phrase else "full_text"
            results.append(item)
            
        return results

    def build_generic_related_terms(self, query: str, results: list[dict]) -> list[dict]:
        parsed = parse_search_query(query)
        if not results:
            return []
        language = detect_language(parsed.normalized)
        query_tokens = set(tokenize_generic_text(parsed.normalized, language))
        counts: dict[str, int] = {}
        column_name = "text_ar" if language == 'ar' else "text_he" if language == 'he' else "text"
        for row in results[:120]:
            row_tokens = set(tokenize_generic_text(row.get(column_name), language))
            for token in row_tokens:
                if token in query_tokens:
                    continue
                counts[token] = counts.get(token, 0) + 1
        return [{"term": token, "count": count} for token, count in sorted(counts.items(), key=lambda item: (-item[1], item[0])) if count >= 2][:12]