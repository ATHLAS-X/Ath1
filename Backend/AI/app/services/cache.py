"""Video-analysis dedup cache (Engineering Doc 5.3).

Identical submissions (same clips + role) reuse a stored analysis instead of
re-calling Gemini. The cache key MUST be canonical because ``clips`` is a list of
dicts (order/serialization fixed) — see RECONCILIATION_NOTES.md.
"""

from __future__ import annotations

import hashlib
import json
from typing import Any

from redis.asyncio import Redis

_CACHE_PREFIX = "video_analysis"
_CACHE_TTL_SECONDS = 7 * 86400  # keep dedup results for a week


def canonical_cache_key(clips: list[dict[str, Any]], player_role: str) -> str:
    """sha256 over canonically-sorted clips + role.

    Clips are sorted by (youtube_url, clip_type); the JSON is serialized with sorted
    keys and no whitespace so the key is stable across request orderings.
    """
    sorted_clips = sorted(
        ({"youtube_url": c["youtube_url"], "clip_type": c["clip_type"]} for c in clips),
        key=lambda c: (c["youtube_url"], c["clip_type"]),
    )
    payload = json.dumps(
        {"clips": sorted_clips, "player_role": player_role},
        sort_keys=True,
        separators=(",", ":"),
    )
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


async def get_cached_analysis(redis: Redis, cache_key: str) -> dict[str, Any] | None:
    raw = await redis.get(f"{_CACHE_PREFIX}:{cache_key}")
    if raw is None:
        return None
    if isinstance(raw, bytes):
        raw = raw.decode("utf-8")
    return json.loads(raw)


async def set_cached_analysis(redis: Redis, cache_key: str, analysis: dict[str, Any]) -> None:
    await redis.set(
        f"{_CACHE_PREFIX}:{cache_key}",
        json.dumps(analysis, default=str),
        ex=_CACHE_TTL_SECONDS,
    )
