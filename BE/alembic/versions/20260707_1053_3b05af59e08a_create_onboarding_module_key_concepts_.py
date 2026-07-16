""" create onboarding_module_key_concepts table

Revision ID: 3b05af59e08a
Revises: ec24d529f6f0
Create Date: 2026-07-07 10:53:00.575423

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '3b05af59e08a'
down_revision: Union[str, None] = 'ec24d529f6f0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "onboarding_module_key_concepts",

        sa.Column(
            "id",
            sa.Integer(),
            primary_key=True,
            autoincrement=True,
        ),

        sa.Column(
            "module_id",
            sa.Integer(),
            sa.ForeignKey(
                "onboarding_modules.id",
                ondelete="CASCADE",
            ),
            nullable=False,
        ),

        sa.Column(
            "title",
            sa.String(),
            nullable=False,
        ),

        sa.Column(
            "description",
            sa.Text(),
            nullable=True,
        ),

        sa.Column(
            "display_order",
            sa.Integer(),
            nullable=False,
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
    op.drop_table("onboarding_module_key_concepts")
