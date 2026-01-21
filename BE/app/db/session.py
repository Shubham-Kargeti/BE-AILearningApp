"""Database session management with async support."""
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import NullPool
from config import get_settings
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import ssl
import os

settings = get_settings()

# Create async engine
engine_kwargs = {
    "echo": settings.DB_ECHO,
    "poolclass": NullPool if settings.ENVIRONMENT == "testing" else None,
    "pool_pre_ping": True,
}

# SQLite (aiosqlite) does not accept pool sizing kwargs; only apply them for other DBs
if not (settings.DATABASE_URL and settings.DATABASE_URL.startswith("sqlite")):
    engine_kwargs.update(
        {
            "pool_size": settings.DB_POOL_SIZE if settings.ENVIRONMENT != "testing" else None,
            "max_overflow": settings.DB_MAX_OVERFLOW if settings.ENVIRONMENT != "testing" else None,
            "pool_timeout": settings.DB_POOL_TIMEOUT if settings.ENVIRONMENT != "testing" else None,
            "pool_recycle": settings.DB_POOL_RECYCLE if settings.ENVIRONMENT != "testing" else None,
        }
    )

engine: AsyncEngine = create_async_engine(settings.DATABASE_URL, **engine_kwargs)

# If DATABASE_URL requests sslmode=require (common for RDS), and SSL is
# required, provide an ssl context via connect_args. Respect the
# SKIP_SSL_VERIFY flag for development convenience (temporary/insecure).
if settings.DATABASE_URL and "sslmode=require" in settings.DATABASE_URL:
    ssl_ctx = ssl.create_default_context()
    if getattr(settings, "SKIP_SSL_VERIFY", False) or os.environ.get("SKIP_SSL_VERIFY"):
        ssl_ctx.check_hostname = False
        ssl_ctx.verify_mode = ssl.CERT_NONE

    # Build a DB URL without the sslmode query parameter so asyncpg
    # doesn't attempt to treat it as a connect kwarg.
    db_url = settings.DATABASE_URL.replace("?sslmode=require", "").replace("&sslmode=require", "")

    # Recreate engine with connect_args including ssl context
    engine = create_async_engine(db_url, connect_args={"ssl": ssl_ctx}, **engine_kwargs)

# Create async session factory
async_session_maker = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    Dependency for getting async database sessions.
    
    Usage:
        @app.get("/items")
        async def get_items(db: AsyncSession = Depends(get_db)):
            result = await db.execute(select(Item))
            return result.scalars().all()
    """
    async with async_session_maker() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db() -> None:
    """Initialize database - create all tables."""
    from app.db.base import Base
    
    async with engine.begin() as conn:
        # In production, use Alembic migrations instead
        # await conn.run_sync(Base.metadata.create_all)
        pass


async def close_db() -> None:
    """Close database connections."""
    await engine.dispose()


def get_db_sync_engine():
    """Return a synchronous SQLAlchemy engine for background scripts/workers."""
    sync_url = settings.database_url_sync
    return create_engine(sync_url)
