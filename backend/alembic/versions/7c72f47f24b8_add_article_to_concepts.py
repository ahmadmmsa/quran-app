"""add article to concepts

Revision ID: 7c72f47f24b8
Revises: d9bfaa7482a9
Create Date: 2026-05-29 15:17:38.582911

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7c72f47f24b8'
down_revision: Union[str, Sequence[str], None] = 'd9bfaa7482a9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Idempotent: the column may already exist on databases where it was added
    # outside Alembic.
    op.execute("ALTER TABLE concepts ADD COLUMN IF NOT EXISTS article JSONB")


def downgrade() -> None:
    """Downgrade schema."""
    op.execute("ALTER TABLE concepts DROP COLUMN IF EXISTS article")
