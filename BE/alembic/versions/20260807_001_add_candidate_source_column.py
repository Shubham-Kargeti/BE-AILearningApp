"""add source column to candidates for bulk onboarding differentiation

Revision ID: b2c3d4e5f6a7
Revises: e06039ea6673
Create Date: 2026-08-07 07:35:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b2c3d4e5f6a7"
down_revision: Union[str, None] = "e06039ea6673"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "candidates",
        sa.Column(
            "source",
            sa.String(length=50),
            nullable=False,
            server_default="manual",
        ),
    )


def downgrade() -> None:
    op.drop_column("candidates", "source")
