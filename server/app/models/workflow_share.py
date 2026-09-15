import uuid
from datetime import datetime, timezone
from sqlalchemy import String, DateTime, ForeignKey, Enum as SAEnum, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base
import enum


class AccessLevelEnum(str, enum.Enum):
    FULL_ACCESS = "full_access"
    VIEW_ONLY = "view_only"


class WorkflowShare(Base):
    __tablename__ = "workflow_shares"
    __table_args__ = (
        UniqueConstraint("workflow_meta_id", "shared_with_user_id", name="uq_workflow_share"),
    )

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    workflow_meta_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("workflow_meta.id", ondelete="CASCADE"), nullable=False
    )
    shared_with_user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    access_level: Mapped[str] = mapped_column(
        SAEnum(AccessLevelEnum, name="access_level_enum", create_constraint=True),
        default=AccessLevelEnum.VIEW_ONLY,
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    # Relationships
    workflow_meta: Mapped["WorkflowMeta"] = relationship(
        "WorkflowMeta", back_populates="shares"
    )
    user: Mapped["User"] = relationship("User", back_populates="shared_workflows")

    def to_dict(self):
        return {
            "id": self.id,
            "workflow_meta_id": self.workflow_meta_id,
            "shared_with_user_id": self.shared_with_user_id,
            "access_level": self.access_level.value if isinstance(self.access_level, AccessLevelEnum) else self.access_level,
            "user_email": self.user.email if self.user else None,
            "user_name": self.user.name if self.user else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
