"""TIER 1 — pure psychology pre-processing logic (Engineering Doc 4.4).

No Gemini, no DB, no mocking. Runs in CI with no API key.
"""

from __future__ import annotations

from app.constants.question_bank import SUBSCALES
from app.services import preprocessing as pp


def _all(value: int) -> dict[int, int]:
    """Helper: every ACSI item answered with the same value."""
    return {n: value for n in range(1, 29)}


# ── reverse scoring ──────────────────────────────────────────────────────────
def test_reverse_score_mapping():
    assert pp.reverse_score(1) == 4
    assert pp.reverse_score(2) == 3
    assert pp.reverse_score(3) == 2
    assert pp.reverse_score(4) == 1


def test_effective_item_score_reverses_only_27_28():
    assert pp.effective_item_score(1, 4) == 4       # normal
    assert pp.effective_item_score(26, 1) == 1      # normal
    assert pp.effective_item_score(27, 1) == 4      # reversed
    assert pp.effective_item_score(28, 4) == 1      # reversed


# ── subscale aggregation ─────────────────────────────────────────────────────
def test_aggregate_subscales_known_values():
    # All items = 3. Each non-reverse subscale total = 3 * n_items.
    res = pp.aggregate_subscales(_all(3))
    assert res["coping_with_adversity"]["raw_score"] == 18   # 6 items * 3
    assert res["peaking_under_pressure"]["raw_score"] == 12  # 4 items * 3
    # Freedom from worry: items 27,28 each raw 3 -> reversed to 2 -> total 4.
    assert res["freedom_from_worry"]["raw_score"] == 4
    # max_possible matches the band definition.
    for key, band in SUBSCALES.items():
        assert res[key]["max_possible"] == band["max_score"]


def test_aggregate_freedom_from_worry_reverse_applied():
    responses = _all(2)
    # items 27,28 raw=2 -> reversed=3 each -> total 6
    res = pp.aggregate_subscales(responses)
    assert res["freedom_from_worry"]["raw_score"] == 6


def test_total_acsi_score():
    res = pp.total_acsi_score(_all(4))
    # 26 non-reverse items * 4 = 104, plus items 27,28 reversed (4->1) = 2 -> 106
    assert res["raw_score"] == 26 * 4 + 1 + 1
    assert res["max_possible"] == 112


# ── interpretation bands ─────────────────────────────────────────────────────
def test_interpret_subscale_bands():
    assert pp.interpret_subscale("coping_with_adversity", 6) == "low"
    assert pp.interpret_subscale("coping_with_adversity", 12) == "low"
    assert pp.interpret_subscale("coping_with_adversity", 13) == "moderate"
    assert pp.interpret_subscale("coping_with_adversity", 18) == "moderate"
    assert pp.interpret_subscale("coping_with_adversity", 19) == "high"
    assert pp.interpret_subscale("freedom_from_worry", 4) == "low"
    assert pp.interpret_subscale("freedom_from_worry", 6) == "moderate"
    assert pp.interpret_subscale("freedom_from_worry", 8) == "high"


# ── lie scale ────────────────────────────────────────────────────────────────
def test_lie_scale_triggered_two_or_more_almost_always():
    assert pp.detect_lie_scale_triggered([4, 4, 1, 1, 1]) is True
    assert pp.detect_lie_scale_triggered([4, 1, 1, 1, 1]) is False
    assert pp.detect_lie_scale_triggered([4, 4, 4, 4, 4]) is True
    assert pp.detect_lie_scale_triggered([1, 2, 3, 1, 2]) is False


# ── uniformly positive ───────────────────────────────────────────────────────
def test_uniformly_positive_detection():
    assert pp.detect_uniformly_positive(_all(3)) is True
    assert pp.detect_uniformly_positive(_all(4)) is True
    mixed = _all(3)
    mixed[5] = 2  # one item below "Often"
    assert pp.detect_uniformly_positive(mixed) is False


# ── open-ended vagueness (<30 words) ─────────────────────────────────────────
def test_open_ended_vagueness_flag():
    short = {"q1": "I try my best.", "q2": "word " * 40}
    flag, vague = pp.detect_open_ended_vagueness(short)
    assert flag is True
    assert "q1" in vague and "q2" not in vague


def test_open_ended_not_vague_when_all_long():
    long_text = {f"q{i}": "word " * 35 for i in range(1, 6)}
    flag, vague = pp.detect_open_ended_vagueness(long_text)
    assert flag is False
    assert vague == []


# ── response inconsistency (high coachability + scenario 5 C/D) ──────────────
def test_response_inconsistency_triggers():
    responses = _all(2)
    for n in SUBSCALES["coachability"]["item_numbers"]:
        responses[n] = 4  # high coachability (all 4s)
    scenarios = {"scenario_5": {"selected": "D", "other_text": ""}}
    assert pp.detect_response_inconsistency(responses, scenarios) is True


def test_response_inconsistency_not_triggered_when_scenario_a():
    responses = _all(2)
    for n in SUBSCALES["coachability"]["item_numbers"]:
        responses[n] = 4
    scenarios = {"scenario_5": {"selected": "A", "other_text": ""}}
    assert pp.detect_response_inconsistency(responses, scenarios) is False


def test_response_inconsistency_not_triggered_when_low_coachability():
    responses = _all(2)  # coachability not all 4s
    scenarios = {"scenario_5": {"selected": "C", "other_text": ""}}
    assert pp.detect_response_inconsistency(responses, scenarios) is False


# ── bundled flags + gemini input package ─────────────────────────────────────
def test_compute_response_quality_flags_bundle():
    responses = _all(4)
    flags = pp.compute_response_quality_flags(
        responses, [4, 4, 1, 1, 1], {"q1": "short"}, {"scenario_5": {"selected": "A"}}
    )
    assert flags["lie_scale_triggered"] is True
    assert flags["uniformly_positive"] is True
    assert flags["open_ended_superficial"] is True


def test_build_gemini_input_package_shape():
    pkg = pp.build_gemini_input_package(
        player_id="p1",
        acsi_responses=_all(3),
        scenario_responses={"scenario_1": {"selected": "A", "other_text": ""}},
        open_ended_responses={"q1": "word " * 40},
        lie_scale_responses=[1, 1, 1, 1, 1],
        player_context={"age": 19, "primary_role": "Fast Bowler"},
    )
    assert "acsi_subscale_scores" in pkg
    assert "total_acsi_28" in pkg["acsi_subscale_scores"]
    assert pkg["response_quality_flags"]["lie_scale_triggered"] is False
    assert pkg["player_context"]["age"] == 19
