"""add admin learning path templates

Revision ID: 20260521_001_admin_lp_templates
Revises: 20260519_001_session_feedback
Create Date: 2026-05-21
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260521_001_admin_lp_templates"
down_revision: Union[str, None] = "20260519_001_session_feedback"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "admin_learning_path_templates",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("template_id", sa.String(length=100), nullable=False),
        sa.Column("name", sa.String(length=500), nullable=False),
        sa.Column("source_type", sa.String(length=30), nullable=True),
        sa.Column("source_filename", sa.String(length=500), nullable=True),
        sa.Column("topic", sa.String(length=500), nullable=False),
        sa.Column("extracted_skills", sa.JSON(), nullable=False),
        sa.Column("recommended_courses", sa.JSON(), nullable=False),
        sa.Column("created_by", sa.Integer(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
    )
    op.create_index(
        "ix_admin_learning_path_templates_template_id",
        "admin_learning_path_templates",
        ["template_id"],
        unique=True,
    )
    op.create_index(
        "ix_admin_learning_path_templates_name",
        "admin_learning_path_templates",
        ["name"],
    )
    op.create_index(
        "ix_admin_learning_path_templates_created",
        "admin_learning_path_templates",
        ["created_at"],
    )

    op.alter_column(
        "learning_paths",
        "session_id",
        existing_type=sa.String(length=100),
        nullable=True,
    )
    op.add_column("learning_paths", sa.Column("admin_template_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_learning_paths_admin_template_id",
        "learning_paths",
        "admin_learning_path_templates",
        ["admin_template_id"],
        ["id"],
    )
    op.create_index(
        "ix_learning_paths_admin_template_id",
        "learning_paths",
        ["admin_template_id"],
    )
    op.create_index(
        "ix_learning_paths_admin_template_created",
        "learning_paths",
        ["admin_template_id", "created_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_learning_paths_admin_template_created", table_name="learning_paths")
    op.drop_index("ix_learning_paths_admin_template_id", table_name="learning_paths")
    op.drop_constraint("fk_learning_paths_admin_template_id", "learning_paths", type_="foreignkey")
    op.drop_column("learning_paths", "admin_template_id")
    op.alter_column(
        "learning_paths",
        "session_id",
        existing_type=sa.String(length=100),
        nullable=False,
    )

    op.drop_index("ix_admin_learning_path_templates_created", table_name="admin_learning_path_templates")
    op.drop_index("ix_admin_learning_path_templates_name", table_name="admin_learning_path_templates")
    op.drop_index(
        "ix_admin_learning_path_templates_template_id",
        table_name="admin_learning_path_templates",
    )
    op.drop_table("admin_learning_path_templates")
