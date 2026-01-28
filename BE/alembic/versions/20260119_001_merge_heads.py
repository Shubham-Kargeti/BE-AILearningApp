"""Merge multiple alembic heads into a single linear history

Revision ID: 20260119_001_merge
Revises: 005_add_assessment_tokens, 256869c12ffc, 20260115_001_gen_policy
Create Date: 2026-01-19
"""
from alembic import op

# revision identifiers, used by Alembic.
revision = '20260119_001_merge'
down_revision = ('005_add_assessment_tokens', '256869c12ffc', '20260115_001_gen_policy')
branch_labels = None
depends_on = None


def upgrade() -> None:
    # This is a merge revision used to unify multiple branch heads.
    pass


def downgrade() -> None:
    # Downgrade is intentionally left as a no-op; reverting a merge
    # requires careful manual handling and is not expected in dev.
    pass
