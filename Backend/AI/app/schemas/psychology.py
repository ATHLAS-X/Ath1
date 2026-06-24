"""Psychological Assessment schemas.

Request reconciliation (see RECONCILIATION_NOTES.md): Engineering Doc 4.7's example
body shows *pre-aggregated* 7 subscale scores, but the 4.4 pre-processing logic — and
the Tier-1 tests — require the *raw 28 item responses* (to reverse-score items 27/28
and detect the uniformly-positive pattern). We therefore accept the raw items
(``acsi_responses``: item number 1-28 -> 1-4) and aggregate server-side. The lie-scale
responses remain a separate 5-int array per 4.7.

Output models implement the JSON schema from Engineering Doc Section 4.6.
"""

from __future__ import annotations

import enum
from datetime import datetime

from pydantic import BaseModel, Field, field_validator

from app.constants.question_bank import RESPONSE_SCALE


# ── Enums ────────────────────────────────────────────────────────────────────
class Interpretation(str, enum.Enum):
    low = "low"
    moderate = "moderate"
    high = "high"


class SocialDesirabilityRisk(str, enum.Enum):
    high = "high"
    medium = "medium"
    low = "low"


class CoachabilitySignal(str, enum.Enum):
    strong = "strong"
    moderate = "moderate"
    weak = "weak"


class Confidence(str, enum.Enum):
    high = "high"
    medium = "medium"
    low = "low"


_VALID_RESPONSES = set(RESPONSE_SCALE.keys())  # {1,2,3,4}


# ── Request (Engineering Doc 4.7, raw-items reconciliation) ──────────────────
class ScenarioResponse(BaseModel):
    selected: str = Field(..., description='One of "A","B","C","D", or "Other".')
    other_text: str = ""

    @field_validator("selected")
    @classmethod
    def _valid_selection(cls, v: str) -> str:
        allowed = {"A", "B", "C", "D", "Other"}
        if v not in allowed:
            raise ValueError(f"selected must be one of {sorted(allowed)}")
        return v


class PlayerContext(BaseModel):
    age: int = Field(..., ge=0)
    primary_role: str
    years_playing: int | None = Field(None, ge=0)
    competition_level: str | None = None
    state: str | None = None


class PsychAnalyzeRequest(BaseModel):
    player_id: str = Field(..., examples=["player_12345"])
    # Raw ACSI-28 item responses: item number (1-28) -> Likert value (1-4).
    acsi_responses: dict[int, int]
    # scenario_1 .. scenario_10
    scenario_responses: dict[str, ScenarioResponse]
    # q1 .. q5
    open_ended_responses: dict[str, str]
    # Lie scale L1-L5, in order, each 1-4.
    lie_scale_responses: list[int] = Field(..., min_length=5, max_length=5)
    player_context: PlayerContext
    completion_time_minutes: float = Field(..., ge=1)

    @field_validator("acsi_responses")
    @classmethod
    def _validate_items(cls, v: dict[int, int]) -> dict[int, int]:
        expected = set(range(1, 29))
        if set(v.keys()) != expected:
            missing = sorted(expected - set(v.keys()))
            extra = sorted(set(v.keys()) - expected)
            raise ValueError(f"acsi_responses must cover items 1-28 (missing={missing}, extra={extra})")
        bad = {k: val for k, val in v.items() if val not in _VALID_RESPONSES}
        if bad:
            raise ValueError(f"ACSI responses must be in 1-4; invalid: {bad}")
        return v

    @field_validator("lie_scale_responses")
    @classmethod
    def _validate_lie(cls, v: list[int]) -> list[int]:
        bad = [x for x in v if x not in _VALID_RESPONSES]
        if bad:
            raise ValueError(f"lie_scale_responses must be in 1-4; invalid: {bad}")
        return v


# ── Output (Engineering Doc Section 4.6) ─────────────────────────────────────
class SubscaleScore(BaseModel):
    raw_score: int
    max_possible: int
    interpretation: Interpretation


class ResponseQualityFlags(BaseModel):
    social_desirability_risk: SocialDesirabilityRisk
    lie_scale_triggered: bool
    open_ended_vagueness_flag: bool
    response_inconsistency_flag: bool = False


class ScoutSummary(BaseModel):
    overall_mental_performance_level: int = Field(..., ge=1, le=5)
    key_strengths: list[str]
    pressure_indicators: list[str] = Field(default_factory=list)
    coachability_signal: CoachabilitySignal
    recommendation: str
    confidence: Confidence


class PlayerDevelopmentSummary(BaseModel):
    strengths: list[str]
    development_areas: list[str]
    suggested_focus: list[str]


class SubmissionMetadata(BaseModel):
    player_id: str
    completion_time_minutes: float = Field(..., ge=1)
    timestamp: datetime


class PsychAnalysisResult(BaseModel):
    """Full Gemini psych profile JSON (Engineering Doc 4.6)."""

    submission_metadata: SubmissionMetadata
    acsi_subscale_scores: dict[str, SubscaleScore]
    response_quality_flags: ResponseQualityFlags
    scout_summary: ScoutSummary
    player_development_summary: PlayerDevelopmentSummary
    mandatory_caveats: list[str] = Field(..., min_length=5)
    raw_gemini_narrative: str
