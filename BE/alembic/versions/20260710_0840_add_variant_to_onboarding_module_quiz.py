"""add variant to onboarding module quiz

Revision ID: add_variant_quiz
Revises: 1fdde87a9626
Create Date: 2026-07-10 08:40:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_variant_quiz'
down_revision = '1fdde87a9626'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'onboarding_module_quiz',
        sa.Column('variant', sa.String(50), nullable=True),
    )


def downgrade() -> None:
    op.drop_column('onboarding_module_quiz', 'variant')
