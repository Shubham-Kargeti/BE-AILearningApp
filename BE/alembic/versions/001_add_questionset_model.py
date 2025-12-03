"""Initial database schema with QuestionSet support

Revision ID: 001_add_questionset
Revises: 
Create Date: 2025-11-12 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '001_add_questionset'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create users table
    op.create_table(
        'users',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('full_name', sa.String(length=255), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('is_verified', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('last_login', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_users_id'), 'users', ['id'], unique=False)
    op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=True)
    
    # Create refresh_tokens table
    op.create_table(
        'refresh_tokens',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('token', sa.String(length=500), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('is_revoked', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_refresh_tokens_id'), 'refresh_tokens', ['id'], unique=False)
    op.create_index(op.f('ix_refresh_tokens_token'), 'refresh_tokens', ['token'], unique=True)
    op.create_index('ix_refresh_tokens_user_id_expires_at', 'refresh_tokens', ['user_id', 'expires_at'], unique=False)
    
    # Create job_descriptions table
    op.create_table(
        'job_descriptions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('jd_id', sa.String(length=100), nullable=False),
        sa.Column('title', sa.String(length=500), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('extracted_text', sa.Text(), nullable=False),
        sa.Column('s3_key', sa.String(length=500), nullable=False),
        sa.Column('file_name', sa.String(length=255), nullable=False),
        sa.Column('file_size', sa.Integer(), nullable=False),
        sa.Column('file_type', sa.String(length=50), nullable=False),
        sa.Column('uploaded_by', sa.Integer(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['uploaded_by'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_job_descriptions_id'), 'job_descriptions', ['id'], unique=False)
    op.create_index(op.f('ix_job_descriptions_jd_id'), 'job_descriptions', ['jd_id'], unique=True)
    
    # Create question_sets table
    op.create_table(
        'question_sets',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('question_set_id', sa.String(length=100), nullable=False),
        sa.Column('skill', sa.String(length=255), nullable=False),
        sa.Column('level', sa.String(length=20), nullable=False),
        sa.Column('total_questions', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('generation_model', sa.String(length=100), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_question_sets_question_set_id'), 'question_sets', ['question_set_id'], unique=True)
    op.create_index('ix_question_sets_skill', 'question_sets', ['skill'], unique=False)
    op.create_index('ix_question_sets_level', 'question_sets', ['level'], unique=False)
    op.create_index('ix_question_sets_skill_level', 'question_sets', ['skill', 'level'], unique=False)
    
    # Create questions table with support for both QuestionSet and JobDescription
    op.create_table(
        'questions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('question_set_id', sa.String(length=100), nullable=True),
        sa.Column('jd_id', sa.String(length=100), nullable=True),
        sa.Column('question_text', sa.Text(), nullable=False),
        sa.Column('options', postgresql.JSON(astext_type=sa.Text()), nullable=False),
        sa.Column('correct_answer', sa.String(length=10), nullable=False),
        sa.Column('difficulty', sa.String(length=20), nullable=True),
        sa.Column('topic', sa.String(length=255), nullable=True),
        sa.Column('generation_model', sa.String(length=100), nullable=True),
        sa.Column('generation_time', sa.Float(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['jd_id'], ['job_descriptions.jd_id'], ),
        sa.ForeignKeyConstraint(['question_set_id'], ['question_sets.question_set_id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_questions_id'), 'questions', ['id'], unique=False)
    op.create_index('ix_questions_jd_id', 'questions', ['jd_id'], unique=False)
    op.create_index('ix_questions_question_set_id', 'questions', ['question_set_id'], unique=False)
    op.create_index('ix_questions_jd_id_created_at', 'questions', ['jd_id', 'created_at'], unique=False)
    op.create_index('ix_questions_question_set_id_created_at', 'questions', ['question_set_id', 'created_at'], unique=False)
    
    # Create test_sessions table
    op.create_table(
        'test_sessions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('session_id', sa.String(length=100), nullable=False),
        sa.Column('jd_id', sa.String(length=100), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('candidate_name', sa.String(length=255), nullable=True),
        sa.Column('candidate_email', sa.String(length=255), nullable=True),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('duration_seconds', sa.Integer(), nullable=True),
        sa.Column('is_completed', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('is_scored', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('score_released_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('total_questions', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('correct_answers', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('score_percentage', sa.Float(), nullable=True),
        sa.Column('ip_address', sa.String(length=45), nullable=True),
        sa.Column('user_agent', sa.String(length=500), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['jd_id'], ['job_descriptions.jd_id'], ),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_test_sessions_id'), 'test_sessions', ['id'], unique=False)
    op.create_index(op.f('ix_test_sessions_session_id'), 'test_sessions', ['session_id'], unique=True)
    op.create_index('ix_test_sessions_jd_id', 'test_sessions', ['jd_id'], unique=False)
    op.create_index('ix_test_sessions_jd_id_created_at', 'test_sessions', ['jd_id', 'created_at'], unique=False)
    op.create_index('ix_test_sessions_user_id_created_at', 'test_sessions', ['user_id', 'created_at'], unique=False)
    
    # Create answers table
    op.create_table(
        'answers',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('session_id', sa.String(length=100), nullable=False),
        sa.Column('question_id', sa.Integer(), nullable=False),
        sa.Column('selected_answer', sa.String(length=10), nullable=False),
        sa.Column('is_correct', sa.Boolean(), nullable=True),
        sa.Column('time_taken_seconds', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['question_id'], ['questions.id'], ),
        sa.ForeignKeyConstraint(['session_id'], ['test_sessions.session_id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('session_id', 'question_id', name='uq_answer_session_question')
    )
    op.create_index(op.f('ix_answers_id'), 'answers', ['id'], unique=False)
    op.create_index('ix_answers_session_id', 'answers', ['session_id'], unique=False)
    op.create_index('ix_answers_session_id_created_at', 'answers', ['session_id', 'created_at'], unique=False)
    
    # Create celery_tasks table
    op.create_table(
        'celery_tasks',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('task_id', sa.String(length=255), nullable=False),
        sa.Column('task_name', sa.String(length=255), nullable=False),
        sa.Column('status', sa.String(length=50), nullable=False),
        sa.Column('result', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('error', sa.Text(), nullable=True),
        sa.Column('related_type', sa.String(length=50), nullable=True),
        sa.Column('related_id', sa.String(length=100), nullable=True),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_celery_tasks_task_id'), 'celery_tasks', ['task_id'], unique=True)
    op.create_index('ix_celery_tasks_status_created_at', 'celery_tasks', ['status', 'created_at'], unique=False)


def downgrade() -> None:
    # Drop all tables in reverse order
    op.drop_table('celery_tasks')
    op.drop_table('answers')
    op.drop_table('test_sessions')
    op.drop_table('questions')
    op.drop_table('question_sets')
    op.drop_table('job_descriptions')
    op.drop_table('refresh_tokens')
    op.drop_table('users')

