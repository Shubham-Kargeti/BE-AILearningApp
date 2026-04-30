"""add learning paths table

Revision ID: 20260429_1500_learning_paths
Revises: 67fddca7e548
Create Date: 2026-04-29
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260429_1500_learning_paths"
down_revision: Union[str, None] = "67fddca7e548"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "learning_paths",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("learning_path_id", sa.String(length=100), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("employee_email", sa.String(length=255), nullable=False),
        sa.Column("employee_name", sa.String(length=255), nullable=True),
        sa.Column("session_id", sa.String(length=100), nullable=False),
        sa.Column("assessment_id", sa.Integer(), nullable=True),
        sa.Column("assessment_public_id", sa.String(length=100), nullable=True),
        sa.Column("assessment_title", sa.String(length=500), nullable=True),
        sa.Column("topic", sa.String(length=500), nullable=False),
        sa.Column("recommended_courses", sa.JSON(), nullable=False),
        sa.Column("pushed_by", sa.Integer(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["assessment_id"], ["assessments.id"]),
        sa.ForeignKeyConstraint(["pushed_by"], ["users.id"]),
        sa.ForeignKeyConstraint(["session_id"], ["test_sessions.session_id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.UniqueConstraint("employee_email", "session_id", name="uq_learning_path_employee_session"),
    )
    op.create_index("ix_learning_paths_learning_path_id", "learning_paths", ["learning_path_id"], unique=True)
    op.create_index("ix_learning_paths_user_id", "learning_paths", ["user_id"])
    op.create_index("ix_learning_paths_employee_email", "learning_paths", ["employee_email"])
    op.create_index("ix_learning_paths_session_id", "learning_paths", ["session_id"])
    op.create_index("ix_learning_paths_assessment_id", "learning_paths", ["assessment_id"])
    op.create_index("ix_learning_paths_assessment_public_id", "learning_paths", ["assessment_public_id"])
    op.create_index("ix_learning_paths_employee_created", "learning_paths", ["employee_email", "created_at"])
    op.create_index("ix_learning_paths_assessment_created", "learning_paths", ["assessment_id", "created_at"])


def downgrade() -> None:
    op.drop_index("ix_learning_paths_assessment_created", table_name="learning_paths")
    op.drop_index("ix_learning_paths_employee_created", table_name="learning_paths")
    op.drop_index("ix_learning_paths_assessment_public_id", table_name="learning_paths")
    op.drop_index("ix_learning_paths_assessment_id", table_name="learning_paths")
    op.drop_index("ix_learning_paths_session_id", table_name="learning_paths")
    op.drop_index("ix_learning_paths_employee_email", table_name="learning_paths")
    op.drop_index("ix_learning_paths_user_id", table_name="learning_paths")
    op.drop_index("ix_learning_paths_learning_path_id", table_name="learning_paths")
    op.drop_table("learning_paths")
