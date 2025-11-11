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

settings = get_settings()

# Create async engine
engine: AsyncEngine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DB_ECHO,
    poolclass=NullPool if settings.ENVIRONMENT == "testing" else None,
    pool_size=settings.DB_POOL_SIZE if settings.ENVIRONMENT != "testing" else None,
    max_overflow=settings.DB_MAX_OVERFLOW if settings.ENVIRONMENT != "testing" else None,
    pool_timeout=settings.DB_POOL_TIMEOUT if settings.ENVIRONMENT != "testing" else None,
    pool_recycle=settings.DB_POOL_RECYCLE if settings.ENVIRONMENT != "testing" else None,
    pool_pre_ping=True,  # Verify connections before using
)

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
