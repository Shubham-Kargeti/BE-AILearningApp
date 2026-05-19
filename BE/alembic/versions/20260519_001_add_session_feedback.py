"""add session feedback table

Revision ID: 20260519_001_session_feedback
Revises: 20260515_002_candidate_pass
Create Date: 2026-05-19
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260519_001_session_feedback"
down_revision: Union[str, None] = "20260515_002_candidate_pass"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "session_feedback",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("test_session_id", sa.Integer(), nullable=False),
        sa.Column("created_by", sa.Integer(), nullable=True),
        sa.Column("updated_by", sa.Integer(), nullable=True),
        sa.Column("llm_feedback_text", sa.Text(), nullable=False),
        sa.Column("feedback_text", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="draft"),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["test_session_id"], ["test_sessions.id"]),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
        sa.ForeignKeyConstraint(["updated_by"], ["users.id"]),
        sa.UniqueConstraint("test_session_id", name="uq_session_feedback_test_session_id"),
    )

    op.create_index("ix_session_feedback_id", "session_feedback", ["id"])
    op.create_index("ix_session_feedback_test_session_id", "session_feedback", ["test_session_id"])
    op.create_index("ix_session_feedback_status", "session_feedback", ["status"])
    op.create_index(
        "ix_session_feedback_session_status",
        "session_feedback",
        ["test_session_id", "status"],
    )


def downgrade() -> None:
    op.drop_index("ix_session_feedback_session_status", table_name="session_feedback")
    op.drop_index("ix_session_feedback_status", table_name="session_feedback")
    op.drop_index("ix_session_feedback_test_session_id", table_name="session_feedback")
    op.drop_index("ix_session_feedback_id", table_name="session_feedback")
    op.drop_table("session_feedback")
