"""TIER 2 — video endpoint plumbing/contract (mocked Gemini, fakeredis).

Covers Engineering Doc 7.3 video cases: valid submit, invalid URL, inaccessible
video, rate-limit, Gemini timeout, Gemini rate-limit — plus caching, the single-angle
soft flag, and scout/player view filtering. No AI-judgment assertions.
"""

from __future__ import annotations

import pytest

from app.core.security import Role
from app.services import validation
from app.workers import jobs
from tests.conftest import MockGeminiClient, auth_headers

pytestmark = pytest.mark.asyncio


def _vid(n: int) -> str:
    return f"vid{n:08d}"  # 11-char YouTube-style id


def _clip(n: int, clip_type: str = "Batting – front-on") -> dict:
    return {"youtube_url": f"https://www.youtube.com/watch?v={_vid(n)}", "clip_type": clip_type}


def _payload(player_id="player_9", clips=None, role="Batsman", notes=""):
    return {
        "player_id": player_id,
        "player_role": role,
        "clips": clips if clips is not None else [_clip(1), _clip(2, "Batting – side-on")],
        "context_notes": notes,
    }


@pytest.fixture(autouse=True)
def _oembed_ok(monkeypatch):
    """Default: all YouTube videos are accessible. Individual tests can override."""
    async def ok(url):
        return 200

    monkeypatch.setattr(validation, "_oembed_status", ok)


async def _submit(client, headers, payload):
    return await client.post("/api/v1/compute/video/analyze", json=payload, headers=headers)


async def test_valid_submission(client, scout_headers, fake_queue):
    resp = await _submit(client, scout_headers, _payload())
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["status"] == "PENDING"
    assert fake_queue.jobs and fake_queue.jobs[0][0] == "video_analyze"


async def test_invalid_youtube_url(client, scout_headers):
    payload = _payload(clips=[{"youtube_url": "https://vimeo.com/123", "clip_type": "Batting – front-on"}])
    resp = await _submit(client, scout_headers, payload)
    assert resp.status_code == 400
    assert resp.json()["error_code"] == "INVALID_YOUTUBE_URL"


async def test_inaccessible_video(client, scout_headers, monkeypatch):
    async def not_ok(url):
        return 404

    monkeypatch.setattr(validation, "_oembed_status", not_ok)
    resp = await _submit(client, scout_headers, _payload(clips=[_clip(1)]))
    assert resp.status_code == 400
    assert resp.json()["error_code"] == "VIDEO_NOT_ACCESSIBLE"


async def test_too_many_clips_rejected(client, scout_headers):
    payload = _payload(clips=[_clip(1), _clip(2), _clip(3)])
    resp = await _submit(client, scout_headers, payload)
    assert resp.status_code == 422
    assert resp.json()["error_code"] == "INVALID_REQUEST"


async def test_rate_limit_exceeded(client, scout_headers):
    # 5 submissions allowed; 6th rejected. Distinct video ids avoid the dedup cache.
    for i in range(5):
        r = await _submit(client, scout_headers, _payload(clips=[_clip(100 + i)]))
        assert r.status_code == 200, r.text
    sixth = await _submit(client, scout_headers, _payload(clips=[_clip(200)]))
    assert sixth.status_code == 429
    body = sixth.json()
    assert body["error_code"] == "RATE_LIMIT_EXCEEDED"
    assert body["retry_after"] and body["retry_after"] > 0


async def test_single_clip_soft_flag(client, scout_headers, fake_redis):
    resp = await _submit(client, scout_headers, _payload(clips=[_clip(5)]))
    task_id = resp.json()["task_id"]
    await jobs.video_analyze({"gemini": MockGeminiClient(), "redis": fake_redis}, task_id)
    status = await client.get(f"/api/v1/compute/video/status/{task_id}", headers=scout_headers)
    flags = status.json()["result"]["data_quality_flags"]
    assert "single_angle_only" in flags


async def test_gemini_timeout_sets_failed(client, scout_headers, fake_redis):
    resp = await _submit(client, scout_headers, _payload(clips=[_clip(6)]))
    task_id = resp.json()["task_id"]
    err = MockGeminiClient(force_error={"status": "error", "error_code": "TIMEOUT", "message": "timed out"})
    await jobs.video_analyze({"gemini": err, "redis": fake_redis}, task_id)
    status = await client.get(f"/api/v1/compute/video/status/{task_id}", headers=scout_headers)
    body = status.json()
    assert body["status"] == "FAILED"
    assert body["error"]["code"] == "GEMINI_TIMEOUT"


async def test_gemini_rate_limit_sets_failed(client, scout_headers, fake_redis):
    resp = await _submit(client, scout_headers, _payload(clips=[_clip(7)]))
    task_id = resp.json()["task_id"]
    err = MockGeminiClient(force_error={"status": "error", "error_code": "RATE_LIMIT", "message": "quota"})
    await jobs.video_analyze({"gemini": err, "redis": fake_redis}, task_id)
    status = await client.get(f"/api/v1/compute/video/status/{task_id}", headers=scout_headers)
    assert status.json()["error"]["code"] == "GEMINI_RATE_LIMIT"


async def test_cache_hit_skips_enqueue(client, scout_headers, fake_redis, fake_queue):
    clips = [_clip(10), _clip(11, "Batting – side-on")]
    first = await _submit(client, scout_headers, _payload(clips=clips))
    first_task = first.json()["task_id"]
    assert len(fake_queue.jobs) == 1
    # Process → populates the dedup cache in fake_redis.
    await jobs.video_analyze({"gemini": MockGeminiClient(), "redis": fake_redis}, first_task)
    # Identical resubmission → cache hit → COMPLETE immediately, no new enqueue.
    second = await _submit(client, scout_headers, _payload(clips=clips))
    assert second.json()["status"] == "COMPLETE"
    assert len(fake_queue.jobs) == 1  # unchanged


async def test_status_requires_scout_role(client, player_headers):
    resp = await client.get("/api/v1/compute/video/status/some-id", headers=player_headers)
    assert resp.status_code == 403
    assert resp.json()["error_code"] == "FORBIDDEN"


async def test_player_vs_scout_view(client, scout_headers, fake_redis):
    resp = await _submit(client, scout_headers, _payload(player_id="pview", clips=[_clip(20), _clip(21, "Batting – side-on")]))
    task_id = resp.json()["task_id"]
    await jobs.video_analyze({"gemini": MockGeminiClient(), "redis": fake_redis}, task_id)

    # Scout view: full analysis incl. role_specific_scores.
    scout = await client.get("/api/v1/compute/video/player/pview", headers=scout_headers)
    scout_analysis = scout.json()["analyses"][0]["analysis"]
    assert "role_specific_scores" in scout_analysis
    categories = {o["category"] for o in scout_analysis["technique_observations"]}
    assert "development_area" in categories  # scouts see everything

    # Player view: strengths only, no role_specific_scores.
    player = await client.get(
        "/api/v1/compute/video/player/pview", headers=auth_headers(Role.PLAYER, "pview")
    )
    player_analysis = player.json()["analyses"][0]["analysis"]
    assert "role_specific_scores" not in player_analysis
    player_categories = {o["category"] for o in player_analysis["technique_observations"]}
    assert player_categories == {"strength"}


async def test_requires_auth(client):
    resp = await _submit(client, {}, _payload())
    assert resp.status_code == 401
