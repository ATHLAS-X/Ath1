"""Psychological Assessment endpoints (Engineering Doc 4.7, re-prefixed per arch doc)."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_principal, get_task_queue, require_roles
from app.core.errors import not_found
from app.core.security import Principal, Role
from app.models.psychology import PsychologyAssessmentResult, PsychologyAssessmentTask
from app.schemas.common import ErrorCode, TaskAcceptedResponse, TaskStatusResponse
from app.schemas.psychology import PsychAnalyzeRequest
from app.services import psychology
from app.services.tasks import build_status_response

from app.constants import question_bank

router = APIRouter(prefix="/api/v1/compute/psych", tags=["psychology"])

_SUBMIT_ROLES = (Role.PLAYER, Role.ADMIN, Role.ATHLASX_ADMIN)
_POLL_ROLES = (Role.PLAYER, Role.ADMIN, Role.ATHLASX_ADMIN)


@router.get(
    "/questionnaire",
    summary="The full Cricket Development Profile question bank",
    description=(
        "Static instrument: instructions, 4-point response scale, 28 ACSI items "
        "(7 subscales, items 27/28 reverse-scored), 5 lie-scale items, 10 scenarios "
        "(4 options each), and 5 open-ended questions. For frontend rendering."
    ),
)
async def questionnaire(
    principal: Principal = Depends(get_principal),
) -> dict[str, Any]:
    return {
        "instructions": question_bank.INSTRUCTIONS_TO_PLAYER,
        "response_scale": question_bank.RESPONSE_SCALE,
        "acsi_items": question_bank.ACSI_ITEMS,
        "subscales": question_bank.SUBSCALES,
        "lie_scale_items": question_bank.LIE_SCALE_ITEMS,
        "scenarios": question_bank.SCENARIOS,
        "open_ended_questions": question_bank.OPEN_ENDED_QUESTIONS,
    }


@router.post(
    "/analyze",
    response_model=TaskAcceptedResponse,
    summary="Submit a psychological assessment (enqueues an ARQ job)",
    description=(
        "Submit the raw ACSI-28 item responses, scenario selections, open-ended "
        "answers, and lie-scale responses. Server-side pre-processing (subscale "
        "aggregation, reverse scoring, flag detection) runs before the Gemini call. "
        "Rate limited to 1 assessment per player per 30 days. Player JWT required."
    ),
)
async def analyze_psych(
    req: PsychAnalyzeRequest,
    principal: Principal = Depends(require_roles(*_SUBMIT_ROLES)),
    session: AsyncSession = Depends(get_db),
    queue=Depends(get_task_queue),
) -> TaskAcceptedResponse:
    return await psychology.submit_psych_analysis(session, queue, principal, req)


@router.get(
    "/status/{task_id}",
    response_model=TaskStatusResponse,
    summary="Poll a psychology assessment task",
    description=(
        "Returns PENDING/PROCESSING, or COMPLETE with the role-filtered profile, or "
        "FAILED. Only the submitting player or an admin may poll a given task."
    ),
)
async def psych_status(
    task_id: str,
    principal: Principal = Depends(require_roles(*_POLL_ROLES)),
    session: AsyncSession = Depends(get_db),
) -> TaskStatusResponse:
    task = await session.get(PsychologyAssessmentTask, task_id)
    if task is None:
        raise not_found(ErrorCode.TASK_NOT_FOUND, f"Psych task not found: {task_id}")
    # Ownership scoping: submitter or admin only.
    if not principal.is_admin and task.submitted_by_user_id != principal.user_id:
        raise not_found(ErrorCode.TASK_NOT_FOUND, f"Psych task not found: {task_id}")

    async def _loader(session: AsyncSession, task: PsychologyAssessmentTask) -> dict[str, Any] | None:
        row = (
            await session.execute(
                select(PsychologyAssessmentResult).where(
                    PsychologyAssessmentResult.task_id == task.id
                )
            )
        ).scalar_one_or_none()
        if row is None:
            return None
        # Role-filter even on status polling so a player never sees scout-only fields.
        return psychology.filter_profile_for_role(row.profile, principal.role.value)

    return await build_status_response(session, task, _loader)


@router.get(
    "/player/{player_id}",
    summary="Latest psychology profile for a player (3-tier role view)",
    description=(
        "SCOUT → scout_summary + response_quality_flags + caveats. PLAYER → "
        "player_development_summary + caveats. ADMIN → full profile incl. narrative."
    ),
)
async def player_profile(
    player_id: str,
    principal: Principal = Depends(get_principal),
    session: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    profile = await psychology.get_player_profile(session, player_id, principal)
    if profile is None:
        raise not_found(ErrorCode.PLAYER_NOT_FOUND, f"No psychology profile for player: {player_id}")
    return {"player_id": player_id, "view": principal.role.value, "profile": profile}
