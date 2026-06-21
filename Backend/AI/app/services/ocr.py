"""Scorecard OCR business logic: submit (enqueue) and process (worker).

Scope boundary (see RECONCILIATION_NOTES.md): results are stored in this service's
own tables in PENDING_REVIEW state. This service NEVER writes the real ``scorecards``
table and has no commit/confirm endpoint.
"""

from __future__ import annotations

import base64
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.constants.ocr_prompt import OCR_SCORECARD_SYSTEM_PROMPT
from app.core.config import get_settings
from app.core.errors import not_found
from app.core.gemini_client import GeminiClient, get_gemini_client, map_gemini_error
from app.core.logging import get_logger
from app.core.security import Principal
from app.models.ocr import OcrResult, OcrTask
from app.schemas.common import ErrorCode, ReviewStatus, TaskAcceptedResponse, TaskStatus
from app.schemas.ocr import OcrScorecardRequest, OcrScorecardResult
from app.services import rate_limit, validation
from app.services.json_utils import JsonParseError, extract_json

logger = get_logger(__name__)

_OCR_RL_PREFIX = "ocr_rl"
_ESTIMATED_SECONDS = 30


async def submit_ocr_scorecard(
    session: AsyncSession,
    redis: Any,
    queue: Any,
    principal: Principal,
    req: OcrScorecardRequest,
) -> TaskAcceptedResponse:
    settings = get_settings()

    # Obtain validated image bytes from whichever source was provided.
    if req.image_url:
        image_bytes, _mime = await validation.fetch_image_from_url(req.image_url)
        source_type = "url"
        image_url = req.image_url
    else:
        image_bytes, _mime = validation.decode_base64_image(req.image_base64 or "")
        source_type = "base64"
        image_url = None

    # Rate limit per submitting admin per day.
    await rate_limit.enforce_daily_limit(
        redis, _OCR_RL_PREFIX, principal.user_id, settings.ocr_scorecards_per_admin_per_day
    )

    task = OcrTask(
        submitted_by_user_id=principal.user_id,
        image_source_type=source_type,
        image_url=image_url,
        image_data=base64.b64encode(image_bytes).decode("ascii"),
        status=TaskStatus.PENDING.value,
        review_status=ReviewStatus.PENDING_REVIEW.value,
    )
    session.add(task)
    await session.flush()
    await queue.enqueue_job("ocr_scorecard", task.id)
    return TaskAcceptedResponse(
        task_id=task.id, status=TaskStatus.PENDING, estimated_completion_seconds=_ESTIMATED_SECONDS
    )


async def process_ocr_task(
    session: AsyncSession, task_id: str, gemini: GeminiClient | None = None
) -> None:
    gemini = gemini or get_gemini_client()
    task = await session.get(OcrTask, task_id)
    if task is None:
        logger.error("ocr task not found", extra={"data": {"task_id": task_id}})
        return

    task.status = TaskStatus.PROCESSING.value
    await session.flush()

    image_bytes = base64.b64decode(task.image_data or "")
    mime = validation.detect_image_mime(image_bytes) or "image/jpeg"
    user_prompt = "Extract all data from this cricket scorecard image as structured JSON."
    result = await gemini.analyze_image(image_bytes, mime, OCR_SCORECARD_SYSTEM_PROMPT, user_prompt)

    if result.get("status") != "success":
        task.status = TaskStatus.FAILED.value
        task.error_code = map_gemini_error(result.get("error_code", "UNKNOWN"))
        task.error_message = result.get("message", "Gemini call failed")
        await session.flush()
        return

    try:
        raw = extract_json(result["content"])
        validated = OcrScorecardResult.model_validate(raw)
    except (JsonParseError, ValueError) as exc:
        task.status = TaskStatus.FAILED.value
        task.error_code = ErrorCode.INVALID_RESPONSE.value
        task.error_message = f"Model output failed schema validation: {exc}"
        await session.flush()
        return

    session.add(
        OcrResult(
            task_id=task.id,
            submitted_by_user_id=task.submitted_by_user_id,
            extraction=validated.model_dump(mode="json"),
            review_status=ReviewStatus.PENDING_REVIEW.value,
        )
    )
    task.status = TaskStatus.COMPLETE.value
    # review_status remains PENDING_REVIEW — extraction is not auto-approved.
    await session.flush()


async def load_ocr_task_for_principal(
    session: AsyncSession, task_id: str, principal: Principal
) -> OcrTask:
    """Load a task enforcing ownership scoping: owner or platform admin only."""
    task = await session.get(OcrTask, task_id)
    if task is None:
        raise not_found(ErrorCode.TASK_NOT_FOUND, f"OCR task not found: {task_id}")
    if not principal.is_admin and task.submitted_by_user_id != principal.user_id:
        # Non-owner, non-admin: 404 (do not reveal existence of others' tasks).
        raise not_found(ErrorCode.TASK_NOT_FOUND, f"OCR task not found: {task_id}")
    return task
