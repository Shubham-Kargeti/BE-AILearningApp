"""Create question_bank table

Revision ID: 20260113_001_qbank
Revises: 20260107_001_progress
Create Date: 2026-01-13
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '20260113_001_qbank'
down_revision = '20260107_001_progress'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'question_bank',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('question_text', sa.Text(), nullable=False),
        sa.Column('choices', postgresql.JSON(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'")),
        sa.Column('correct_answer', sa.String(length=10), nullable=False),
        sa.Column('source_type', sa.String(length=50), nullable=True),
        sa.Column('source_meta', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('quality_score', sa.Float(), nullable=True),
        sa.Column('review_state', sa.String(length=20), nullable=False, server_default=sa.text("'draft'")),
    )


def downgrade() -> None:
    op.drop_table('question_bank')
