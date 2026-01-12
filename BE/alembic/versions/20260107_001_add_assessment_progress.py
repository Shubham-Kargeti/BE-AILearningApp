"""Add assessment progress table

Revision ID: 20260107_001_progress
Revises: 20260106_002_exp_q
Create Date: 2025-01-07

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '20260107_001_progress'
down_revision = '20260106_002_exp_q'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create assessment_progress table."""
    op.create_table(
        'assessment_progress',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('candidate_email', sa.String(length=255), nullable=False),
        sa.Column('candidate_name', sa.String(length=255), nullable=True),
        sa.Column('session_id', sa.String(length=100), nullable=True),
        sa.Column('question_set_id', sa.String(length=100), nullable=True),
        sa.Column('assessment_title', sa.String(length=500), nullable=True),
        sa.Column('skill', sa.String(length=255), nullable=True),
        sa.Column('level', sa.String(length=20), nullable=True),
        sa.Column('current_question_index', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('answers', postgresql.JSON(astext_type=sa.Text()), nullable=False, server_default='{}'),
        sa.Column('question_status', postgresql.JSON(astext_type=sa.Text()), nullable=False, server_default='{}'),
        sa.Column('expired_questions', postgresql.JSON(astext_type=sa.Text()), nullable=False, server_default='[]'),
        sa.Column('remaining_time_seconds', sa.Integer(), nullable=True),
        sa.Column('initial_duration_seconds', sa.Integer(), nullable=True),
        sa.Column('last_saved_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('total_questions', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('is_completed', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create indexes
    op.create_index('ix_assessment_progress_email', 'assessment_progress', ['candidate_email'], unique=True)
    op.create_index('ix_assessment_progress_session_id', 'assessment_progress', ['session_id'], unique=False)


def downgrade() -> None:
    """Drop assessment_progress table."""
    op.drop_index('ix_assessment_progress_session_id', table_name='assessment_progress')
    op.drop_index('ix_assessment_progress_email', table_name='assessment_progress')
    op.drop_table('assessment_progress')
