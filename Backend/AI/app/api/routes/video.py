"""Video Analysis endpoints (Engineering Doc 3.6, re-prefixed per arch doc)."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_principal, get_redis, get_task_queue, require_roles
from app.core.errors import not_found
from app.core.security import Principal, Role
from app.models.video import VideoAnalysisResult, VideoAnalysisTask
from app.schemas.common import ErrorCode, TaskAcceptedResponse, TaskStatusResponse
from app.schemas.video import VideoAnalyzeRequest
from app.services import video_analysis
from app.services.tasks import build_status_response
from sqlalchemy import select

router = APIRouter(prefix="/api/v1/compute/video", tags=["video"])

_SCOUT_ROLES = (Role.SCOUT, Role.ADMIN, Role.ATHLASX_ADMIN)


async def _result_loader(session: AsyncSession, task: VideoAnalysisTask) -> dict[str, Any] | None:
    row = (
        await session.execute(
            select(VideoAnalysisResult).where(VideoAnalysisResult.task_id == task.id)
        )
    ).scalar_one_or_none()
    return row.analysis if row else None


@router.post(
    "/analyze",
    response_model=TaskAcceptedResponse,
    summary="Submit a video analysis (enqueues an ARQ job)",
    description=(
        "Submit 1–2 YouTube clips for Gemini technique analysis. Returns a task_id "
        "immediately; poll the status endpoint for the result. A single clip is "
        "accepted and later tagged with the `single_angle_only` data-quality flag — "
        "it is never rejected. Scout JWT required."
    ),
)
async def analyze_video(
    req: VideoAnalyzeRequest,
    principal: Principal = Depends(require_roles(*_SCOUT_ROLES)),
    session: AsyncSession = Depends(get_db),
    redis=Depends(get_redis),
    queue=Depends(get_task_queue),
) -> TaskAcceptedResponse:
    return await video_analysis.submit_video_analysis(session, redis, queue, principal, req)


@router.get(
    "/status/{task_id}",
    response_model=TaskStatusResponse,
    summary="Poll a video analysis task",
    description="Returns PENDING/PROCESSING, or COMPLETE with the full analysis, or FAILED with an error. Scout JWT required.",
)
async def video_status(
    task_id: str,
    principal: Principal = Depends(require_roles(*_SCOUT_ROLES)),
    session: AsyncSession = Depends(get_db),
) -> TaskStatusResponse:
    task = await session.get(VideoAnalysisTask, task_id)
    if task is None:
        raise not_found(ErrorCode.TASK_NOT_FOUND, f"Video task not found: {task_id}")
    return await build_status_response(session, task, _result_loader)


@router.get(
    "/player/{player_id}",
    summary="All stored analyses for a player (role-filtered)",
    description=(
        "SCOUT/ADMIN receive the full analysis; PLAYER receives the developmental "
        "view (overall summary, strengths only, recommendations)."
    ),
)
async def player_analyses(
    player_id: str,
    principal: Principal = Depends(get_principal),
    session: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    analyses = await video_analysis.get_player_analyses(session, player_id, principal)
    return {"player_id": player_id, "view": principal.role.value, "analyses": analyses}
