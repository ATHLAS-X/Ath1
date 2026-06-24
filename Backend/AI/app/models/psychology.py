"""SQLAlchemy models for psychological assessment (owned tables)."""

from __future__ import annotations

from typing import Any

from sqlalchemy import JSON, ForeignKey, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.base import TimestampMixin, UUIDPrimaryKeyMixin
from app.schemas.common import TaskStatus


class PsychologyAssessmentTask(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "psychology_assessment_tasks"

    player_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    submitted_by_user_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    # Full raw submission (includes open-ended PII — retained per the doc's 90-day
    # policy; never written to logs, see core/logging.py).
    submission: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    status: Mapped[str] = mapped_column(String(16), default=TaskStatus.PENDING.value, nullable=False)
    error_code: Mapped[str | None] = mapped_column(String(48), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    __table_args__ = (Index("ix_psych_tasks_player_created", "player_id", "created_at"),)


class PsychologyAssessmentResult(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "psychology_assessment_results"

    task_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("psychology_assessment_tasks.id", ondelete="CASCADE"),
        unique=True, nullable=False,
    )
    player_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    profile: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
