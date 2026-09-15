import uuid
from datetime import datetime, timezone
from sqlalchemy import String, DateTime, Float, BigInteger, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class FinikPayment(Base):
    __tablename__ = "finik_payments"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    payment_id: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    transaction_id: Mapped[str | None] = mapped_column(String(100), nullable=True, unique=True)
    amount_kgs: Mapped[float] = mapped_column(Float, nullable=False)
    amount_usd: Mapped[float] = mapped_column(Float, nullable=False)
    net: Mapped[float | None] = mapped_column(Float, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="PENDING", nullable=False, index=True)
    receipt_number: Mapped[str | None] = mapped_column(String(100), nullable=True)
    request_date: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    transaction_date: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    webhook_payload: Mapped[str | None] = mapped_column(Text, nullable=True)
    redirect_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    tokens_credited: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    promo_code_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("promo_codes.id", ondelete="SET NULL"), nullable=True
    )
    cashback_tokens: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    price_coefficient: Mapped[float] = mapped_column(Float, default=1.0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # Relationships
    user: Mapped["User"] = relationship("User", foreign_keys=[user_id])

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "payment_id": self.payment_id,
            "transaction_id": self.transaction_id,
            "amount_kgs": self.amount_kgs,
            "amount_usd": self.amount_usd,
            "net": self.net,
            "status": self.status,
            "receipt_number": self.receipt_number,
            "tokens_credited": self.tokens_credited,
            "cashback_tokens": self.cashback_tokens,
            "price_coefficient": self.price_coefficient,
            "promo_code_id": self.promo_code_id,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
