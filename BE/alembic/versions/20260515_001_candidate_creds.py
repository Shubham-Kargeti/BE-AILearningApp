"""add candidate credentials

Revision ID: 20260515_001_candidate_credentials
Revises: 20260429_1500_learning_paths
Create Date: 2026-05-15
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260515_001_candidate_creds"
down_revision: Union[str, None] = "20260429_1500_learning_paths"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("candidates", sa.Column("password", sa.Text(), nullable=True))
    op.add_column("candidates", sa.Column("password_hash", sa.String(length=255), nullable=True))
    op.add_column("candidates", sa.Column("team", sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column("candidates", "team")
    op.drop_column("candidates", "password_hash")
    op.drop_column("candidates", "password")
