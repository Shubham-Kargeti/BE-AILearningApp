"""add immutable Microsoft Entra identity fields to users

Revision ID: 20260717_001_azure_identity
Revises: 5f2a1c0b9d4e
Create Date: 2026-07-17 12:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260717_001_azure_identity"
down_revision: Union[str, None] = "5f2a1c0b9d4e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add tenant/object IDs and prevent duplicate Azure identity bindings."""

    op.add_column("users", sa.Column("azure_oid", sa.String(36), nullable=True))
    op.add_column(
        "users",
        sa.Column("azure_tenant_id", sa.String(36), nullable=True),
    )
    op.create_unique_constraint(
        "uq_users_azure_tenant_oid",
        "users",
        ["azure_tenant_id", "azure_oid"],
    )


def downgrade() -> None:
    """Remove the Azure identity binding fields."""

    op.drop_constraint(
        "uq_users_azure_tenant_oid",
        "users",
        type_="unique",
    )
    op.drop_column("users", "azure_tenant_id")
    op.drop_column("users", "azure_oid")

