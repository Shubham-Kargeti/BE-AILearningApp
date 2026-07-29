"""add certificate_email_sent to onboarding_module_candidate_checklists

Revision ID: f7cb0f19771c
Revises: 5f2a1c0b9d4e
Create Date: 2026-07-29 07:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = "f7cb0f19771c"
down_revision: Union[str, None] = "5f2a1c0b9d4e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "onboarding_module_candidate_checklists",
        sa.Column("certificate_email_sent", sa.Boolean(), nullable=False, server_default="false"),
    )


def downgrade() -> None:
    op.drop_column("onboarding_module_candidate_checklists", "certificate_email_sent")