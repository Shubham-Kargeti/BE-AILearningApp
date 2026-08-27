"""change question_type from enum to string

Revision ID: 20260827_003_qt_string
Revises: 20260827_002_add_scenario_mcq
Create Date: 2026-08-27 08:30:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "20260827_003_qt_string"
down_revision: Union[str, None] = "20260827_002_add_scenario_mcq"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("onboarding_module_quiz") as batch_op:
        batch_op.alter_column(
            "question_type",
            type_=sa.String(50),
            existing_type=sa.Enum("MCQ", "SCENARIO", "SCENARIO-MCQ", name="question_type_enum"),
            existing_nullable=False,
            postgresql_using="question_type::text",
        )

    op.execute("DROP TYPE IF EXISTS question_type_enum")


def downgrade() -> None:
    question_type_enum = sa.Enum("MCQ", "SCENARIO", "SCENARIO-MCQ", name="question_type_enum")
    question_type_enum.create(op.get_bind())

    with op.batch_alter_table("onboarding_module_quiz") as batch_op:
        batch_op.alter_column(
            "question_type",
            type_=question_type_enum,
            existing_type=sa.String(50),
            existing_nullable=False,
            postgresql_using="question_type::question_type_enum",
        )
