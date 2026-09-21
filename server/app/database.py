import os
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://postgres:postgres@db:5432/vibeflow"
)

engine = create_async_engine(DATABASE_URL, echo=False, pool_pre_ping=True)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db():
    """Dependency for FastAPI routes — yields an async database session."""
    session = async_session()
    try:
      yield session
    except Exception:
      try:
        await session.rollback()
      except Exception:
        pass
      raise
    finally:
      try:
        await session.close()
      except Exception:
        pass
