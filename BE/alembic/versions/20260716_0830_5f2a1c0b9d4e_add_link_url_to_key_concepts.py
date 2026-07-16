""" add link_url to onboarding_module_key_concepts

Revision ID: 5f2a1c0b9d4e
Revises: 1fdde87a9626
Create Date: 2026-07-16 08:30:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '5f2a1c0b9d4e'
down_revision: Union[str, None] = 'add_variant_quiz'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "onboarding_module_key_concepts",
        sa.Column("link_url", sa.String(length=1000), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("onboarding_module_key_concepts", "link_url")
