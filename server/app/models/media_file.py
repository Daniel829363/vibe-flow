import uuid
from datetime import datetime, timezone
from sqlalchemy import String, DateTime, ForeignKey, BigInteger
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class MediaFile(Base):
    __tablename__ = "media_files"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    filename: Mapped[str] = mapped_column(String(500), nullable=False)
    url: Mapped[str] = mapped_column(String(2000), nullable=False)
    file_type: Mapped[str] = mapped_column(
        String(50), nullable=False, default="other"
    )  # "image", "video", "audio", "other"
    source: Mapped[str] = mapped_column(
        String(50), nullable=False, default="upload"
    )  # "upload", "generation"
    size_bytes: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    mime_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    workflow_id: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    workflow_name: Mapped[str | None] = mapped_column(String(500), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, index=True
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="media_files")

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "filename": self.filename,
            "url": self.url,
            "file_type": self.file_type,
            "source": self.source,
            "size_bytes": self.size_bytes,
            "mime_type": self.mime_type,
            "workflow_id": self.workflow_id,
            "workflow_name": self.workflow_name,
            "user_email": self.user.email if self.user else None,
            "user_name": self.user.name if self.user else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "deleted_at": self.deleted_at.isoformat() if self.deleted_at else None,
        }
