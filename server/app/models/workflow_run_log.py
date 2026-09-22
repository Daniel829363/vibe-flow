import uuid
from datetime import datetime, timezone
from sqlalchemy import String, DateTime, Float, Boolean, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base
import enum


class RunTypeEnum(str, enum.Enum):
    WORKFLOW = "workflow"
    NODE = "node"


class TokenSourceEnum(str, enum.Enum):
    RUNNER = "runner"
    OWNER = "owner"


class WorkflowRunLog(Base):
    __tablename__ = "workflow_run_logs"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    workflow_id: Mapped[str] = mapped_column(
        String(255), nullable=False, index=True
    )
    workflow_name: Mapped[str | None] = mapped_column(String(500), nullable=True)

    run_id: Mapped[str | None] = mapped_column(String(255), nullable=True)

    run_type: Mapped[str] = mapped_column(
        String(20),
        default="workflow",
        nullable=False,
    )

    runner_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    owner_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    is_shared_run: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    token_source: Mapped[str] = mapped_column(
        String(20),
        default="runner",
        nullable=False,
    )

    charged_user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )

    # JSON string: [{"node_id": "...", "model": "...", "cost_usd": 0.01, "tokens": 1.0}, ...]
    model_chain: Mapped[str | None] = mapped_column(Text, nullable=True)

    tokens_total: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    cost_usd_total: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)

    node_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    node_label: Mapped[str | None] = mapped_column(String(500), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    # Relationships
    runner: Mapped["User"] = relationship(
        "User", foreign_keys=[runner_id], lazy="selectin"
    )
    owner: Mapped["User"] = relationship(
        "User", foreign_keys=[owner_id], lazy="selectin"
    )
    charged_user: Mapped["User"] = relationship(
        "User", foreign_keys=[charged_user_id], lazy="selectin"
    )

    def to_dict(self):
        import json
        model_chain_parsed = None
        if self.model_chain:
            try:
                model_chain_parsed = json.loads(self.model_chain)
            except (json.JSONDecodeError, TypeError):
                model_chain_parsed = self.model_chain

        r_type = self.run_type.value if isinstance(self.run_type, RunTypeEnum) else str(self.run_type)
        t_source = self.token_source.value if isinstance(self.token_source, TokenSourceEnum) else str(self.token_source)

        return {
            "id": self.id,
            "workflow_id": self.workflow_id,
            "workflow_name": self.workflow_name,
            "run_id": self.run_id,
            "run_type": r_type.lower(),
            "runner_id": self.runner_id,
            "runner_name": self.runner.name if self.runner else None,
            "runner_email": self.runner.email if self.runner else None,
            "owner_id": self.owner_id,
            "owner_name": self.owner.name if self.owner else None,
            "owner_email": self.owner.email if self.owner else None,
            "is_shared_run": self.is_shared_run,
            "token_source": t_source.lower(),
            "charged_user_id": self.charged_user_id,
            "charged_user_name": self.charged_user.name if self.charged_user else None,
            "charged_user_email": self.charged_user.email if self.charged_user else None,
            "model_chain": model_chain_parsed,
            "tokens_total": round(self.tokens_total or 0.0, 4),
            "cost_usd_total": round(self.cost_usd_total or 0.0, 6),
            "node_id": self.node_id,
            "node_label": self.node_label,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
