"""TIER 2 — OCR endpoint plumbing/contract (mocked Gemini, fakeredis).

Covers: valid submit, role-gating (PLAYER/SCOUT rejected), rate limit, status state
machine, malformed input, and owner/admin status-access scoping. No AI-judgment.
"""

from __future__ import annotations

import pytest

from app.core.security import Role
from app.workers import jobs
from tests.conftest import MockGeminiClient, TINY_PNG_BASE64, auth_headers

pytestmark = pytest.mark.asyncio


def _payload_b64():
    return {"image_base64": TINY_PNG_BASE64}


_UNSET = object()


async def _submit(client, headers, payload=_UNSET):
    body = _payload_b64() if payload is _UNSET else payload
    return await client.post("/api/v1/compute/ocr/scorecard", json=body, headers=headers)


async def test_valid_submission_base64(client, academy_admin_headers, fake_queue):
    resp = await _submit(client, academy_admin_headers)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["status"] == "PENDING"
    assert fake_queue.jobs and fake_queue.jobs[0][0] == "ocr_scorecard"


async def test_tournament_organizer_allowed(client, tournament_admin_headers):
    resp = await _submit(client, tournament_admin_headers)
    assert resp.status_code == 200


@pytest.mark.parametrize("role", [Role.PLAYER, Role.SCOUT])
async def test_role_gating_rejects_player_and_scout(client, role):
    resp = await _submit(client, auth_headers(role, "u1"))
    assert resp.status_code == 403
    assert resp.json()["error_code"] == "FORBIDDEN"


async def test_malformed_no_image_source(client, academy_admin_headers):
    resp = await _submit(client, academy_admin_headers, payload={})
    assert resp.status_code == 422
    assert resp.json()["error_code"] == "INVALID_REQUEST"


async def test_malformed_invalid_base64(client, academy_admin_headers):
    resp = await _submit(client, academy_admin_headers, payload={"image_base64": "@@@nope@@@"})
    assert resp.status_code == 400
    assert resp.json()["error_code"] == "INVALID_IMAGE"


async def test_rate_limit(client, academy_admin_headers, monkeypatch):
    from app.core.config import get_settings

    monkeypatch.setattr(get_settings(), "ocr_scorecards_per_admin_per_day", 2)
    assert (await _submit(client, academy_admin_headers)).status_code == 200
    assert (await _submit(client, academy_admin_headers)).status_code == 200
    third = await _submit(client, academy_admin_headers)
    assert third.status_code == 429
    assert third.json()["error_code"] == "RATE_LIMIT_EXCEEDED"


async def test_status_state_machine(client, academy_admin_headers):
    resp = await _submit(client, academy_admin_headers)
    task_id = resp.json()["task_id"]

    s1 = await client.get(f"/api/v1/compute/ocr/status/{task_id}", headers=academy_admin_headers)
    assert s1.json()["status"] == "PENDING"

    await jobs.ocr_scorecard({"gemini": MockGeminiClient()}, task_id)
    s2 = await client.get(f"/api/v1/compute/ocr/status/{task_id}", headers=academy_admin_headers)
    body = s2.json()
    assert body["status"] == "COMPLETE"
    assert body["result"]["review_status"] == "PENDING_REVIEW"
    assert "extraction" in body["result"]


async def test_status_failed_on_gemini_error(client, academy_admin_headers):
    resp = await _submit(client, academy_admin_headers)
    task_id = resp.json()["task_id"]
    err = MockGeminiClient(force_error={"status": "error", "error_code": "TIMEOUT", "message": "t"})
    await jobs.ocr_scorecard({"gemini": err}, task_id)
    s = await client.get(f"/api/v1/compute/ocr/status/{task_id}", headers=academy_admin_headers)
    assert s.json()["status"] == "FAILED"
    assert s.json()["error"]["code"] == "GEMINI_TIMEOUT"


async def test_status_owner_scoping(client):
    owner = auth_headers(Role.ACADEMY_ADMIN, "owner_a")
    resp = await _submit(client, owner)
    task_id = resp.json()["task_id"]

    # A different non-admin submitter cannot see it (404).
    other = auth_headers(Role.TOURNAMENT_ORGANIZER, "other_t")
    r_other = await client.get(f"/api/v1/compute/ocr/status/{task_id}", headers=other)
    assert r_other.status_code == 404
    assert r_other.json()["error_code"] == "TASK_NOT_FOUND"

    # A platform admin can see any task.
    r_admin = await client.get(
        f"/api/v1/compute/ocr/status/{task_id}", headers=auth_headers(Role.ATHLASX_ADMIN, "adm")
    )
    assert r_admin.status_code == 200


async def test_requires_auth(client):
    resp = await _submit(client, {})
    assert resp.status_code == 401
