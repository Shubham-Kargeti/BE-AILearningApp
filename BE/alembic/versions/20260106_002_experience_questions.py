"""Add experience-based question configuration to assessments

Revision ID: 20260106_002_exp_q
Revises: 20251222_001, add_candidate_info_fields
Create Date: 2026-01-06 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '20260106_002_exp_q'
down_revision = ('20251222_001', 'add_candidate_info_fields')
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add question configuration columns to assessments table
    op.add_column('assessments', sa.Column('total_questions', sa.Integer(), nullable=False, server_default='15'))
    op.add_column('assessments', sa.Column('question_type_mix', sa.JSON(), nullable=False, server_default='{"mcq": 0.5, "coding": 0.3, "architecture": 0.2}'))
    op.add_column('assessments', sa.Column('passing_score_threshold', sa.Integer(), nullable=False, server_default='70'))
    op.add_column('assessments', sa.Column('auto_adjust_by_experience', sa.Boolean(), nullable=False, server_default='true'))
    op.add_column('assessments', sa.Column('difficulty_distribution', sa.JSON(), nullable=False, server_default='{"easy": 0.2, "medium": 0.5, "hard": 0.3}'))


def downgrade() -> None:
    # Remove question configuration columns from assessments table
    op.drop_column('assessments', 'difficulty_distribution')
    op.drop_column('assessments', 'auto_adjust_by_experience')
    op.drop_column('assessments', 'passing_score_threshold')
    op.drop_column('assessments', 'question_type_mix')
    op.drop_column('assessments', 'total_questions')
