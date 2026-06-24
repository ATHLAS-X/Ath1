"""Health check endpoint (arch doc 7.1): DB + Redis + Gemini reachability."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Response
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_redis
from app.core.gemini_client import get_gemini_client
from app.core.logging import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/api/v1/compute", tags=["health"])


@router.get(
    "/health",
    summary="Service health: DB, Redis, and Gemini reachability",
    description=(
        "Reports per-component status. DB or Redis failure ⇒ overall `unhealthy` (503). "
        "A Gemini reachability problem alone ⇒ `degraded` (still 200), since the API can "
        "still queue work."
    ),
)
async def health(
    response: Response,
    session: AsyncSession = Depends(get_db),
    redis=Depends(get_redis),
) -> dict[str, Any]:
    components: dict[str, str] = {}

    # Database
    try:
        await session.execute(text("SELECT 1"))
        components["database"] = "ok"
    except Exception as exc:  # noqa: BLE001
        logger.error("health: db check failed", extra={"data": {"error": str(exc)}})
        components["database"] = "error"

    # Redis
    try:
        await redis.ping()
        components["redis"] = "ok"
    except Exception as exc:  # noqa: BLE001
        logger.error("health: redis check failed", extra={"data": {"error": str(exc)}})
        components["redis"] = "error"

    # Gemini (lightweight reachability; no generation cost)
    try:
        reachable = await get_gemini_client().check_reachable()
        components["gemini"] = "ok" if reachable else "unreachable"
    except Exception as exc:  # noqa: BLE001
        logger.warning("health: gemini check failed", extra={"data": {"error": str(exc)}})
        components["gemini"] = "unreachable"

    critical_ok = components["database"] == "ok" and components["redis"] == "ok"
    if not critical_ok:
        status = "unhealthy"
        response.status_code = 503
    elif components["gemini"] != "ok":
        status = "degraded"
    else:
        status = "ok"

    return {"status": status, "service": "compute", "components": components}
