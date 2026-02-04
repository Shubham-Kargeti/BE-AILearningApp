"""Add question_set_id to TestSession model

Revision ID: 002_qset_session
Revises: 001_add_questionset
Create Date: 2025-11-12 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '002_qset_session'
down_revision: Union[str, None] = '001_add_questionset'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add question_set_id column to test_sessions
    op.add_column('test_sessions', sa.Column('question_set_id', sa.String(length=100), nullable=True))
    
    # Make jd_id optional (was required before)
    op.alter_column('test_sessions', 'jd_id',
               existing_type=sa.String(length=100),
               nullable=True)
    
    # Create foreign key for question_set_id
    op.create_foreign_key(
        'fk_test_sessions_question_set_id',
        'test_sessions', 'question_sets',
        ['question_set_id'], ['question_set_id']
    )
    
    # Create index for question_set_id
    op.create_index(
        'ix_test_sessions_question_set_id',
        'test_sessions',
        ['question_set_id'],
        unique=False
    )
    op.create_index(
        'ix_test_sessions_question_set_id_created_at',
        'test_sessions',
        ['question_set_id', 'created_at'],
        unique=False
    )


def downgrade() -> None:
    # Drop indexes
    op.drop_index('ix_test_sessions_question_set_id_created_at', table_name='test_sessions')
    op.drop_index('ix_test_sessions_question_set_id', table_name='test_sessions')
    
    # Drop foreign key
    op.drop_constraint('fk_test_sessions_question_set_id', 'test_sessions', type_='foreignkey')
    
    # Remove question_set_id column
    op.drop_column('test_sessions', 'question_set_id')
    
    # Make jd_id required again
    op.alter_column('test_sessions', 'jd_id',
               existing_type=sa.String(length=100),
               nullable=False)
