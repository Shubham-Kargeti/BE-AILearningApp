"""Add generation_policy to assessments

Revision ID: 20260115_001_gen_policy
Revises: 20260113_001_qbank
Create Date: 2026-01-15
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '20260115_001_gen_policy'
down_revision = '20260113_001_qbank'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Use a valid JSON server default literal for Postgres
    op.add_column(
        'assessments',
        sa.Column(
            'generation_policy',
            postgresql.JSON(astext_type=sa.Text()),
            nullable=False,
            # SQL must contain a quoted JSON literal as the default value
            server_default=sa.text("'{\"mode\": \"rag\", \"rag_pct\": 100, \"llm_pct\": 0}'"),
        ),
    )


def downgrade() -> None:
    op.drop_column('assessments', 'generation_policy')
