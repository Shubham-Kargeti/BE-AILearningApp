""" create onboarding module table

Revision ID: f7e89d011454
Revises: 20260519_001_session_feedback
Create Date: 2026-07-07 07:24:06.770734

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "20260707_001_onboard_mod"
down_revision: Union[str, None] = "20260519_001_session_feedback"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create onboarding_modules table."""

    op.create_table(
        "onboarding_modules",

        sa.Column(
            "id",
            sa.Integer(),
            primary_key=True,
            autoincrement=True,
            nullable=False,
        ),

        sa.Column(
            "title",
            sa.String(255),
            nullable=False,
        ),

        sa.Column(
            "description",
            sa.Text(),
            nullable=True,
        ),

        sa.Column(
            "rank",
            sa.Integer(),
            nullable=False,
        ),

        sa.Column(
            "passing_criteria",
            sa.Numeric(5, 2),
            nullable=False,
        ),

        sa.Column(
            "icon",
            sa.String(500),
            nullable=True,
        ),

        sa.Column(
            "date",
            sa.Date(),
            nullable=True,
        ),

        sa.Column(
            "created_date",
            sa.DateTime(),
            server_default=sa.func.now(),
            nullable=False,
        ),

        sa.Column(
            "modified_date",
            sa.DateTime(),
            server_default=sa.func.now(),
            nullable=False,
        ),

        sa.Column(
            "deleted_date",
            sa.DateTime(),
            nullable=True,
        ),
    )


def downgrade() -> None:
    """Drop onboarding_modules table."""

    op.drop_table("onboarding_modules")