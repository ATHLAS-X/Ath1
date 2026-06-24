"""Video analysis business logic: submit (enqueue) and process (worker)."""

from __future__ import annotations

from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.constants.video_prompt import VIDEO_ANALYSIS_SYSTEM_PROMPT
from app.core.config import get_settings
from app.core.errors import AppError
from app.core.gemini_client import GeminiClient, get_gemini_client, map_gemini_error
from app.core.logging import get_logger
from app.core.security import Principal
from app.models.video import VideoAnalysisResult, VideoAnalysisTask
from app.schemas.common import ErrorCode, TaskAcceptedResponse, TaskStatus
from app.schemas.video import VideoAnalysisResult as VideoResultSchema
from app.schemas.video import VideoAnalyzeRequest
from app.services import cache, rate_limit
from app.services.json_utils import JsonParseError, extract_json
from app.services.validation import validate_youtube_clip

logger = get_logger(__name__)

_VIDEO_RL_PREFIX = "video_rl"
_ESTIMATED_SECONDS = 60


def _build_user_prompt(req: VideoAnalyzeRequest) -> str:
    lines = [f"Player Role: {req.player_role.value}"]
    for i, clip in enumerate(req.clips, start=1):
        lines.append(f"Clip {i} Type: {clip.clip_type.value}")
    if req.ground_type:
        lines.append(f"Ground/Venue Type: {req.ground_type.value}")
    if req.opposition_quality:
        lines.append(f"Opposition Quality: {req.opposition_quality}")
    lines.append(f"Context Notes: {req.context_notes or 'None provided'}")
    lines.append("Analyze the attached cricket video(s) and provide complete technical analysis.")
    return "\n".join(lines)


async def submit_video_analysis(
    session: AsyncSession,
    redis: Any,
    queue: Any,
    principal: Principal,
    req: VideoAnalyzeRequest,
) -> TaskAcceptedResponse:
    settings = get_settings()

    # 1. Clip-count cap (configurable, default 2). Single clip is allowed (soft flag).
    if len(req.clips) > settings.video_max_clips_per_submission:
        raise AppError(
            ErrorCode.INVALID_REQUEST,
            f"At most {settings.video_max_clips_per_submission} clips per submission "
            f"(received {len(req.clips)}).",
            status_code=422,
        )

    # 2. Validate each clip (format + oEmbed accessibility).
    for clip in req.clips:
        await validate_youtube_clip(clip.youtube_url)

    clips_payload = [{"youtube_url": c.youtube_url, "clip_type": c.clip_type.value} for c in req.clips]
    cache_key = cache.canonical_cache_key(clips_payload, req.player_role.value)

    # 3. Cache hit → persist a COMPLETE task immediately, no Gemini, no RL consumption.
    cached = await cache.get_cached_analysis(redis, cache_key)
    if cached is not None:
        task = VideoAnalysisTask(
            player_id=req.player_id,
            submitted_by_user_id=principal.user_id,
            player_role=req.player_role.value,
            clips=clips_payload,
            context_notes=req.context_notes or "",
            cache_key=cache_key,
            status=TaskStatus.COMPLETE.value,
        )
        session.add(task)
        await session.flush()
        session.add(
            VideoAnalysisResult(task_id=task.id, player_id=req.player_id, analysis=cached)
        )
        await session.flush()
        return TaskAcceptedResponse(
            task_id=task.id, status=TaskStatus.COMPLETE, estimated_completion_seconds=0
        )

    # 4. Rate limit (per player per day) — only for genuinely new analyses.
    await rate_limit.enforce_daily_limit(
        redis, _VIDEO_RL_PREFIX, req.player_id, settings.video_analyses_per_player_per_day
    )

    # 5. Create PENDING task and enqueue.
    task = VideoAnalysisTask(
        player_id=req.player_id,
        submitted_by_user_id=principal.user_id,
        player_role=req.player_role.value,
        clips=clips_payload,
        context_notes=req.context_notes or "",
        cache_key=cache_key,
        status=TaskStatus.PENDING.value,
    )
    session.add(task)
    await session.flush()
    await queue.enqueue_job("video_analyze", task.id)
    return TaskAcceptedResponse(
        task_id=task.id, status=TaskStatus.PENDING, estimated_completion_seconds=_ESTIMATED_SECONDS
    )


async def process_video_task(
    session: AsyncSession,
    task_id: str,
    gemini: GeminiClient | None = None,
    redis: Any = None,
) -> None:
    """Worker-side processing. Drives PENDING → PROCESSING → COMPLETE/FAILED."""
    gemini = gemini or get_gemini_client()
    task = await session.get(VideoAnalysisTask, task_id)
    if task is None:
        logger.error("video task not found", extra={"data": {"task_id": task_id}})
        return

    task.status = TaskStatus.PROCESSING.value
    await session.flush()

    urls = [c["youtube_url"] for c in task.clips]
    req_like = VideoAnalyzeRequest(
        player_id=task.player_id,
        player_role=task.player_role,
        clips=task.clips,
        context_notes=task.context_notes,
    )
    result = await gemini.analyze_video(urls, VIDEO_ANALYSIS_SYSTEM_PROMPT, _build_user_prompt(req_like))

    if result.get("status") != "success":
        task.status = TaskStatus.FAILED.value
        task.error_code = map_gemini_error(result.get("error_code", "UNKNOWN"))
        task.error_message = result.get("message", "Gemini call failed")
        await session.flush()
        return

    try:
        raw = extract_json(result["content"])
        validated = VideoResultSchema.model_validate(raw)
    except (JsonParseError, ValueError) as exc:
        task.status = TaskStatus.FAILED.value
        task.error_code = ErrorCode.INVALID_RESPONSE.value
        task.error_message = f"Model output failed schema validation: {exc}"
        await session.flush()
        return

    analysis = validated.model_dump(mode="json")

    # Enforce the single-angle soft flag deterministically (Engineering Doc 3.2).
    if len(task.clips) < 2 and "single_angle_only" not in analysis["data_quality_flags"]:
        analysis["data_quality_flags"].append("single_angle_only")

    session.add(VideoAnalysisResult(task_id=task.id, player_id=task.player_id, analysis=analysis))
    task.status = TaskStatus.COMPLETE.value
    await session.flush()

    # Populate the dedup cache so identical re-submissions skip Gemini (Engineering Doc 5.3).
    if redis is not None:
        try:
            await cache.set_cached_analysis(redis, task.cache_key, analysis)
        except Exception as exc:  # noqa: BLE001 - caching is best-effort
            logger.warning("video cache set failed", extra={"data": {"error": str(exc)}})


# ── Read / view-filtering ────────────────────────────────────────────────────
def filter_analysis_for_player(analysis: dict[str, Any]) -> dict[str, Any]:
    """Player developmental view (Engineering Doc 3.6): summary + strengths + recs."""
    observations = analysis.get("technique_observations", [])
    strengths = [o for o in observations if o.get("category") == "strength"]
    return {
        "overall_assessment": analysis.get("overall_assessment"),
        "technique_observations": strengths,
        "recommendations": analysis.get("recommendations", []),
        "data_quality_flags": analysis.get("data_quality_flags", []),
    }


async def get_player_analyses(
    session: AsyncSession, player_id: str, principal: Principal
) -> list[dict[str, Any]]:
    """Return stored analyses for a player, filtered by the caller's role.

    SCOUT/ADMIN → full analysis. PLAYER → developmental (filtered) view.
    """
    rows = (
        await session.execute(
            select(VideoAnalysisResult)
            .where(VideoAnalysisResult.player_id == player_id)
            .order_by(VideoAnalysisResult.created_at.desc())
        )
    ).scalars().all()

    is_player_view = principal.role.value == "PLAYER"
    out: list[dict[str, Any]] = []
    for row in rows:
        analysis = row.analysis
        out.append(
            {
                "task_id": row.task_id,
                "created_at": row.created_at.isoformat() if row.created_at else None,
                "analysis": filter_analysis_for_player(analysis) if is_player_view else analysis,
            }
        )
    return out
