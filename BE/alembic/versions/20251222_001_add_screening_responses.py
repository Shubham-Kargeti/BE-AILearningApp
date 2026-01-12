"""Add screening_responses table

Revision ID: 20251222_001
Revises: 004_cand_assess
Create Date: 2025-12-22
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '20251222_001'
down_revision = '004_cand_assess'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute('''
        CREATE TABLE IF NOT EXISTS screening_responses (
            id SERIAL PRIMARY KEY,
            screening_id VARCHAR(100) NOT NULL UNIQUE,
            assessment_id INTEGER NOT NULL REFERENCES assessments(id),
            candidate_session_id VARCHAR(100),
            candidate_id INTEGER REFERENCES candidates(id),
            answers JSON NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
    ''')
    op.execute("CREATE INDEX IF NOT EXISTS ix_screening_responses_assessment_id ON screening_responses(assessment_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_screening_responses_candidate_session ON screening_responses(candidate_session_id)")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS screening_responses CASCADE")
