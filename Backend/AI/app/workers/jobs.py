"""ARQ job functions for the compute-worker.

Each job loads its task, runs the module's processing logic (which drives the
PENDING → PROCESSING → COMPLETE/FAILED state machine) inside its own DB session, and
commits. A shared Gemini client is created once at worker startup and passed via ctx.
"""

from __future__ import annotations

import asyncio
from typing import Any

from app.core.database import get_sessionmaker
from app.core.gemini_client import get_gemini_client
from app.core.logging import get_logger
from app.services import ocr, psychology, video_analysis

logger = get_logger(__name__)

# Serialize video analysis to one Gemini call at a time (arch doc 14.5: the PREVIEW
# video model has tight per-minute quota; concurrent video jobs exhaust it and fail).
_VIDEO_SEMAPHORE = asyncio.Semaphore(1)


async def _run(ctx: dict[str, Any], processor, task_id: str, label: str) -> None:
    gemini = ctx.get("gemini") or get_gemini_client()
    sessionmaker = get_sessionmaker()
    async with sessionmaker() as session:
        try:
            await processor(session, task_id, gemini)
            await session.commit()
        except Exception:
            await session.rollback()
            logger.error(f"{label} job crashed", extra={"data": {"task_id": task_id}})
            raise


async def video_analyze(ctx: dict[str, Any], task_id: str) -> None:
    # Video also needs Redis (for the dedup cache); pass it through explicitly.
    gemini = ctx.get("gemini") or get_gemini_client()
    redis = ctx.get("redis")
    sessionmaker = get_sessionmaker()
    async with _VIDEO_SEMAPHORE:
        async with sessionmaker() as session:
            try:
                await video_analysis.process_video_task(
                    session, task_id, gemini=gemini, redis=redis
                )
                await session.commit()
            except Exception:
                await session.rollback()
                logger.error("video.analyze job crashed", extra={"data": {"task_id": task_id}})
                raise


async def psych_analyze(ctx: dict[str, Any], task_id: str) -> None:
    await _run(ctx, psychology.process_psych_task, task_id, "psych.analyze")


async def ocr_scorecard(ctx: dict[str, Any], task_id: str) -> None:
    await _run(ctx, ocr.process_ocr_task, task_id, "ocr.scorecard")
