"""Rate limiting.

  * Per-day caps (video submissions, OCR scorecards) use a Redis day-keyed counter.
  * The psych 1-per-30-days cap is a DB query (see services/psychology.py) because a
    30-day window is more robustly enforced against persisted tasks than a Redis TTL.

See RECONCILIATION_NOTES.md for chosen limit values.
"""

from __future__ import annotations

from datetime import datetime, timezone

from redis.asyncio import Redis

from app.core.errors import rate_limit_exceeded

_DAY_SECONDS = 86400


def _today_key(prefix: str, identifier: str) -> str:
    day = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    return f"{prefix}:{identifier}:{day}"


async def _seconds_until_utc_midnight() -> int:
    now = datetime.now(timezone.utc)
    end = now.replace(hour=23, minute=59, second=59, microsecond=0)
    return max(1, int((end - now).total_seconds()))


async def enforce_daily_limit(redis: Redis, prefix: str, identifier: str, limit: int) -> int:
    """Check-then-increment a per-UTC-day counter.

    Raises ``AppError`` (429, RATE_LIMIT_EXCEEDED) if the limit is already reached;
    otherwise increments and returns the new count.
    """
    key = _today_key(prefix, identifier)
    current_raw = await redis.get(key)
    current = int(current_raw) if current_raw is not None else 0
    if current >= limit:
        ttl = await redis.ttl(key)
        retry_after = ttl if ttl and ttl > 0 else await _seconds_until_utc_midnight()
        raise rate_limit_exceeded(
            f"Daily limit of {limit} reached. Try again later.", retry_after=int(retry_after)
        )
    new_count = await redis.incr(key)
    if new_count == 1:
        await redis.expire(key, _DAY_SECONDS)
    return new_count
