"""TIER 3 — LIVE psychology prompt validation (Engineering Doc 7.2).

⚠️  These tests call the REAL Gemini API (GEMINI_TEXT_MODEL = gemini-3.5-flash). They
cost money/quota and are SKIPPED BY DEFAULT. Run explicitly with:

    GEMINI_API_KEY=... pytest -m live_api tests/test_psych_live.py

Each of the 10 synthetic profiles (tests/fixtures/synthetic_profiles.py) is sent through
the REAL pre-processing pipeline AND the REAL Gemini call — the whole point is to verify
the system prompt produces the intended *judgment*, so the Gemini client is NOT mocked.

LLM output is not perfectly deterministic. Assertions check for the PRESENCE of the right
signal (e.g. "social_desirability_risk is high or medium, not low") rather than exact
strings. If a borderline case (notably profiles 3/7 for caution, or 5 for SD) does not
trigger on a given run, re-run it — that variance is itself useful signal about prompt
reliability, not just flakiness to suppress.
"""

from __future__ import annotations

import json
import os

import pytest

from app.constants.psych_prompt import PSYCH_ANALYSIS_SYSTEM_PROMPT
from app.core.gemini_client import get_gemini_client
from app.schemas.psychology import PsychAnalysisResult, PsychAnalyzeRequest
from app.services import preprocessing, psychology
from app.services.json_utils import extract_json
from tests.fixtures.synthetic_profiles import ALL_PROFILES

pytestmark = [
    pytest.mark.live_api,
    pytest.mark.asyncio,
    pytest.mark.skipif(not os.environ.get("GEMINI_API_KEY"), reason="GEMINI_API_KEY not set"),
]

_CACHE: dict[str, dict] = {}


async def _run_profile(payload: dict) -> dict:
    """Run the REAL pipeline: preprocessing → real Gemini → finalize → validate."""
    req = PsychAnalyzeRequest.model_validate(payload)
    package = preprocessing.build_gemini_input_package(
        player_id=req.player_id,
        acsi_responses=req.acsi_responses,
        scenario_responses={k: v for k, v in req.scenario_responses.items()},
        open_ended_responses=req.open_ended_responses,
        lie_scale_responses=req.lie_scale_responses,
        player_context=req.player_context.model_dump(),
    )
    result = await get_gemini_client().analyze_text(
        PSYCH_ANALYSIS_SYSTEM_PROMPT, json.dumps(package, default=str)
    )
    assert result["status"] == "success", f"Gemini call failed: {result}"
    raw = extract_json(result["content"])
    profile = psychology._finalize_profile(raw, req, package)
    # Validates the model honoured the output schema (incl. >=5 mandatory caveats).
    PsychAnalysisResult.model_validate(profile)
    return profile


async def _get(name: str) -> dict:
    if name not in _CACHE:
        _CACHE[name] = await _run_profile(ALL_PROFILES[name]())
    return _CACHE[name]


# ── Mandatory caveats appear in EVERY output ─────────────────────────────────
@pytest.mark.parametrize("name", list(ALL_PROFILES.keys()))
async def test_mandatory_caveats_present(name):
    profile = await _get(name)
    assert len(profile["mandatory_caveats"]) >= 5


# ── Strengths identified for profiles 1, 2, 9, 10 ────────────────────────────
@pytest.mark.parametrize(
    "name",
    ["1_well_rounded", "2_high_coach_low_confidence", "9_strong_leader", "10_raw_but_coachable"],
)
async def test_strengths_identified(name):
    profile = await _get(name)
    assert len(profile["scout_summary"]["key_strengths"]) >= 1
    assert len(profile["player_development_summary"]["strengths"]) >= 1


# ── Social desirability flagged for profiles 5 and 6 ─────────────────────────
@pytest.mark.parametrize("name", ["5_socially_desirable", "6_lie_scale_triggered"])
async def test_social_desirability_flagged(name):
    profile = await _get(name)
    risk = profile["response_quality_flags"]["social_desirability_risk"]
    assert risk in ("high", "medium"), f"expected SD risk high/medium, got {risk}"


# ── Lie scale triggered for profile 6 (deterministic pre-processing) ─────────
async def test_lie_scale_triggered_profile_6():
    profile = await _get("6_lie_scale_triggered")
    assert profile["response_quality_flags"]["lie_scale_triggered"] is True
    # Hard rule (Section 4.5): SD-high profiles must have LOW scout confidence.
    if profile["response_quality_flags"]["social_desirability_risk"] == "high":
        assert profile["scout_summary"]["confidence"] == "low"


# ── Inconsistency flag for profile 7 (deterministic) ─────────────────────────
async def test_inconsistency_flag_profile_7():
    profile = await _get("7_inconsistent")
    assert profile["response_quality_flags"]["response_inconsistency_flag"] is True


# ── Vagueness / low-effort flag for profile 8 (deterministic) ────────────────
async def test_vagueness_flag_profile_8():
    profile = await _get("8_low_engagement")
    assert profile["response_quality_flags"]["open_ended_vagueness_flag"] is True


# ── Scout summaries appropriately cautious for 3, 4, 5, 6, 7, 8 ──────────────
@pytest.mark.parametrize(
    "name",
    ["3_overconfident", "4_anxious_performer", "5_socially_desirable",
     "6_lie_scale_triggered", "7_inconsistent", "8_low_engagement"],
)
async def test_scout_summary_cautious(name):
    profile = await _get(name)
    confidence = profile["scout_summary"]["confidence"]
    # "Cautious" = the model did not express HIGH confidence in this profile.
    assert confidence in ("low", "medium"), f"{name}: expected cautious confidence, got {confidence}"
