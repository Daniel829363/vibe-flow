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
    WorkflowRunLog,
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

        try:
            await conn.execute(text("ALTER TABLE workflow_shares ALTER COLUMN access_level TYPE VARCHAR(50) USING access_level::text"))
            await conn.execute(text("UPDATE workflow_shares SET access_level = LOWER(access_level)"))
        except Exception as e:
            logger.warning(f"Note on access_level column migration: {e}")

        try:
            await conn.execute(text("ALTER TABLE workflow_shares ADD COLUMN IF NOT EXISTS token_source VARCHAR(20) DEFAULT 'runner' NOT NULL"))
            await conn.execute(text("ALTER TABLE workflow_shares ALTER COLUMN token_source TYPE VARCHAR(20) USING token_source::text"))
            await conn.execute(text("UPDATE workflow_shares SET token_source = 'runner' WHERE token_source IS NULL OR token_source = ''"))
            await conn.execute(text("UPDATE workflow_shares SET token_source = LOWER(token_source)"))
        except Exception as e:
            logger.warning(f"Note on token_source column migration: {e}")

        try:
            await conn.execute(text("ALTER TABLE workflow_run_logs ALTER COLUMN run_type TYPE VARCHAR(20) USING run_type::text"))
            await conn.execute(text("ALTER TABLE workflow_run_logs ALTER COLUMN token_source TYPE VARCHAR(20) USING token_source::text"))
        except Exception as e:
            logger.debug(f"Note on workflow_run_logs column migration: {e}")

    logger.info("Database tables created/verified successfully.")
