"""One-off backfill of verse-level embeddings into quran_verse_embeddings.

Usage (from the repo root, after running `alembic upgrade head`):

    pip install fastembed
    python -m backend.scripts.backfill_verse_embeddings

Re-running is safe: it upserts and by default only fills verses that are
missing an embedding. Pass --all to recompute every verse (e.g. after changing
the model).
"""
from __future__ import annotations

import argparse
import logging

from sqlalchemy import text

from backend.app.session import SessionLocal
from backend.app.services.embeddings import (
    format_verse_for_embedding,
    get_embedding_model,
    to_pgvector_literal,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("backfill_verse_embeddings")

BATCH_SIZE = 128


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--all", action="store_true", help="Recompute every verse, not just missing ones.")
    parser.add_argument("--batch-size", type=int, default=BATCH_SIZE)
    args = parser.parse_args()

    model = get_embedding_model()
    db = SessionLocal()
    try:
        where = "" if args.all else (
            "WHERE qv.id NOT IN (SELECT verse_id FROM quran_verse_embeddings)"
        )
        rows = db.execute(text(f"""
            SELECT qv.id, qv.verse_txt_raw, qv.verse_txt, qv.verse_txt_en
            FROM quran_verses qv
            {where}
            ORDER BY qv.id ASC
        """)).mappings().all()

        total = len(rows)
        logger.info("Embedding %d verses with %s", total, model.model_name)
        done = 0
        for start in range(0, total, args.batch_size):
            batch = rows[start:start + args.batch_size]
            texts = [format_verse_for_embedding(dict(row)) for row in batch]
            vectors = model.embed_documents(texts)
            for row, vector in zip(batch, vectors):
                db.execute(
                    text("""
                        INSERT INTO quran_verse_embeddings (verse_id, embedding)
                        VALUES (:verse_id, CAST(:embedding AS vector))
                        ON CONFLICT (verse_id) DO UPDATE SET embedding = EXCLUDED.embedding
                    """),
                    {"verse_id": row["id"], "embedding": to_pgvector_literal(vector)},
                )
            db.commit()
            done += len(batch)
            logger.info("  %d/%d", done, total)
        logger.info("Done.")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
