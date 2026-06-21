"""Video Analysis schemas.

Request shape merges Engineering Doc 3.6 (per-clip fields) with Architecture Doc
14.2 (multiple angle-tagged clips) — see RECONCILIATION_NOTES.md. The analysis
output models implement the JSON schema from Engineering Doc Section 3.5 verbatim.
"""

from __future__ import annotations

import enum
from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, Field, StringConstraints


# ── Enums ────────────────────────────────────────────────────────────────────
class Confidence(str, enum.Enum):
    high = "high"
    medium = "medium"
    low = "low"


class ObservationCategory(str, enum.Enum):
    strength = "strength"
    development_area = "development_area"
    injury_risk_flag = "injury_risk_flag"


class Priority(str, enum.Enum):
    high = "high"
    medium = "medium"
    low = "low"


class PlayerRole(str, enum.Enum):
    """Analysis roles per Engineering Doc 3.2 (drives the prompt's framework branch).

    NB: differs from Prisma's PrimaryRole (BATTER/BOWLER/ALL_ROUNDER/WICKETKEEPER);
    mapping is an integration concern (see RECONCILIATION_NOTES.md).
    """

    batsman = "Batsman"
    fast_bowler = "Fast Bowler"
    spin_bowler = "Spin Bowler"
    wicketkeeper = "Wicketkeeper"
    all_rounder = "All-rounder"


class ClipType(str, enum.Enum):
    """9 clip types (Engineering Doc 3.2 states "enum of 9" without listing them;
    these are derived from the camera-angle guidance in the 3.4 system prompt)."""

    batting_front_on = "Batting – front-on"
    batting_side_on = "Batting – side-on"
    bowling_front_on = "Bowling – front-on"
    bowling_side_on = "Bowling – side-on"
    bowling_umpire_view = "Bowling – umpire view"
    bowling_rear_view = "Bowling – rear view"
    keeping_behind_stumps = "Wicketkeeping – behind stumps"
    fielding = "Fielding"
    match_footage = "Match footage"


class GroundType(str, enum.Enum):
    turf = "Turf"
    matting = "Matting"
    synthetic = "Synthetic"
    unknown = "Unknown"


class DataQualityFlag(str, enum.Enum):
    angle_not_optimal = "angle_not_optimal"
    video_too_short = "video_too_short"
    lighting_poor = "lighting_poor"
    resolution_low = "resolution_low"
    obstructed_view = "obstructed_view"
    single_angle_only = "single_angle_only"


# ── Request ──────────────────────────────────────────────────────────────────
class VideoClip(BaseModel):
    youtube_url: str = Field(..., examples=["https://www.youtube.com/watch?v=AbCdEfGhIjK"])
    clip_type: ClipType


class VideoAnalyzeRequest(BaseModel):
    """POST /api/v1/compute/video/analyze body.

    A submission carries 1..N clips (the configurable cap, default 2, is enforced
    in the service so it can return the standard error envelope). A single clip is
    accepted and later tagged with the ``single_angle_only`` data-quality flag —
    it is never rejected (Engineering Doc 3.2 soft-flag rule).
    """

    player_id: str = Field(..., examples=["player_12345"])
    player_role: PlayerRole
    clips: list[VideoClip] = Field(..., min_length=1)
    context_notes: Annotated[str, StringConstraints(max_length=200)] = ""
    opposition_quality: Annotated[str, StringConstraints(max_length=100)] | None = None
    ground_type: GroundType | None = None


# ── Output (Engineering Doc Section 3.5) ─────────────────────────────────────
class ClipMetadata(BaseModel):
    analysis_timestamp: datetime
    clip_type: str
    player_role: str
    confidence: Confidence


class OverallAssessment(BaseModel):
    summary: Annotated[str, StringConstraints(max_length=500)]
    confidence: Confidence


class TechniqueObservation(BaseModel):
    marker: str
    observation: Annotated[str, StringConstraints(max_length=500)]
    confidence: Confidence
    category: ObservationCategory
    evidence: Annotated[str, StringConstraints(max_length=300)]


class RoleScore(BaseModel):
    score: int = Field(..., ge=1, le=5)
    justification: Annotated[str, StringConstraints(max_length=300)]


class Recommendation(BaseModel):
    priority: Priority
    description: Annotated[str, StringConstraints(max_length=300)]
    drill_suggestion: Annotated[str, StringConstraints(max_length=300)]


class VideoAnalysisResult(BaseModel):
    """Full Gemini analysis JSON (Engineering Doc 3.5). Used to validate model output."""

    clip_metadata: ClipMetadata
    overall_assessment: OverallAssessment
    technique_observations: list[TechniqueObservation]
    role_specific_scores: dict[str, RoleScore]
    recommendations: list[Recommendation]
    analysis_caveats: list[str]
    data_quality_flags: list[DataQualityFlag]
