"""Add streak tracking fields to User model

Revision ID: 003_add_user_streaks
Revises: 002_qset_session
Create Date: 2025-11-20

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '003_add_user_streaks'
down_revision = '002_qset_session'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add streak tracking fields to users table
    op.add_column('users', sa.Column('login_streak', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('users', sa.Column('login_streak_last_date', sa.DateTime(timezone=True), nullable=True))
    op.add_column('users', sa.Column('login_streak_max', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('users', sa.Column('quiz_streak', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('users', sa.Column('quiz_streak_last_date', sa.DateTime(timezone=True), nullable=True))
    op.add_column('users', sa.Column('quiz_streak_max', sa.Integer(), nullable=False, server_default='0'))


def downgrade() -> None:
    # Remove streak tracking fields from users table
    op.drop_column('users', 'quiz_streak_max')
    op.drop_column('users', 'quiz_streak_last_date')
    op.drop_column('users', 'quiz_streak')
    op.drop_column('users', 'login_streak_max')
    op.drop_column('users', 'login_streak_last_date')
    op.drop_column('users', 'login_streak')
