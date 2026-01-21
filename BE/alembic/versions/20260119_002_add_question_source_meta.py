"""Add source metadata fields to questions

Revision ID: 20260119_002_q_source
Revises: 20260119_001_merge
Create Date: 2026-01-19
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '20260119_002_q_source'
down_revision = '20260119_001_merge'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('questions', sa.Column('source_type', sa.String(length=50), nullable=True))
    op.add_column('questions', sa.Column('source_meta', postgresql.JSON(astext_type=sa.Text()), nullable=True))
    op.add_column('questions', sa.Column('quality_score', sa.Float(), nullable=True))


def downgrade() -> None:
    op.drop_column('questions', 'quality_score')
    op.drop_column('questions', 'source_meta')
    op.drop_column('questions', 'source_type')
