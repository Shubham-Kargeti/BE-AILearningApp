"""Utility to create initial database migration."""
import asyncio
from logging.config import fileConfig
import sys
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.db.session import engine
from app.db.base import Base
from app.db.models import (
    User, RefreshToken, JobDescription, Question,
    TestSession, Answer, CeleryTask
)


async def init_models():
    """Create all tables in database."""
    async with engine.begin() as conn:
        # Defensive: drop any existing indexes that may have been left behind by
        # previous partial runs or migration scripts. SQLite can raise
        # "index ... already exists" when attempting to create an index that
        # is already present. Dropping indexes first ensures create_all succeeds
        # idempotently for local/dev usage.
        try:
            from sqlalchemy import text

            for idx in Base.metadata.indexes:
                await conn.execute(text(f"DROP INDEX IF EXISTS {idx.name}"))
        except Exception:
            # Non-fatal; continue to create tables even if index cleanup fails
            pass

        await conn.run_sync(Base.metadata.create_all)
    
    print("✅ Database tables created successfully!")


if __name__ == "__main__":
    print("🗄️  Creating database tables...")
    asyncio.run(init_models())
