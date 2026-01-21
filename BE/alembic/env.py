"""Alembic environment configuration for async SQLAlchemy."""
import asyncio
from logging.config import fileConfig
from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config
from alembic import context
import sys
import ssl
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

# Import your models and config
from app.db.base import Base
from app.db.models import (
    User, RefreshToken, JobDescription, Question,
    TestSession, Answer, CeleryTask
)
from config import get_settings

settings = get_settings()

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Interpret the config file for Python logging.
# This line sets up loggers basically.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# add your model's MetaData object here
# for 'autogenerate' support
target_metadata = Base.metadata

# Override sqlalchemy.url with actual database URL
config.set_main_option("sqlalchemy.url", settings.database_url_sync)


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode.

    This configures the context with just a URL
    and not an Engine, though an Engine is acceptable
    here as well.  By skipping the Engine creation
    we don't even need a DBAPI to be available.

    Calls to context.execute() here emit the given string to the
    script output.
    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
        compare_server_default=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    """Run migrations with connection."""
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,
        compare_server_default=True,
    )

    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    """Run migrations in 'online' mode with async engine."""
    configuration = config.get_section(config.config_ini_section, {})
    configuration["sqlalchemy.url"] = settings.DATABASE_URL
    # If SSL mode is required we set connect_args below; strip the
    # `sslmode=require` query param from the URL so the asyncpg driver
    # does not receive an unexpected `sslmode` kwarg.
    if "sslmode=require" in configuration["sqlalchemy.url"]:
        configuration["sqlalchemy.url"] = configuration["sqlalchemy.url"].replace("?sslmode=require", "").replace("&sslmode=require", "")
    # Support SSL connections for hosts (e.g., AWS RDS) by honoring
    # an explicit `sslmode=require` query param in the DATABASE_URL.
    connect_args = {}
    if "sslmode=require" in settings.DATABASE_URL:
        # Create SSL context. If SKIP_SSL_VERIFY is enabled (dev only),
        # disable certificate verification temporarily.
        ssl_ctx = ssl.create_default_context()
        if getattr(settings, "SKIP_SSL_VERIFY", False):
            ssl_ctx.check_hostname = False
            ssl_ctx.verify_mode = ssl.CERT_NONE
        connect_args = {"ssl": ssl_ctx}
    
    connectable = async_engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
        connect_args=connect_args,
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
