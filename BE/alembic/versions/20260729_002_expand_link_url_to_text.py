"""expand link_url to text for longer URLs

Revision ID: e06039ea6673
Revises: f7cb0f19771c
Create Date: 2026-07-29 12:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = "e06039ea6673"
down_revision: Union[str, None] = "f7cb0f19771c"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        "onboarding_module_key_concepts",
        "link_url",
        existing_type=sa.String(length=1000),
        type_=sa.Text(),
        existing_nullable=True,
    )


def downgrade() -> None:
    op.alter_column(
        "onboarding_module_key_concepts",
        "link_url",
        existing_type=sa.Text(),
        type_=sa.String(length=1000),
        existing_nullable=True,
    )