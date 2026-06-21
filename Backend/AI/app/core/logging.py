"""Structured-ish logging with PII redaction.

The architecture doc requires PII scrubbing before anything reaches log output
(and, later, Sentry). This service handles three categories of sensitive data we
must never emit verbatim:

  * Player open-ended psychology responses (free-text narratives).
  * Phone numbers / Aadhaar-adjacent identifiers.
  * Base64 image payloads / long Gemini raw narratives.

We deliberately avoid a heavy structured-logging dependency: a stdlib
``logging.Filter`` applies regex-based redaction to every record, and helpers
emit JSON lines. ``scrub()`` is also exported for call sites that build their own
log dicts.
"""

from __future__ import annotations

import json
import logging
import re
import sys
from typing import Any

# Field names whose values must always be dropped/masked when logged as a dict.
_SENSITIVE_KEYS = {
    "open_ended_responses",
    "open_ended",
    "raw_gemini_narrative",
    "narrative",
    "phone",
    "parent_phone",
    "aadhaar",
    "image_base64",
    "image_bytes",
    "context_notes",
    "other_text",
    "authorization",
    "token",
    "password",
}

_PHONE_RE = re.compile(r"\b(?:\+?91[\-\s]?)?[6-9]\d{9}\b")
_AADHAAR_RE = re.compile(r"\b\d{4}\s?\d{4}\s?\d{4}\b")
# Long base64-ish blobs (image payloads, etc.)
_B64_BLOB_RE = re.compile(r"[A-Za-z0-9+/=]{120,}")

_REDACTED = "[REDACTED]"


def _redact_text(text: str) -> str:
    text = _PHONE_RE.sub("[REDACTED_PHONE]", text)
    text = _AADHAAR_RE.sub("[REDACTED_ID]", text)
    text = _B64_BLOB_RE.sub("[REDACTED_BLOB]", text)
    return text


def scrub(value: Any) -> Any:
    """Recursively redact sensitive keys and patterns from a value tree."""
    if isinstance(value, dict):
        out: dict[Any, Any] = {}
        for k, v in value.items():
            if isinstance(k, str) and k.lower() in _SENSITIVE_KEYS:
                out[k] = _REDACTED
            else:
                out[k] = scrub(v)
        return out
    if isinstance(value, (list, tuple)):
        return [scrub(v) for v in value]
    if isinstance(value, str):
        return _redact_text(value)
    return value


class RedactionFilter(logging.Filter):
    """Scrubs the formatted message and any structured ``extra`` payload."""

    def filter(self, record: logging.LogRecord) -> bool:  # noqa: A003 - stdlib name
        if isinstance(record.msg, str):
            record.msg = _redact_text(record.msg)
        if record.args:
            if isinstance(record.args, dict):
                record.args = scrub(record.args)
            else:
                record.args = tuple(scrub(a) for a in record.args)
        # Custom structured payload attached via logger.info(..., extra={"data": {...}})
        if hasattr(record, "data"):
            record.data = scrub(record.data)  # type: ignore[attr-defined]
        return True


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        if hasattr(record, "data"):
            payload["data"] = record.data  # type: ignore[attr-defined]
        if record.exc_info:
            payload["exc_info"] = self.formatException(record.exc_info)
        return json.dumps(payload, default=str)


_CONFIGURED = False


def configure_logging(level: int = logging.INFO) -> None:
    global _CONFIGURED
    if _CONFIGURED:
        return
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter())
    handler.addFilter(RedactionFilter())

    root = logging.getLogger()
    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(level)
    _CONFIGURED = True


def get_logger(name: str) -> logging.LoggerAdapter:
    """Return a logger. Pass structured data via ``logger.info(msg, extra={"data": {...}})``."""
    configure_logging()
    return logging.LoggerAdapter(logging.getLogger(name), {})
