"""Change questions.correct_answer from String(10) to Text

Revision ID: 20260427_q_ans_text
Revises: 20260423_001_parent_assessment
Create Date: 2026-04-27
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '20260427_q_ans_text'
down_revision = "20260423_001_parent_assessment"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column(
        "questions",
        "correct_answer",
        existing_type=sa.String(length=10),
        type_=sa.Text(),
        existing_nullable=False,
    )


def downgrade() -> None:
    op.alter_column(
        "questions",
        "correct_answer",
        existing_type=sa.Text(),
        type_=sa.String(length=10),
        existing_nullable=False,
    )
