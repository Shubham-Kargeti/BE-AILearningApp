"""Add candidate professional info fields

Revision ID: add_candidate_info_fields
Revises: 
Create Date: 2025-12-04

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'add_candidate_info_fields'
down_revision: Union[str, None] = None  # Update this to your latest revision
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add new candidate information fields."""
    # Add new columns to candidates table
    op.add_column('candidates', sa.Column('current_role', sa.String(255), nullable=True))
    op.add_column('candidates', sa.Column('location', sa.String(255), nullable=True))
    op.add_column('candidates', sa.Column('education', sa.String(500), nullable=True))
    op.add_column('candidates', sa.Column('linkedin_url', sa.String(500), nullable=True))
    op.add_column('candidates', sa.Column('github_url', sa.String(500), nullable=True))
    op.add_column('candidates', sa.Column('portfolio_url', sa.String(500), nullable=True))
    op.add_column('candidates', sa.Column('experience_years', sa.String(50), nullable=True))


def downgrade() -> None:
    """Remove candidate information fields."""
    op.drop_column('candidates', 'experience_years')
    op.drop_column('candidates', 'portfolio_url')
    op.drop_column('candidates', 'github_url')
    op.drop_column('candidates', 'linkedin_url')
    op.drop_column('candidates', 'education')
    op.drop_column('candidates', 'location')
    op.drop_column('candidates', 'current_role')
