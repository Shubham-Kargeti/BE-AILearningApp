"""add video url to onboarding modules

Revision ID: 75181fa1a5e4
Revises: 3b05af59e08a
Create Date: 2026-07-07 11:25:30.434931

"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "75181fa1a5e4"
down_revision: Union[str, None] = "3b05af59e08a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade database schema."""
    op.add_column(
        "onboarding_modules", sa.Column("video_url", sa.String(), nullable=True)
    )


def downgrade() -> None:
    """Downgrade database schema."""
    op.drop_column("onboarding_modules", "video_url")
