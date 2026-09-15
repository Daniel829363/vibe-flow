import logging
from sqlalchemy import text
from app.database import engine, Base
from app.models import (  # noqa: F401
    User,
    WorkflowMeta,
    WorkflowShare,
    TokenTransaction,
    MediaFile,
    PromoCode,
    PromoCodeUsage,
    PaymentOffer,
    LegalDocument,
    FinikPayment,
)

logger = logging.getLogger(__name__)


async def init_db():
    """Create all tables in the database if they don't exist and run light migrations."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        try:
            await conn.execute(text("ALTER TABLE workflow_meta ADD COLUMN IF NOT EXISTS thumbnail VARCHAR(2000)"))
        except Exception as e:
            logger.warning(f"Note on thumbnail column migration: {e}")

        try:
            await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS token_balance FLOAT DEFAULT 0.0 NOT NULL"))
        except Exception as e:
            logger.warning(f"Note on token_balance column migration: {e}")

    logger.info("Database tables created/verified successfully.")

