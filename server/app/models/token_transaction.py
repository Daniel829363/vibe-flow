import uuid
from datetime import datetime, timezone
from sqlalchemy import String, DateTime, Float, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base
import enum


class TransactionTypeEnum(str, enum.Enum):
    TOPUP = "topup"
    DEDUCTION = "deduction"
    USAGE = "usage"


class TokenTransaction(Base):
    __tablename__ = "token_transactions"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    amount_tokens: Mapped[float] = mapped_column(Float, nullable=False)
    amount_usd: Mapped[float] = mapped_column(Float, nullable=False)
    type: Mapped[str] = mapped_column(
        SAEnum(TransactionTypeEnum, name="transaction_type_enum", create_constraint=True),
        nullable=False,
    )
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    workflow_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    workflow_name: Mapped[str | None] = mapped_column(String(500), nullable=True)
    admin_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    # Relationships
    user: Mapped["User"] = relationship(
        "User", back_populates="token_transactions", foreign_keys=[user_id]
    )

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "amount_tokens": self.amount_tokens,
            "amount_usd": self.amount_usd,
            "type": self.type.value if isinstance(self.type, TransactionTypeEnum) else self.type,
            "description": self.description,
            "workflow_id": self.workflow_id,
            "workflow_name": self.workflow_name,
            "admin_id": self.admin_id,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
