"""Shared schemas: task status, error responses, role enums.

The error response shape is Engineering Doc Section 5.4. ``TaskStatus`` is the
state machine shared by all three async modules (video / psych / ocr).
"""

from __future__ import annotations

import enum
from typing import Any

from pydantic import BaseModel, Field


class TaskStatus(str, enum.Enum):
    """Async task lifecycle (Engineering Doc 3.3.3). Shared by all modules."""

    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    COMPLETE = "COMPLETE"
    FAILED = "FAILED"


class ReviewStatus(str, enum.Enum):
    """Human-review state for OCR results.

    In this standalone build the only value is ``PENDING_REVIEW`` — a placeholder
    for the admin-approval workflow that lives in the Next.js core later. This is
    DISTINCT from ``TaskStatus``: ``status=COMPLETE`` means "extraction finished",
    never "an admin approved it".
    """

    PENDING_REVIEW = "PENDING_REVIEW"


class ErrorCode(str, enum.Enum):
    """Canonical error codes (Engineering Doc 5.4 + reconciliation additions)."""

    INVALID_YOUTUBE_URL = "INVALID_YOUTUBE_URL"
    VIDEO_NOT_ACCESSIBLE = "VIDEO_NOT_ACCESSIBLE"
    RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED"
    GEMINI_TIMEOUT = "GEMINI_TIMEOUT"
    GEMINI_RATE_LIMIT = "GEMINI_RATE_LIMIT"
    CONTENT_POLICY = "CONTENT_POLICY"
    INVALID_RESPONSE = "INVALID_RESPONSE"
    PLAYER_NOT_FOUND = "PLAYER_NOT_FOUND"
    ASSESSMENT_TOO_FREQUENT = "ASSESSMENT_TOO_FREQUENT"
    # Reconciliation additions
    MODEL_DEPRECATED = "MODEL_DEPRECATED"          # preview video model retired (see gemini_client)
    INVALID_REQUEST = "INVALID_REQUEST"            # generic validation failure
    INVALID_IMAGE = "INVALID_IMAGE"                # OCR image bad/oversized/wrong type
    IMAGE_NOT_ACCESSIBLE = "IMAGE_NOT_ACCESSIBLE"  # OCR image URL unreachable
    UNAUTHORIZED = "UNAUTHORIZED"
    FORBIDDEN = "FORBIDDEN"
    TASK_NOT_FOUND = "TASK_NOT_FOUND"
    UNKNOWN = "UNKNOWN"


class StandardErrorResponse(BaseModel):
    """Engineering Doc Section 5.4 — consistent error envelope across all modules."""

    error_code: str = Field(..., examples=["RATE_LIMIT_EXCEEDED"])
    error_message: str = Field(..., description="Human-readable description.")
    retry_after: int | None = Field(
        None, description="Seconds the client should wait before retrying, if applicable."
    )
    request_id: str = Field(..., examples=["req_550e8400-e29b-41d4-a716-446655440000"])


class TaskAcceptedResponse(BaseModel):
    """Returned by every POST .../analyze (or .../scorecard) enqueue endpoint."""

    task_id: str
    status: TaskStatus = TaskStatus.PENDING
    estimated_completion_seconds: int


class TaskErrorDetail(BaseModel):
    code: str
    message: str
    retry_after: int | None = None


class TaskStatusResponse(BaseModel):
    """Returned by GET .../status/{task_id} (Engineering Doc 3.6 / 4.7)."""

    task_id: str
    status: TaskStatus
    progress: Any | None = None
    result: dict[str, Any] | None = None
    error: TaskErrorDetail | None = None
