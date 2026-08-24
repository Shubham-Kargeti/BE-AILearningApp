"""add onboarding_email_sent to candidates

Revision ID: 20260810_001_onboard_email_sent
Revises: c3d4e5f6a7b8
Create Date: 2026-08-10 07:15:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260810_001_onboard_email_sent"
down_revision: Union[str, None] = "c3d4e5f6a7b8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "candidates",
        sa.Column(
            "onboarding_email_sent",
            sa.Boolean(),
            nullable=False,
            server_default="false",
        ),
    )


def downgrade() -> None:
    op.drop_column("candidates", "onboarding_email_sent")
