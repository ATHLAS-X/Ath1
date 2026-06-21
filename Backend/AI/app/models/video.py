"""SQLAlchemy models for video analysis (owned tables)."""

from __future__ import annotations

from typing import Any

from sqlalchemy import JSON, ForeignKey, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.base import TimestampMixin, UUIDPrimaryKeyMixin
from app.schemas.common import TaskStatus


class VideoAnalysisTask(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "video_analysis_tasks"

    player_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    submitted_by_user_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    player_role: Mapped[str] = mapped_column(String(32), nullable=False)
    clips: Mapped[list[dict[str, Any]]] = mapped_column(JSON, nullable=False)
    context_notes: Mapped[str] = mapped_column(Text, default="", nullable=False)
    cache_key: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    status: Mapped[str] = mapped_column(String(16), default=TaskStatus.PENDING.value, nullable=False)
    error_code: Mapped[str | None] = mapped_column(String(48), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    __table_args__ = (Index("ix_video_tasks_player_status", "player_id", "status"),)


class VideoAnalysisResult(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "video_analysis_results"

    task_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("video_analysis_tasks.id", ondelete="CASCADE"),
        unique=True, nullable=False,
    )
    player_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    analysis: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
