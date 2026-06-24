"""SQLAlchemy models for scorecard OCR (owned tables).

Two independent state fields (see RECONCILIATION_NOTES.md):
  * ``status``        — task lifecycle (PENDING/PROCESSING/COMPLETE/FAILED).
  * ``review_status`` — human-review state; always PENDING_REVIEW in this build
                        (placeholder for the Next.js admin-approval workflow).

This service NEVER writes the real ``scorecards`` table; extraction stays here for
later admin review. There is no commit/confirm endpoint.
"""

from __future__ import annotations

from typing import Any

from sqlalchemy import JSON, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.base import TimestampMixin, UUIDPrimaryKeyMixin
from app.schemas.common import ReviewStatus, TaskStatus


class OcrTask(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "ocr_tasks"

    submitted_by_user_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    # "url" or "base64".
    image_source_type: Mapped[str] = mapped_column(String(8), nullable=False)
    image_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Base64 payload retained on the task so the worker can run from task_id.
    # Never logged (see core/logging.py redaction).
    image_data: Mapped[str | None] = mapped_column(Text, nullable=True)

    status: Mapped[str] = mapped_column(String(16), default=TaskStatus.PENDING.value, nullable=False)
    review_status: Mapped[str] = mapped_column(
        String(20), default=ReviewStatus.PENDING_REVIEW.value, nullable=False
    )
    error_code: Mapped[str | None] = mapped_column(String(48), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)


class OcrResult(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "ocr_results"

    task_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("ocr_tasks.id", ondelete="CASCADE"),
        unique=True, nullable=False,
    )
    submitted_by_user_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    extraction: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    review_status: Mapped[str] = mapped_column(
        String(20), default=ReviewStatus.PENDING_REVIEW.value, nullable=False
    )
