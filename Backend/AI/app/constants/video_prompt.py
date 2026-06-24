"""Video Analysis system prompt — Engineering Doc Section 3.4, VERBATIM.

The prompt text lives in ``video_prompt.txt`` and is loaded unmodified at import.

IMPORTANT: the source document stored this prompt as a single flowed paragraph, so
the original markdown line breaks were not preserved in the .docx. The text is
reproduced **character-for-character** from the document (no paraphrasing,
shortening, or rewriting, per the build instruction). Do not edit the .txt.
"""

from __future__ import annotations

from pathlib import Path

_PROMPT_PATH = Path(__file__).with_name("video_prompt.txt")

VIDEO_ANALYSIS_SYSTEM_PROMPT: str = _PROMPT_PATH.read_text(encoding="utf-8")
