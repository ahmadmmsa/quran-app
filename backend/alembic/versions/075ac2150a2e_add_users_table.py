"""Add users table

Revision ID: 075ac2150a2e
Revises: 42a7b5de1c86
Create Date: 2026-05-26 09:19:51.165920

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '075ac2150a2e'
down_revision: Union[str, Sequence[str], None] = '42a7b5de1c86'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'users',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('email', sa.String(), nullable=False, unique=True),
        sa.Column('hashed_password', sa.String(), nullable=True),
        sa.Column('is_admin', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False)
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table('users')
