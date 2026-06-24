"""TIER 3 — LIVE video analysis (REAL Gemini + REAL YouTube videos).

⚠️  SKIPPED BY DEFAULT. Calls the REAL Gemini API (GEMINI_VIDEO_MODEL =
gemini-3.1-pro-preview, a PREVIEW model with tight quota). Run with:

    GEMINI_API_KEY=... pytest -m live_api tests/test_video_live.py

This file is a SCAFFOLD. It cannot be completed without real footage: there is no
ground truth to assert against until you provide actual cricket videos. Paste real,
PUBLIC YouTube URLs into YOUTUBE_TEST_URLS below (each tagged with its clip type and
the player role it depicts), then flesh out the TODO assertions.

──────────────────────────────────────────────────────────────────────────────
FILL THIS IN  ↓↓↓
──────────────────────────────────────────────────────────────────────────────
"""

from __future__ import annotations

import os

import pytest

from app.constants.video_prompt import VIDEO_ANALYSIS_SYSTEM_PROMPT
from app.core.gemini_client import get_gemini_client
from app.schemas.video import VideoAnalysisResult
from app.services.json_utils import extract_json

pytestmark = [
    pytest.mark.live_api,
    pytest.mark.asyncio,
    pytest.mark.skipif(not os.environ.get("GEMINI_API_KEY"), reason="GEMINI_API_KEY not set"),
]

# Each entry: real PUBLIC YouTube URL + clip_type (see schemas.video.ClipType) +
# player_role (Batsman | Fast Bowler | Spin Bowler | Wicketkeeper | All-rounder).
#
# Example shape (REPLACE with real videos):
#   {"youtube_url": "https://www.youtube.com/watch?v=REAL_ID",
#    "clip_type": "Batting – side-on", "player_role": "Batsman"},
YOUTUBE_TEST_URLS: list[dict[str, str]] = [
    # TODO: paste real YouTube links here before running this tier.
]


def _build_user_prompt(clip_type: str, player_role: str) -> str:
    return (
        f"Player Role: {player_role}\n"
        f"Clip 1 Type: {clip_type}\n"
        f"Context Notes: None provided\n"
        "Analyze the attached cricket video(s) and provide complete technical analysis."
    )


@pytest.mark.skipif(not YOUTUBE_TEST_URLS, reason="YOUTUBE_TEST_URLS is empty — add real videos")
@pytest.mark.parametrize("idx", range(len(YOUTUBE_TEST_URLS) or 1))
async def test_live_video_analysis(idx):
    case = YOUTUBE_TEST_URLS[idx]
    result = await get_gemini_client().analyze_video(
        [case["youtube_url"]],
        VIDEO_ANALYSIS_SYSTEM_PROMPT,
        _build_user_prompt(case["clip_type"], case["player_role"]),
    )
    assert result["status"] == "success", f"Gemini call failed: {result}"

    # The output MUST validate against the Engineering Doc 3.5 schema.
    parsed = extract_json(result["content"])
    analysis = VideoAnalysisResult.model_validate(parsed)

    # ── TODO (requires real footage / ground truth) ──────────────────────────
    # Once you know what each video actually contains, add assertions such as:
    #   * analysis.clip_metadata.player_role matches case["player_role"]
    #   * at least N technique_observations are returned (doc flags <3 for review)
    #   * for a known-good side-on batting clip, expect a "backlift" or
    #     "hip-shoulder separation" marker to appear
    #   * injury_risk_flag observations only appear for clips that genuinely show them
    #   * confidence is "low" when you deliberately submit a poor-quality clip
    #   * data_quality_flags includes "single_angle_only" for single-clip submissions
    # Do NOT assert exact strings — check for presence of the expected signal, since
    # model output varies between runs.
    assert analysis is not None  # placeholder until real assertions are added
