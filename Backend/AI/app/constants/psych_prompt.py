"""Psychological Analysis system prompt — Engineering Doc Section 4.5, VERBATIM.

The prompt text lives in ``psych_prompt.txt`` and is loaded unmodified at import.

IMPORTANT: the source document stored this prompt as a single flowed paragraph, so
the original markdown line breaks were not preserved in the .docx. The text is
reproduced **character-for-character** from the document (no paraphrasing,
shortening, or rewriting, per the build instruction). Do not edit the .txt.
"""

from __future__ import annotations

from pathlib import Path

_PROMPT_PATH = Path(__file__).with_name("psych_prompt.txt")

PSYCH_ANALYSIS_SYSTEM_PROMPT: str = _PROMPT_PATH.read_text(encoding="utf-8")
