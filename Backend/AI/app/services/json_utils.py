"""Helpers for parsing model JSON output defensively.

The prompts instruct Gemini to return raw JSON, but models occasionally wrap output
in ``` fences. ``extract_json`` strips those and parses.
"""

from __future__ import annotations

import json
import re
from typing import Any

_FENCE_RE = re.compile(r"^```(?:json)?\s*|\s*```$", re.IGNORECASE)


class JsonParseError(ValueError):
    pass


def extract_json(text: str) -> dict[str, Any]:
    if text is None:
        raise JsonParseError("Empty model output")
    cleaned = text.strip()
    cleaned = _FENCE_RE.sub("", cleaned).strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        # Fall back to the first {...} block if there is surrounding prose.
        start = cleaned.find("{")
        end = cleaned.rfind("}")
        if start != -1 and end != -1 and end > start:
            try:
                return json.loads(cleaned[start : end + 1])
            except json.JSONDecodeError as exc:
                raise JsonParseError(f"Could not parse JSON: {exc}") from exc
        raise JsonParseError("Model output is not valid JSON")
