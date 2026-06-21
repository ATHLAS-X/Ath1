"""Psychology pre-processing — Engineering Doc Section 4.4 (PURE functions).

These operate on the raw submitted data and never call Gemini. They are the
subject of the Tier-1 test suite. Keep them dependency-free and deterministic.
"""

from __future__ import annotations

from typing import Any

from app.constants.question_bank import (
    INCONSISTENCY_SCENARIO_ID,
    INCONSISTENCY_SCENARIO_OPTIONS,
    LIE_SCALE_ALMOST_ALWAYS,
    LIE_SCALE_TRIGGER_THRESHOLD,
    OPEN_ENDED_VAGUENESS_WORD_THRESHOLD,
    REVERSE_SCORED_ITEMS,
    SUBSCALES,
    TOTAL_ACSI_MAX,
    TOTAL_ACSI_MIN,
)


def reverse_score(value: int) -> int:
    """Reverse a 4-point Likert response: 1->4, 2->3, 3->2, 4->1."""
    return 5 - value


def effective_item_score(item_number: int, raw_value: int) -> int:
    """The score used in subscale aggregation (reverse-scored for items 27 & 28)."""
    if item_number in REVERSE_SCORED_ITEMS:
        return reverse_score(raw_value)
    return raw_value


def interpret_subscale(subscale_key: str, raw_score: int) -> str:
    """Map a subscale total to low/moderate/high using the Section 4.5 bands."""
    band = SUBSCALES[subscale_key]
    if raw_score <= band["low_max"]:
        return "low"
    if raw_score <= band["moderate_max"]:
        return "moderate"
    return "high"


def aggregate_subscales(acsi_responses: dict[int, int]) -> dict[str, dict[str, Any]]:
    """Compute the 7 subscale totals (with reverse scoring) + interpretation.

    Returns a mapping subscale_key -> {raw_score, max_possible, interpretation}.
    """
    out: dict[str, dict[str, Any]] = {}
    for key, band in SUBSCALES.items():
        total = sum(effective_item_score(n, acsi_responses[n]) for n in band["item_numbers"])
        out[key] = {
            "raw_score": total,
            "max_possible": band["max_score"],
            "interpretation": interpret_subscale(key, total),
        }
    return out


def total_acsi_score(acsi_responses: dict[int, int]) -> dict[str, int]:
    """The overall ACSI-28 total (sum of all subscales, with reverse scoring)."""
    total = sum(effective_item_score(n, v) for n, v in acsi_responses.items())
    return {"raw_score": total, "max_possible": TOTAL_ACSI_MAX, "min_possible": TOTAL_ACSI_MIN}


def detect_lie_scale_triggered(lie_scale_responses: list[int]) -> bool:
    """True if "Almost Always" (4) is endorsed on >= 2 of L1-L5 (Section 4.4)."""
    count = sum(1 for v in lie_scale_responses if v == LIE_SCALE_ALMOST_ALWAYS)
    return count >= LIE_SCALE_TRIGGER_THRESHOLD


def detect_uniformly_positive(acsi_responses: dict[int, int]) -> bool:
    """True if all 28 ACSI items are scored 3 or 4 (no item below "Sometimes").

    Uses RAW submitted values (the response *pattern*), not reverse-scored values.
    """
    return all(v >= 3 for v in acsi_responses.values())


def _word_count(text: str) -> int:
    return len(text.split())


def detect_open_ended_vagueness(open_ended_responses: dict[str, str]) -> tuple[bool, list[str]]:
    """Flag open-ended responses under 30 words as potentially superficial.

    Returns (flag, vague_question_ids). The flag is True if ANY response is short.
    """
    vague = [qid for qid, text in open_ended_responses.items()
             if _word_count(text or "") < OPEN_ENDED_VAGUENESS_WORD_THRESHOLD]
    return (len(vague) > 0, vague)


def detect_response_inconsistency(
    acsi_responses: dict[int, int],
    scenario_responses: dict[str, Any],
) -> bool:
    """High Coachability (all 4 coachability items == 4) + Scenario 5 option C/D.

    ``scenario_responses`` values may be Pydantic ScenarioResponse objects or dicts.
    """
    coachability_items = SUBSCALES["coachability"]["item_numbers"]
    high_coachability = all(acsi_responses[n] == 4 for n in coachability_items)
    if not high_coachability:
        return False
    scenario = scenario_responses.get(INCONSISTENCY_SCENARIO_ID)
    if scenario is None:
        return False
    selected = getattr(scenario, "selected", None)
    if selected is None and isinstance(scenario, dict):
        selected = scenario.get("selected")
    return selected in INCONSISTENCY_SCENARIO_OPTIONS


def compute_response_quality_flags(
    acsi_responses: dict[int, int],
    lie_scale_responses: list[int],
    open_ended_responses: dict[str, str],
    scenario_responses: dict[str, Any],
) -> dict[str, Any]:
    """Bundle the deterministic flags computed before the Gemini call (Section 4.4)."""
    vagueness_flag, vague_ids = detect_open_ended_vagueness(open_ended_responses)
    return {
        "lie_scale_triggered": detect_lie_scale_triggered(lie_scale_responses),
        "uniformly_positive": detect_uniformly_positive(acsi_responses),
        "open_ended_superficial": vagueness_flag,
        "open_ended_vague_question_ids": vague_ids,
        "response_inconsistency": detect_response_inconsistency(acsi_responses, scenario_responses),
    }


def build_gemini_input_package(
    *,
    player_id: str,
    acsi_responses: dict[int, int],
    scenario_responses: dict[str, Any],
    open_ended_responses: dict[str, str],
    lie_scale_responses: list[int],
    player_context: dict[str, Any],
) -> dict[str, Any]:
    """Assemble the Gemini input package described in Engineering Doc 4.4."""
    subscales = aggregate_subscales(acsi_responses)
    total = total_acsi_score(acsi_responses)
    flags = compute_response_quality_flags(
        acsi_responses, lie_scale_responses, open_ended_responses, scenario_responses
    )

    def _scenario_to_dict(s: Any) -> dict[str, Any]:
        if isinstance(s, dict):
            return {"selected": s.get("selected"), "other_text": s.get("other_text", "")}
        return {"selected": getattr(s, "selected", None), "other_text": getattr(s, "other_text", "")}

    acsi_block = {
        k: {"raw_score": v["raw_score"], "max_possible": v["max_possible"],
            "interpretation": v["interpretation"]}
        for k, v in subscales.items()
    }
    acsi_block["total_acsi_28"] = {
        "raw_score": total["raw_score"], "max_possible": total["max_possible"]
    }

    return {
        "acsi_subscale_scores": acsi_block,
        "scenario_responses": {k: _scenario_to_dict(v) for k, v in scenario_responses.items()},
        "open_ended_responses": dict(open_ended_responses),
        "response_quality_flags": {
            "lie_scale_triggered": flags["lie_scale_triggered"],
            "uniformly_positive": flags["uniformly_positive"],
            "open_ended_superficial": flags["open_ended_superficial"],
            "response_inconsistency": flags["response_inconsistency"],
        },
        "player_context": player_context,
    }
