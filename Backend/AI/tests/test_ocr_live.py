"""TIER 3 — LIVE scorecard OCR (REAL Gemini + REAL scorecard images).

⚠️  SKIPPED BY DEFAULT. Calls the REAL Gemini API (GEMINI_OCR_MODEL). Run with:

    GEMINI_API_KEY=... pytest -m live_api tests/test_ocr_live.py

This file is a SCAFFOLD. Paste paths to real scorecard images (jpg/png) into
SCORECARD_TEST_IMAGES below, then flesh out the TODO assertions against what those
specific scorecards actually contain (there is no ground truth until you provide them).

──────────────────────────────────────────────────────────────────────────────
FILL THIS IN  ↓↓↓
──────────────────────────────────────────────────────────────────────────────
"""

from __future__ import annotations

import base64
import os
from pathlib import Path

import pytest

from app.constants.ocr_prompt import OCR_SCORECARD_SYSTEM_PROMPT
from app.core.gemini_client import get_gemini_client
from app.schemas.ocr import OcrScorecardResult
from app.services.json_utils import extract_json
from app.services.validation import detect_image_mime

pytestmark = [
    pytest.mark.live_api,
    pytest.mark.asyncio,
    pytest.mark.skipif(not os.environ.get("GEMINI_API_KEY"), reason="GEMINI_API_KEY not set"),
]

# Local filesystem paths to real scorecard images (jpg/png).
# Example (REPLACE with real files):
#   "tests/fixtures/scorecards/match1.jpg",
SCORECARD_TEST_IMAGES: list[str] = [
    # TODO: add paths to real scorecard images before running this tier.
]


@pytest.mark.skipif(not SCORECARD_TEST_IMAGES, reason="SCORECARD_TEST_IMAGES is empty — add real images")
@pytest.mark.parametrize("path", SCORECARD_TEST_IMAGES or ["__none__"])
async def test_live_ocr_extraction(path):
    image_bytes = Path(path).read_bytes()
    mime = detect_image_mime(image_bytes) or "image/jpeg"
    result = await get_gemini_client().analyze_image(
        image_bytes,
        mime,
        OCR_SCORECARD_SYSTEM_PROMPT,
        "Extract all data from this cricket scorecard image as structured JSON.",
    )
    assert result["status"] == "success", f"Gemini call failed: {result}"

    parsed = extract_json(result["content"])
    extraction = OcrScorecardResult.model_validate(parsed)

    # ── TODO (requires real scorecards / ground truth) ───────────────────────
    # Once you know what each scorecard contains, add assertions such as:
    #   * extraction.match_context.team_a.value matches the real team name
    #   * len(extraction.innings[0].batting) equals the number of batters listed
    #   * a known batter's runs/balls match the printed figures
    #   * illegible/cropped fields come back as value=None with a data_quality_flag
    #     (verify the model FLAGS rather than guesses on a deliberately blurry image)
    #   * every extracted value carries a confidence in {high, medium, low}
    # Check for presence of the expected signal, not exact strings.
    assert extraction is not None  # placeholder until real assertions are added


# Keep base64 import referenced for when you add an inline-image variant test.
_ = base64
