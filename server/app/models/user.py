import os
import uuid
from datetime import datetime, timezone
from sqlalchemy import String, DateTime, Boolean, Float
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    hashed_password: Mapped[str | None] = mapped_column(String(255), nullable=True)
    google_id: Mapped[str | None] = mapped_column(String(255), unique=True, nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    is_email_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    email_verification_token: Mapped[str | None] = mapped_column(String(255), nullable=True)
    password_reset_token: Mapped[str | None] = mapped_column(String(255), nullable=True)
    password_reset_expires: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    token_balance: Mapped[float] = mapped_column(Float, default=0.0, nullable=False, server_default="0")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # Relationships
    workflows: Mapped[list["WorkflowMeta"]] = relationship(
        "WorkflowMeta", back_populates="owner", cascade="all, delete-orphan"
    )
    shared_workflows: Mapped[list["WorkflowShare"]] = relationship(
        "WorkflowShare", back_populates="user", cascade="all, delete-orphan"
    )
    token_transactions: Mapped[list["TokenTransaction"]] = relationship(
        "TokenTransaction", back_populates="user", cascade="all, delete-orphan",
        foreign_keys="[TokenTransaction.user_id]"
    )
    media_files: Mapped[list["MediaFile"]] = relationship(
        "MediaFile", back_populates="user", cascade="all, delete-orphan",
        foreign_keys="[MediaFile.user_id]"
    )

    @property
    def is_superadmin(self) -> bool:
        super_email = os.getenv("SUPER_ADMIN_EMAIL", "").strip().lower()
        return bool(super_email and self.email and self.email.strip().lower() == super_email)

    def to_dict(self):
        return {
            "id": self.id,
            "email": self.email,
            "phone": self.phone,
            "name": self.name,
            "avatar_url": self.avatar_url,
            "is_email_verified": self.is_email_verified,
            "google_id": self.google_id is not None,
            "token_balance": round(self.token_balance or 0.0, 4),
            "is_superadmin": self.is_superadmin,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

