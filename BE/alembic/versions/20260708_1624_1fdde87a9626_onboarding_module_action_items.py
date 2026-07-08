""" onboarding module action items

Revision ID: 1fdde87a9626
Revises: 5569d2c723ef
Create Date: 2026-07-08 16:24:15.249781

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '1fdde87a9626'
down_revision: Union[str, None] = '5569d2c723ef'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade database schema."""
    op.create_table(
        "onboarding_module_action_items",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("module_id", sa.Integer, sa.ForeignKey("onboarding_modules.id", ondelete="CASCADE"), nullable=False),
        sa.Column("item_text", sa.Text, nullable=False),
        sa.Column("display_order", sa.Integer, nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.text("true")),
        sa.Column("created_date", sa.DateTime, server_default=sa.func.now(), nullable=False),
        sa.Column("modified_date", sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )
    op.create_index(
        "ix_onboarding_module_action_items_module_id",
        "onboarding_module_action_items",
        ["module_id"],
    )

    op.create_table(
        "onboarding_module_candidate_checklists",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("candidate_id", sa.Integer, sa.ForeignKey("candidates.id", ondelete="CASCADE"), nullable=False),
        sa.Column("module_id", sa.Integer, sa.ForeignKey("onboarding_modules.id", ondelete="CASCADE"), nullable=False),
        sa.Column("completed_item_ids", sa.Text, nullable=True),
        sa.Column("all_completed", sa.Boolean, nullable=False, server_default=sa.text("false")),
        sa.Column("certificate_generated", sa.Boolean, nullable=False, server_default=sa.text("false")),
        sa.Column("certificate_generated_date", sa.DateTime, nullable=True),
        sa.Column("completed_date", sa.DateTime, nullable=True),
        sa.Column("created_date", sa.DateTime, server_default=sa.func.now(), nullable=False),
        sa.Column("modified_date", sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )
    op.create_index(
        "ix_onboarding_module_candidate_checklists_candidate_module",
        "onboarding_module_candidate_checklists",
        ["candidate_id", "module_id"],
    )


def downgrade() -> None:
    """Downgrade database schema."""
    op.drop_index("ix_onboarding_module_candidate_checklists_candidate_module", table_name="onboarding_module_candidate_checklists")
    op.drop_table("onboarding_module_candidate_checklists")
    op.drop_index("ix_onboarding_module_action_items_module_id", table_name="onboarding_module_action_items")
    op.drop_table("onboarding_module_action_items")
