"""add priority to onboarding module quiz

Revision ID: 20260825_001_add_priority
Revises: 20260810_001_onboard_email_sent
Create Date: 2026-08-25 12:33:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "20260825_001_add_priority"
down_revision: Union[str, None] = "20260810_001_onboard_email_sent"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "onboarding_module_quiz",
        sa.Column("priority", sa.Integer(), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_column("onboarding_module_quiz", "priority")
