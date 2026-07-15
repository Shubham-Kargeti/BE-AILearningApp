"""replace user_id with candidate_id in onboarding progress

Revision ID: 5569d2c723ef
Revises: a1b2c3d4e5f6
Create Date: 2026-07-08 06:41:40.953430

"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "5569d2c723ef"
down_revision: Union[str, None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ------------------------------------------------------------------
    # Drop index
    # ------------------------------------------------------------------
    op.drop_index(
        "idx_onboarding_employee_progress_user_id",
        table_name="onboarding_module_employee_progress",
    )

    # ------------------------------------------------------------------
    # Drop unique constraint
    # ------------------------------------------------------------------
    op.drop_constraint(
        "uq_user_module",
        "onboarding_module_employee_progress",
        type_="unique",
    )

    # ------------------------------------------------------------------
    # Drop foreign key
    #
    # Replace the FK name below if yours is different.
    # Run:
    #
    # \d onboarding_module_employee_progress
    #
    # or query pg_constraint to find the FK name.
    # ------------------------------------------------------------------
    op.drop_constraint(
        "onboarding_module_employee_progress_user_id_fkey",
        "onboarding_module_employee_progress",
        type_="foreignkey",
    )

    # ------------------------------------------------------------------
    # Drop user_id column
    # ------------------------------------------------------------------
    op.drop_column(
        "onboarding_module_employee_progress",
        "user_id",
    )

    # ------------------------------------------------------------------
    # Add candidate_id
    # ------------------------------------------------------------------
    op.add_column(
        "onboarding_module_employee_progress",
        sa.Column(
            "candidate_id",
            sa.Integer(),
            nullable=False,
        ),
    )

    # ------------------------------------------------------------------
    # Add FK
    # ------------------------------------------------------------------
    op.create_foreign_key(
        "fk_onboarding_progress_candidate",
        "onboarding_module_employee_progress",
        "candidates",
        ["candidate_id"],
        ["id"],
        ondelete="CASCADE",
    )

    # ------------------------------------------------------------------
    # Create unique constraint
    # ------------------------------------------------------------------
    op.create_unique_constraint(
        "uq_candidate_module",
        "onboarding_module_employee_progress",
        ["candidate_id", "module_id"],
    )

    # ------------------------------------------------------------------
    # Create index
    # ------------------------------------------------------------------
    op.create_index(
        "idx_onboarding_employee_progress_candidate_id",
        "onboarding_module_employee_progress",
        ["candidate_id"],
    )


def downgrade() -> None:
    # Drop candidate index
    op.drop_index(
        "idx_onboarding_employee_progress_candidate_id",
        table_name="onboarding_module_employee_progress",
    )

    # Drop unique constraint
    op.drop_constraint(
        "uq_candidate_module",
        "onboarding_module_employee_progress",
        type_="unique",
    )

    # Drop FK
    op.drop_constraint(
        "fk_onboarding_progress_candidate",
        "onboarding_module_employee_progress",
        type_="foreignkey",
    )

    # Drop column
    op.drop_column(
        "onboarding_module_employee_progress",
        "candidate_id",
    )

    # Add user_id back
    op.add_column(
        "onboarding_module_employee_progress",
        sa.Column(
            "user_id",
            sa.Integer(),
            nullable=False,
        ),
    )

    # Restore FK
    op.create_foreign_key(
        "onboarding_module_employee_progress_user_id_fkey",
        "onboarding_module_employee_progress",
        "users",
        ["user_id"],
        ["id"],
        ondelete="CASCADE",
    )

    # Restore unique constraint
    op.create_unique_constraint(
        "uq_user_module",
        "onboarding_module_employee_progress",
        ["user_id", "module_id"],
    )

    # Restore index
    op.create_index(
        "idx_onboarding_employee_progress_user_id",
        "onboarding_module_employee_progress",
        ["user_id"],
    )
