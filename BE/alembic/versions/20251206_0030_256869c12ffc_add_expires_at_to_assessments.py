"""add_expires_at_to_assessments

Revision ID: 256869c12ffc
Revises: add_candidate_info_fields
Create Date: 2025-12-06 00:30:27.129375

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '256869c12ffc'
down_revision: Union[str, None] = 'add_candidate_info_fields'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade database schema."""
    # Add expires_at column to assessments table
    op.add_column('assessments', sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    """Downgrade database schema."""
    # Remove expires_at column from assessments table
    op.drop_column('assessments', 'expires_at')
