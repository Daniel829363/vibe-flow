import uuid
from datetime import datetime, timezone
from sqlalchemy import String, DateTime, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base
import enum


class VisibilityEnum(str, enum.Enum):
    PUBLIC = "public"
    PRIVATE = "private"


class WorkflowMeta(Base):
    __tablename__ = "workflow_meta"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    remote_workflow_id: Mapped[str] = mapped_column(
        String(255), unique=True, index=True, nullable=False
    )
    owner_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str | None] = mapped_column(String(500), nullable=True)
    thumbnail: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    visibility: Mapped[str] = mapped_column(
        SAEnum(VisibilityEnum, name="visibility_enum", create_constraint=True),
        default=VisibilityEnum.PRIVATE,
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # Relationships
    owner: Mapped["User"] = relationship("User", back_populates="workflows")
    shares: Mapped[list["WorkflowShare"]] = relationship(
        "WorkflowShare", back_populates="workflow_meta", cascade="all, delete-orphan"
    )

    def to_dict(self, access_level: str | None = None):
        result = {
            "id": self.id,
            "remote_workflow_id": self.remote_workflow_id,
            "owner_id": self.owner_id,
            "name": self.name,
            "thumbnail": self.thumbnail,
            "visibility": self.visibility.value if isinstance(self.visibility, VisibilityEnum) else self.visibility,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
        if access_level is not None:
            result["access_level"] = access_level
        return result
