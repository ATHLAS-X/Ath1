"""TIER 2 — psychology endpoint plumbing/contract (mocked Gemini).

Asserts the code handles the contract correctly regardless of what Gemini returns.
No assertions about AI judgment quality (that is Tier 3). Runs with no API key.
"""

from __future__ import annotations

import pytest

from app.core.security import Role
from app.workers import jobs
from tests.conftest import (
    MockGeminiClient,
    auth_headers,
    build_psych_payload,
)

pytestmark = pytest.mark.asyncio


async def _submit(client, headers, payload):
    return await client.post("/api/v1/compute/psych/analyze", json=payload, headers=headers)


async def test_valid_submission_returns_task_id_pending(client, player_headers, fake_queue):
    resp = await _submit(client, player_headers, build_psych_payload())
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["status"] == "PENDING"
    assert body["task_id"]
    # The job was enqueued.
    assert fake_queue.jobs and fake_queue.jobs[0][0] == "psych_analyze"


async def test_rate_limit_one_per_30_days(client, player_headers):
    first = await _submit(client, player_headers, build_psych_payload())
    assert first.status_code == 200
    second = await _submit(client, player_headers, build_psych_payload())
    assert second.status_code == 429
    body = second.json()
    assert body["error_code"] == "ASSESSMENT_TOO_FREQUENT"
    assert body["retry_after"] and body["retry_after"] > 0
    assert body["request_id"].startswith("req_")


async def test_malformed_submission_returns_error_schema(client, player_headers):
    payload = build_psych_payload()
    del payload["acsi_responses"]["5"]  # drop an item → fails the 1-28 validator
    resp = await _submit(client, player_headers, payload)
    assert resp.status_code == 422
    body = resp.json()
    assert body["error_code"] == "INVALID_REQUEST"
    assert "request_id" in body


async def test_status_state_machine(client, player_headers):
    resp = await _submit(client, player_headers, build_psych_payload())
    task_id = resp.json()["task_id"]

    # PENDING right after submit.
    s1 = await client.get(f"/api/v1/compute/psych/status/{task_id}", headers=player_headers)
    assert s1.json()["status"] == "PENDING"

    # Drive the worker with a mock Gemini → COMPLETE.
    await jobs.psych_analyze({"gemini": MockGeminiClient()}, task_id)
    s2 = await client.get(f"/api/v1/compute/psych/status/{task_id}", headers=player_headers)
    body = s2.json()
    assert body["status"] == "COMPLETE"
    assert body["result"] is not None


async def test_status_failed_on_gemini_error(client, player_headers):
    resp = await _submit(client, player_headers, build_psych_payload())
    task_id = resp.json()["task_id"]
    err = MockGeminiClient(force_error={"status": "error", "error_code": "RATE_LIMIT", "message": "quota"})
    await jobs.psych_analyze({"gemini": err}, task_id)
    s = await client.get(f"/api/v1/compute/psych/status/{task_id}", headers=player_headers)
    body = s.json()
    assert body["status"] == "FAILED"
    assert body["error"]["code"] == "GEMINI_RATE_LIMIT"


async def _process_one(client, headers, player_id):
    resp = await _submit(client, headers, build_psych_payload(player_id=player_id))
    task_id = resp.json()["task_id"]
    await jobs.psych_analyze({"gemini": MockGeminiClient()}, task_id)
    return task_id


async def test_scout_view_only_summary_flags_caveats(client):
    # Player submits their own profile.
    await _process_one(client, auth_headers(Role.PLAYER, "p_scoutview"), "p_scoutview")
    resp = await client.get(
        "/api/v1/compute/psych/player/p_scoutview", headers=auth_headers(Role.SCOUT, "s1")
    )
    profile = resp.json()["profile"]
    assert "scout_summary" in profile
    assert "response_quality_flags" in profile
    assert "mandatory_caveats" in profile
    assert "player_development_summary" not in profile
    assert "raw_gemini_narrative" not in profile


async def test_player_view_only_development_caveats(client):
    headers = auth_headers(Role.PLAYER, "p_playerview")
    await _process_one(client, headers, "p_playerview")
    resp = await client.get("/api/v1/compute/psych/player/p_playerview", headers=headers)
    profile = resp.json()["profile"]
    assert "player_development_summary" in profile
    assert "mandatory_caveats" in profile
    assert "scout_summary" not in profile


async def test_admin_view_full_profile(client):
    await _process_one(client, auth_headers(Role.PLAYER, "p_adminview"), "p_adminview")
    resp = await client.get(
        "/api/v1/compute/psych/player/p_adminview", headers=auth_headers(Role.ATHLASX_ADMIN, "a1")
    )
    profile = resp.json()["profile"]
    assert "scout_summary" in profile
    assert "player_development_summary" in profile
    assert "raw_gemini_narrative" in profile


async def test_deterministic_flags_overlaid_on_model_output(client):
    """Even though the mock model says lie_scale_triggered=False, a triggering
    submission must surface True (we authoritatively overlay our pre-processing)."""
    payload = build_psych_payload(player_id="p_flags")
    payload["lie_scale_responses"] = [4, 4, 4, 1, 1]  # triggers lie scale
    resp = await _submit(client, auth_headers(Role.PLAYER, "p_flags"), payload)
    task_id = resp.json()["task_id"]
    await jobs.psych_analyze({"gemini": MockGeminiClient()}, task_id)
    out = await client.get(
        "/api/v1/compute/psych/player/p_flags", headers=auth_headers(Role.ATHLASX_ADMIN, "a2")
    )
    flags = out.json()["profile"]["response_quality_flags"]
    assert flags["lie_scale_triggered"] is True


async def test_requires_auth(client):
    resp = await _submit(client, {}, build_psych_payload())
    assert resp.status_code == 401
    assert resp.json()["error_code"] == "UNAUTHORIZED"


async def test_questionnaire_endpoint(client, player_headers):
    resp = await client.get("/api/v1/compute/psych/questionnaire", headers=player_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["acsi_items"]) == 28
    assert len(data["scenarios"]) == 10
    assert len(data["open_ended_questions"]) == 5
    assert len(data["lie_scale_items"]) == 5
