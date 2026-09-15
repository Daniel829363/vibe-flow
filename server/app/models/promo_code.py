import uuid
from datetime import datetime, timezone
from sqlalchemy import String, DateTime, Float, Integer, Boolean, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class PromoCode(Base):
    __tablename__ = "promo_codes"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    cashback_percent: Mapped[float] = mapped_column(Float, nullable=False)
    max_uses: Mapped[int] = mapped_column(Integer, nullable=False, default=100)
    current_uses: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    valid_from: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    valid_until: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    # Relationships
    usages: Mapped[list["PromoCodeUsage"]] = relationship(
        "PromoCodeUsage", back_populates="promo_code", cascade="all, delete-orphan"
    )

    def to_dict(self):
        return {
            "id": self.id,
            "code": self.code,
            "cashback_percent": self.cashback_percent,
            "max_uses": self.max_uses,
            "current_uses": self.current_uses,
            "valid_from": self.valid_from.isoformat() if self.valid_from else None,
            "valid_until": self.valid_until.isoformat() if self.valid_until else None,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class PromoCodeUsage(Base):
    __tablename__ = "promo_code_usages"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    promo_code_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("promo_codes.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    payment_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("finik_payments.id", ondelete="SET NULL"), nullable=True
    )
    cashback_amount_tokens: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    cashback_amount_usd: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    # Relationships
    promo_code: Mapped["PromoCode"] = relationship("PromoCode", back_populates="usages")
    user: Mapped["User"] = relationship("User", foreign_keys=[user_id])

    def to_dict(self):
        return {
            "id": self.id,
            "promo_code_id": self.promo_code_id,
            "user_id": self.user_id,
            "payment_id": self.payment_id,
            "cashback_amount_tokens": self.cashback_amount_tokens,
            "cashback_amount_usd": self.cashback_amount_usd,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
