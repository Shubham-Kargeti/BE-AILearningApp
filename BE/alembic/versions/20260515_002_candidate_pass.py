"""allow long candidate passwords

Revision ID: 20260515_002_candidate_password_text
Revises: 20260515_001_candidate_creds
Create Date: 2026-05-15
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260515_002_candidate_pass"
down_revision: Union[str, None] = "20260515_001_candidate_creds"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        "candidates",
        "password",
        existing_type=sa.String(length=255),
        type_=sa.Text(),
        existing_nullable=True,
    )


def downgrade() -> None:
    op.alter_column(
        "candidates",
        "password",
        existing_type=sa.Text(),
        type_=sa.String(length=255),
        existing_nullable=True,
    )
