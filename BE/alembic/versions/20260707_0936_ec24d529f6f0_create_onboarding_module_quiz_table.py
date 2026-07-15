"""create onboarding_module_quiz table

Revision ID: ec24d529f6f0
Revises: 20260707_001_onboard_mod
Create Date: 2026-07-07 09:36:19.203430

"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "ec24d529f6f0"
down_revision: Union[str, None] = "20260707_001_onboard_mod"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

from sqlalchemy.dialects.postgresql import ENUM

question_type_enum = ENUM(
    "MCQ",
    "SCENARIO",
    name="question_type_enum",
    create_type=False,
)


def upgrade() -> None:
    question_type_enum.create(
        op.get_bind(),
        checkfirst=True,
    )
    op.create_table(
        "onboarding_module_quiz",
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
            "question_text",
            sa.Text(),
            nullable=False,
        ),
        sa.Column(
            "question_type",
            question_type_enum,
            nullable=False,
        ),
        sa.Column(
            "choices",
            sa.JSON(),
            nullable=True,
        ),
        sa.Column(
            "correct_answer",
            sa.Text(),
            nullable=True,
        ),
        sa.Column(
            "display_order",
            sa.Integer(),
            nullable=False,
        ),
        sa.Column(
            "points",
            sa.Integer(),
            nullable=False,
            server_default="1",
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
    op.drop_table("onboarding_module_quiz")
    question_type_enum.drop(op.get_bind(), checkfirst=True)
