"""add verse-level embeddings table

Revision ID: b1c2d3e4f5a6
Revises: 7c72f47f24b8
Create Date: 2026-06-18 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'b1c2d3e4f5a6'
down_revision: Union[str, Sequence[str], None] = '7c72f47f24b8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Dimension of the verse embedding model (intfloat/multilingual-e5-large -> 1024).
# If you switch to a model with a different dimension, change this and re-run
# the backfill.
EMBEDDING_DIM = 1024


def upgrade() -> None:
    op.execute('CREATE EXTENSION IF NOT EXISTS vector;')
    op.execute(f'''
        CREATE TABLE IF NOT EXISTS quran_verse_embeddings (
            verse_id  INTEGER PRIMARY KEY REFERENCES quran_verses(id) ON DELETE CASCADE,
            embedding vector({EMBEDDING_DIM}) NOT NULL
        );
    ''')
    op.execute('''
        CREATE INDEX IF NOT EXISTS ix_quran_verse_embeddings_embedding
        ON quran_verse_embeddings USING hnsw (embedding vector_cosine_ops);
    ''')


def downgrade() -> None:
    op.execute('DROP INDEX IF EXISTS ix_quran_verse_embeddings_embedding;')
    op.execute('DROP TABLE IF EXISTS quran_verse_embeddings;')
