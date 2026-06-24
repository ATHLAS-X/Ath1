"""TIER 2 — video analysis output schema validation (Engineering Doc 3.5)."""

from __future__ import annotations

import copy

import pytest
from pydantic import ValidationError

from app.schemas.video import VideoAnalysisResult
from tests.conftest import VALID_VIDEO_JSON


def test_valid_analysis_parses():
    result = VideoAnalysisResult.model_validate(VALID_VIDEO_JSON)
    assert result.overall_assessment.confidence.value == "medium"
    assert result.technique_observations[0].category.value == "strength"
    assert result.role_specific_scores["head_position"].score == 4


def test_missing_required_field_rejected():
    bad = copy.deepcopy(VALID_VIDEO_JSON)
    del bad["overall_assessment"]
    with pytest.raises(ValidationError):
        VideoAnalysisResult.model_validate(bad)


def test_bad_confidence_enum_rejected():
    bad = copy.deepcopy(VALID_VIDEO_JSON)
    bad["overall_assessment"]["confidence"] = "very-high"
    with pytest.raises(ValidationError):
        VideoAnalysisResult.model_validate(bad)


def test_score_out_of_range_rejected():
    bad = copy.deepcopy(VALID_VIDEO_JSON)
    bad["role_specific_scores"]["head_position"]["score"] = 9
    with pytest.raises(ValidationError):
        VideoAnalysisResult.model_validate(bad)


def test_invalid_data_quality_flag_rejected():
    bad = copy.deepcopy(VALID_VIDEO_JSON)
    bad["data_quality_flags"] = ["not_a_real_flag"]
    with pytest.raises(ValidationError):
        VideoAnalysisResult.model_validate(bad)
