"""Add parent assessment support for assessment variants

Revision ID: 20260423_001_parent_assessment
Revises: 20260119_002_q_source
Create Date: 2026-04-23
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260423_001_parent_assessment"
down_revision = "20260119_002_q_source"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "assessments",
        sa.Column("parent_assessment_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_assessments_parent_assessment_id",
        "assessments",
        "assessments",
        ["parent_assessment_id"],
        ["id"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_assessments_parent_assessment_id",
        "assessments",
        type_="foreignkey",
    )
    op.drop_column("assessments", "parent_assessment_id")
