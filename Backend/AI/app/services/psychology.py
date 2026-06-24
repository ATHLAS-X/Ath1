"""Psychological assessment business logic: submit (enqueue) and process (worker)."""

from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.constants.psych_prompt import PSYCH_ANALYSIS_SYSTEM_PROMPT
from app.core.config import get_settings
from app.core.errors import assessment_too_frequent
from app.core.gemini_client import GeminiClient, get_gemini_client, map_gemini_error
from app.core.logging import get_logger
from app.core.security import Principal
from app.models.psychology import PsychologyAssessmentResult, PsychologyAssessmentTask
from app.schemas.common import ErrorCode, TaskAcceptedResponse, TaskStatus
from app.schemas.psychology import PsychAnalysisResult, PsychAnalyzeRequest
from app.services import preprocessing
from app.services.json_utils import JsonParseError, extract_json

logger = get_logger(__name__)

_ESTIMATED_SECONDS = 15


async def _within_cooldown(session: AsyncSession, player_id: str, days: int) -> datetime | None:
    """Return the timestamp of the most recent assessment within the window, if any."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    row = (
        await session.execute(
            select(PsychologyAssessmentTask.created_at)
            .where(PsychologyAssessmentTask.player_id == player_id)
            .where(PsychologyAssessmentTask.created_at >= cutoff)
            .order_by(PsychologyAssessmentTask.created_at.desc())
            .limit(1)
        )
    ).scalar_one_or_none()
    return row


async def submit_psych_analysis(
    session: AsyncSession,
    queue: Any,
    principal: Principal,
    req: PsychAnalyzeRequest,
) -> TaskAcceptedResponse:
    settings = get_settings()

    # Rate limit: 1 assessment per player per 30 days (DB-based).
    last = await _within_cooldown(session, req.player_id, settings.psych_assessment_cooldown_days)
    if last is not None:
        if last.tzinfo is None:  # SQLite returns naive datetimes; assume UTC
            last = last.replace(tzinfo=timezone.utc)
        next_allowed = last + timedelta(days=settings.psych_assessment_cooldown_days)
        retry_after = max(1, int((next_allowed - datetime.now(timezone.utc)).total_seconds()))
        raise assessment_too_frequent(
            f"Only one assessment per {settings.psych_assessment_cooldown_days} days is allowed.",
            retry_after=retry_after,
        )

    task = PsychologyAssessmentTask(
        player_id=req.player_id,
        submitted_by_user_id=principal.user_id,
        submission=json.loads(req.model_dump_json()),
        status=TaskStatus.PENDING.value,
    )
    session.add(task)
    await session.flush()
    await queue.enqueue_job("psych_analyze", task.id)
    return TaskAcceptedResponse(
        task_id=task.id, status=TaskStatus.PENDING, estimated_completion_seconds=_ESTIMATED_SECONDS
    )


async def process_psych_task(
    session: AsyncSession, task_id: str, gemini: GeminiClient | None = None
) -> None:
    gemini = gemini or get_gemini_client()
    task = await session.get(PsychologyAssessmentTask, task_id)
    if task is None:
        logger.error("psych task not found", extra={"data": {"task_id": task_id}})
        return

    task.status = TaskStatus.PROCESSING.value
    await session.flush()

    req = PsychAnalyzeRequest.model_validate(task.submission)

    # Deterministic pre-processing (Section 4.4) → Gemini input package.
    package = preprocessing.build_gemini_input_package(
        player_id=req.player_id,
        acsi_responses=req.acsi_responses,
        scenario_responses={k: v for k, v in req.scenario_responses.items()},
        open_ended_responses=req.open_ended_responses,
        lie_scale_responses=req.lie_scale_responses,
        player_context=req.player_context.model_dump(),
    )
    user_prompt = json.dumps(package, default=str)
    result = await gemini.analyze_text(PSYCH_ANALYSIS_SYSTEM_PROMPT, user_prompt)

    if result.get("status") != "success":
        task.status = TaskStatus.FAILED.value
        task.error_code = map_gemini_error(result.get("error_code", "UNKNOWN"))
        task.error_message = result.get("message", "Gemini call failed")
        await session.flush()
        return

    try:
        raw = extract_json(result["content"])
        profile = _finalize_profile(raw, req, package)
        validated = PsychAnalysisResult.model_validate(profile)
    except (JsonParseError, ValueError) as exc:
        task.status = TaskStatus.FAILED.value
        task.error_code = ErrorCode.INVALID_RESPONSE.value
        task.error_message = f"Model output failed schema validation: {exc}"
        await session.flush()
        return

    session.add(
        PsychologyAssessmentResult(
            task_id=task.id, player_id=task.player_id, profile=validated.model_dump(mode="json")
        )
    )
    task.status = TaskStatus.COMPLETE.value
    await session.flush()


def _finalize_profile(raw: dict[str, Any], req: PsychAnalyzeRequest, package: dict[str, Any]) -> dict[str, Any]:
    """Overlay deterministic fields onto the model output so the contract is exact.

    The model supplies narrative/summaries and ``social_desirability_risk``; we
    authoritatively set the boolean response-quality flags, the subscale scores, and
    the submission metadata from our own pre-processing rather than trusting the model
    to recompute them.
    """
    det = package["response_quality_flags"]

    # Subscale scores from our aggregation (authoritative).
    raw["acsi_subscale_scores"] = {
        k: v for k, v in package["acsi_subscale_scores"].items() if k != "total_acsi_28"
    }

    # Response quality flags: keep model's social_desirability_risk, override booleans.
    model_flags = raw.get("response_quality_flags", {}) or {}
    sd_risk = model_flags.get("social_desirability_risk", "low")
    # Hard rule (Section 4.5): if lie scale triggered, the model's SD risk should not
    # be understated — leave SD to the model but ensure the boolean is truthful.
    raw["response_quality_flags"] = {
        "social_desirability_risk": sd_risk,
        "lie_scale_triggered": det["lie_scale_triggered"],
        "open_ended_vagueness_flag": det["open_ended_superficial"],
        "response_inconsistency_flag": det["response_inconsistency"],
    }

    # Submission metadata (authoritative).
    raw["submission_metadata"] = {
        "player_id": req.player_id,
        "completion_time_minutes": req.completion_time_minutes,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    return raw


# ── Read / 3-tier view filtering (Engineering Doc 4.7) ───────────────────────
def filter_profile_for_role(profile: dict[str, Any], role: str) -> dict[str, Any]:
    caveats = profile.get("mandatory_caveats", [])
    if role == "PLAYER":
        return {
            "player_development_summary": profile.get("player_development_summary"),
            "mandatory_caveats": caveats,
        }
    if role in ("ADMIN", "ATHLASX_ADMIN"):
        return profile  # full, including raw_gemini_narrative
    # Scout (default for any other authorised viewer): summary + flags + caveats only.
    return {
        "scout_summary": profile.get("scout_summary"),
        "response_quality_flags": profile.get("response_quality_flags"),
        "mandatory_caveats": caveats,
    }


async def get_player_profile(
    session: AsyncSession, player_id: str, principal: Principal
) -> dict[str, Any] | None:
    row = (
        await session.execute(
            select(PsychologyAssessmentResult)
            .where(PsychologyAssessmentResult.player_id == player_id)
            .order_by(PsychologyAssessmentResult.created_at.desc())
            .limit(1)
        )
    ).scalar_one_or_none()
    if row is None:
        return None
    return filter_profile_for_role(row.profile, principal.role.value)
