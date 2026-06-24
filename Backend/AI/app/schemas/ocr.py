"""Scorecard OCR schemas — designed for this build (no source schema exists).

Mirrors the structured output defined in ``app/constants/ocr_prompt.py``. Every
extracted value carries a per-field confidence; illegible fields are ``null`` with a
``data_quality_flags`` entry rather than guessed.
"""

from __future__ import annotations

import enum

from pydantic import BaseModel, Field, model_validator


class Confidence(str, enum.Enum):
    high = "high"
    medium = "medium"
    low = "low"


# ── Request (url OR base64; exactly one) ─────────────────────────────────────
class OcrScorecardRequest(BaseModel):
    """POST /api/v1/compute/ocr/scorecard body.

    Provide EXACTLY ONE of ``image_url`` (publicly fetchable jpg/png) or
    ``image_base64`` (base64-encoded jpg/png bytes). No Object Storage is wired up
    in this standalone build, so base64 supports fully-offline testing.
    """

    image_url: str | None = Field(None, examples=["https://example.com/scorecard.jpg"])
    image_base64: str | None = Field(None, description="Base64-encoded jpg/png bytes.")

    @model_validator(mode="after")
    def _exactly_one_source(self) -> "OcrScorecardRequest":
        provided = [bool(self.image_url), bool(self.image_base64)]
        if sum(provided) != 1:
            raise ValueError("Provide exactly one of image_url or image_base64.")
        return self


# ── Output (per-field {value, confidence}) ───────────────────────────────────
class StringField(BaseModel):
    value: str | None = None
    confidence: Confidence


class IntField(BaseModel):
    value: int | None = None
    confidence: Confidence


class NumberField(BaseModel):
    value: float | None = None
    confidence: Confidence


class MatchContext(BaseModel):
    team_a: StringField
    team_b: StringField
    venue: StringField
    match_date: StringField
    format: StringField


class BattingRow(BaseModel):
    player_name: StringField
    runs: IntField
    balls_faced: IntField
    fours: IntField
    sixes: IntField
    dismissal: StringField


class BowlingRow(BaseModel):
    player_name: StringField
    overs: NumberField
    maidens: IntField
    runs_conceded: IntField
    wickets: IntField


class Innings(BaseModel):
    batting_team: StringField
    bowling_team: StringField
    batting: list[BattingRow] = Field(default_factory=list)
    bowling: list[BowlingRow] = Field(default_factory=list)
    extras: IntField | None = None
    total: StringField | None = None


class OcrScorecardResult(BaseModel):
    """Full Gemini OCR extraction (designed schema)."""

    match_context: MatchContext
    innings: list[Innings] = Field(default_factory=list)
    data_quality_flags: list[str] = Field(default_factory=list)
