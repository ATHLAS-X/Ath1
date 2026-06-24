"""Redis / ARQ connection helpers.

A single Redis instance backs three concerns:
  * the ARQ job queue (compute-worker),
  * rate-limit counters,
  * the video-analysis dedup cache.

ARQ uses logical DB 1 by the architecture doc's namespace convention (DB 0 BullMQ,
DB 1 ARQ, DB 2 OTP). The DATABASE index is taken from ``REDIS_URL``.
"""

from __future__ import annotations

from arq import create_pool
from arq.connections import ArqRedis, RedisSettings

from app.core.config import get_settings


def redis_settings() -> RedisSettings:
    return RedisSettings.from_dsn(get_settings().redis_url)


_pool: ArqRedis | None = None


async def get_arq_pool() -> ArqRedis:
    """Shared ARQ Redis pool used by the API to enqueue jobs and read counters.

    ``ArqRedis`` is a subclass of ``redis.asyncio.Redis``, so the same handle is
    used for plain commands (rate-limit counters, cache get/set) and for
    ``enqueue_job``.
    """
    global _pool
    if _pool is None:
        _pool = await create_pool(redis_settings())
    return _pool


async def close_arq_pool() -> None:
    global _pool
    if _pool is not None:
        await _pool.aclose()
        _pool = None
