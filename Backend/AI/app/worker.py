"""ARQ worker entrypoint: ``python -m arq app.worker.WorkerSettings``.

Per-job timeout/retry policy follows architecture doc Section 11.3:
  * video.analyze  — 120s timeout, 2 retries (max_tries=3)
  * psych.analyze  —  60s timeout, 2 retries
  * ocr.scorecard  —  60s timeout, 2 retries

Video concurrency is constrained to 1 via a semaphore in app.workers.jobs (arch 14.5).
"""

from __future__ import annotations

from typing import Any

from arq import func

from app.core.config import get_settings
from app.core.gemini_client import get_gemini_client
from app.core.logging import configure_logging, get_logger
from app.core.redis import redis_settings
from app.workers import jobs

logger = get_logger(__name__)


async def startup(ctx: dict[str, Any]) -> None:
    configure_logging()
    ctx["gemini"] = get_gemini_client()
    logger.info("arq worker started", extra={"data": {"environment": get_settings().environment}})


async def shutdown(ctx: dict[str, Any]) -> None:
    logger.info("arq worker shutting down")


class WorkerSettings:
    functions = [
        func(jobs.video_analyze, name="video_analyze", timeout=120, max_tries=3),
        func(jobs.psych_analyze, name="psych_analyze", timeout=60, max_tries=3),
        func(jobs.ocr_scorecard, name="ocr_scorecard", timeout=60, max_tries=3),
    ]
    on_startup = startup
    on_shutdown = shutdown
    redis_settings = redis_settings()
    max_tries = 3
