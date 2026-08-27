"""add category to onboarding module quiz

Revision ID: 20260827_001_add_category
Revises: 20260825_001_add_priority
Create Date: 2026-08-27 12:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "20260827_001_add_category"
down_revision: Union[str, None] = "20260825_001_add_priority"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "onboarding_module_quiz",
        sa.Column("category", sa.String(length=255), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("onboarding_module_quiz", "category")
