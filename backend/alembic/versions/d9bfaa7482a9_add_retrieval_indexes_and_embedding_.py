"""Add retrieval indexes and embedding table

Revision ID: d9bfaa7482a9
Revises: 075ac2150a2e
Create Date: 2026-05-28 16:00:00.526193

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd9bfaa7482a9'
down_revision: Union[str, Sequence[str], None] = '075ac2150a2e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Ensure pgvector is enabled
    op.execute('CREATE EXTENSION IF NOT EXISTS vector;')

    # 2. Create quran_concept_embeddings table
    op.execute('''
        CREATE TABLE IF NOT EXISTS quran_concept_embeddings (
            id SERIAL PRIMARY KEY,
            lemma VARCHAR(255) NOT NULL,
            verse_id INTEGER NOT NULL REFERENCES quran_verses(id) ON DELETE CASCADE,
            embedding vector(1536) NOT NULL
        );
    ''')

    # 3. Create HNSW Index for vector search (using cosine distance as default for openai)
    op.execute('''
        CREATE INDEX IF NOT EXISTS ix_quran_concept_embeddings_embedding 
        ON quran_concept_embeddings USING hnsw (embedding vector_cosine_ops);
    ''')
    
    # 4. Create standard B-Tree index on lemma for the seed queries
    op.execute('CREATE INDEX IF NOT EXISTS ix_quran_concept_embeddings_lemma ON quran_concept_embeddings(lemma);')

    # 5. Create B-Tree indexes on morphology corpus to speed up retrieval
    op.execute('CREATE INDEX IF NOT EXISTS ix_morphology_lemma ON quran_arabic_morphology_corpus(lemma);')
    op.execute('CREATE INDEX IF NOT EXISTS ix_morphology_root ON quran_arabic_morphology_corpus(root);')
    op.execute('CREATE INDEX IF NOT EXISTS ix_morphology_sura_verse ON quran_arabic_morphology_corpus(sura_no, verse_no);')


def downgrade() -> None:
    op.execute('DROP INDEX IF EXISTS ix_morphology_sura_verse;')
    op.execute('DROP INDEX IF EXISTS ix_morphology_root;')
    op.execute('DROP INDEX IF EXISTS ix_morphology_lemma;')
    
    op.execute('DROP TABLE IF EXISTS quran_concept_embeddings;')
