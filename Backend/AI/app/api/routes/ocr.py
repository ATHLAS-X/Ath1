"""Scorecard OCR endpoints (arch doc 14.4 + 7.1; prompt/schema designed here).

Admin-class submitters only. No commit/confirm endpoint — extraction stays in
PENDING_REVIEW for later admin review outside this service.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_redis, get_task_queue, require_roles
from app.core.security import OCR_SUBMITTER_ROLES, Principal
from app.models.ocr import OcrResult, OcrTask
from app.schemas.common import TaskAcceptedResponse, TaskStatusResponse
from app.schemas.ocr import OcrScorecardRequest
from app.services import ocr
from app.services.tasks import build_status_response

router = APIRouter(prefix="/api/v1/compute/ocr", tags=["ocr"])

_SUBMITTER_ROLES = tuple(OCR_SUBMITTER_ROLES)


async def _result_loader(session: AsyncSession, task: OcrTask) -> dict[str, Any] | None:
    row = (
        await session.execute(select(OcrResult).where(OcrResult.task_id == task.id))
    ).scalar_one_or_none()
    if row is None:
        return None
    return {"extraction": row.extraction, "review_status": row.review_status}


@router.post(
    "/scorecard",
    response_model=TaskAcceptedResponse,
    summary="Submit a scorecard image for OCR (enqueues an ARQ job)",
    description=(
        "Submit a scorecard image as either `image_url` (public jpg/png) or "
        "`image_base64`. Returns a task_id; poll the status endpoint. Output is "
        "stored in PENDING_REVIEW state — it is never auto-committed to the match "
        "database. Academy/Tournament admin (or platform admin) JWT required."
    ),
)
async def submit_scorecard(
    req: OcrScorecardRequest,
    principal: Principal = Depends(require_roles(*_SUBMITTER_ROLES)),
    session: AsyncSession = Depends(get_db),
    redis=Depends(get_redis),
    queue=Depends(get_task_queue),
) -> TaskAcceptedResponse:
    return await ocr.submit_ocr_scorecard(session, redis, queue, principal, req)


@router.get(
    "/status/{task_id}",
    response_model=TaskStatusResponse,
    summary="Poll a scorecard OCR task",
    description=(
        "Returns PENDING/PROCESSING, or COMPLETE with the extracted scorecard JSON "
        "(in PENDING_REVIEW), or FAILED. Only the submitting admin or a platform "
        "admin may poll a given task."
    ),
)
async def ocr_status(
    task_id: str,
    principal: Principal = Depends(require_roles(*_SUBMITTER_ROLES)),
    session: AsyncSession = Depends(get_db),
) -> TaskStatusResponse:
    task = await ocr.load_ocr_task_for_principal(session, task_id, principal)
    return await build_status_response(session, task, _result_loader)
