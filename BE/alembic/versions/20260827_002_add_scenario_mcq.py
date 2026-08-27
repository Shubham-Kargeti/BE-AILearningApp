"""add scenario-mcq to onboarding module quiz question type enum

Revision ID: 20260827_002_add_scenario_mcq
Revises: 20260827_001_add_category
Create Date: 2026-08-27 18:15:00.000000
"""

from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "20260827_002_add_scenario_mcq"
down_revision: Union[str, None] = "20260827_001_add_category"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE question_type_enum ADD VALUE 'SCENARIO-MCQ'")


def downgrade() -> None:
    pass
