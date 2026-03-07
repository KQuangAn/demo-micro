from alembic import context
from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

from app.core.config import settings
from app.core.database import Base

# Alembic Config object
config = context.config

# Set the sqlalchemy.url from settings (remove asyncpg for sync connection)
sync_database_url = settings.DATABASE_URL.replace("+asyncpg", "")
config.set_main_option("sqlalchemy.url", sync_database_url)

# Import all models here so Alembic can detect them
from app.models.user import User  # noqa

target_metadata = Base.metadata

def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()

def do_run_migrations(connection: Connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()

def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    # For async migrations, we need to use sync connection
    # Replace asyncpg with psycopg2 for migrations
    sync_url = config.get_main_option("sqlalchemy.url").replace("+asyncpg", "")
    config.set_main_option("sqlalchemy.url", sync_url)
    
    connectable = context.config.attributes.get("connection", None)
    
    if connectable is None:
        from sqlalchemy import create_engine
        connectable = create_engine(sync_url, poolclass=pool.NullPool)
    
    with connectable.connect() as connection:
        do_run_migrations(connection)

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
