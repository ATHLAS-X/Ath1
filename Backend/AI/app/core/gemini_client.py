"""Shared Gemini client wrapper.

Adapted from Engineering Doc Section 5.2 with these reconciliation changes:

  * Model names are CONFIGURABLE via settings (``GEMINI_VIDEO_MODEL`` /
    ``GEMINI_TEXT_MODEL`` / ``GEMINI_OCR_MODEL``) — never hardcoded.
  * Async-NATIVE: the installed ``google-genai`` exposes ``client.aio.models.*``,
    so we await it directly instead of wrapping a sync call in ``run_in_executor``.
    (Fallback note: on SDK builds lacking ``.aio``, wrap the sync
    ``client.models.generate_content`` in ``loop.run_in_executor`` instead.)
  * Error categorization includes a distinct ``MODEL_DEPRECATED`` case.

⚠️  PREVIEW MODEL WARNING: ``GEMINI_VIDEO_MODEL`` defaults to
``gemini-3.1-pro-preview`` — a PREVIEW model with more restrictive rate limits that
can be deprecated with as little as ~2 weeks' notice. A model-deprecation/not-found
error is mapped to ``MODEL_DEPRECATED`` (not a generic failure) so a retirement is
loggable and easy to spot. Re-verify the model string against
https://ai.google.dev/gemini-api/docs/models before production.
"""

from __future__ import annotations

import asyncio
from typing import Any

from google import genai
from google.genai import types
from tenacity import (
    retry,
    retry_if_exception,
    stop_after_attempt,
    wait_exponential,
)

from app.core.config import get_settings
from app.core.logging import get_logger

logger = get_logger(__name__)

# Non-retryable categories — retrying these wastes quota and never succeeds.
_NON_RETRYABLE = {"CONTENT_POLICY", "INVALID_REQUEST", "MODEL_DEPRECATED"}


# Maps internal Gemini error categories to the canonical task error codes the API
# surfaces (Engineering Doc 5.4): a TIMEOUT during a job becomes GEMINI_TIMEOUT, etc.
GEMINI_ERROR_TO_TASK_CODE = {
    "TIMEOUT": "GEMINI_TIMEOUT",
    "RATE_LIMIT": "GEMINI_RATE_LIMIT",
    "CONTENT_POLICY": "CONTENT_POLICY",
    "INVALID_REQUEST": "INVALID_REQUEST",
    "MODEL_DEPRECATED": "MODEL_DEPRECATED",
    "UNKNOWN": "UNKNOWN",
}


def map_gemini_error(error_code: str) -> str:
    return GEMINI_ERROR_TO_TASK_CODE.get(error_code, "UNKNOWN")


def categorize_error(error_message: str) -> str:
    """Map a raw Gemini error string to a canonical error_code."""
    e = error_message.lower()
    if any(k in e for k in ("deprecat", "not found", "is not supported", "unknown model", "404")):
        # Preview model retirement / wrong model id -> distinct, loggable case.
        return "MODEL_DEPRECATED"
    if "rate limit" in e or "quota" in e or "resource_exhausted" in e or "429" in e:
        return "RATE_LIMIT"
    if "content" in e and ("policy" in e or "safety" in e or "blocked" in e):
        return "CONTENT_POLICY"
    if "invalid" in e or "bad request" in e or "400" in e:
        return "INVALID_REQUEST"
    if "timeout" in e or "deadline" in e:
        return "TIMEOUT"
    return "UNKNOWN"


def _is_retryable(exc: BaseException) -> bool:
    if isinstance(exc, asyncio.TimeoutError):
        return True
    return categorize_error(str(exc)) not in _NON_RETRYABLE


class GeminiError(Exception):
    """Carries a categorized error_code alongside the message."""

    def __init__(self, error_code: str, message: str):
        self.error_code = error_code
        self.message = message
        super().__init__(f"{error_code}: {message}")


class GeminiClient:
    def __init__(self) -> None:
        settings = get_settings()
        self._client = genai.Client(api_key=settings.gemini_api_key)
        self.video_model = settings.gemini_video_model
        self.text_model = settings.gemini_text_model
        self.ocr_model = settings.gemini_ocr_model

    # ── public API ───────────────────────────────────────────────────────────
    async def analyze_video(
        self,
        youtube_urls: list[str],
        system_prompt: str,
        user_prompt: str,
        timeout: int | None = None,
    ) -> dict[str, Any]:
        """Analyze one or more YouTube clips. Returns {"status","content"} or an error dict."""
        timeout = timeout or get_settings().gemini_video_timeout_seconds
        parts: list[types.Part] = [
            types.Part(file_data=types.FileData(file_uri=url)) for url in youtube_urls
        ]
        parts.append(types.Part(text=user_prompt))
        contents = types.Content(parts=parts)
        config = types.GenerateContentConfig(
            temperature=0.2,
            max_output_tokens=8192,
            system_instruction=system_prompt,
        )
        return await self._run(self.video_model, contents, config, timeout)

    async def analyze_text(
        self,
        system_prompt: str,
        user_prompt: str,
        timeout: int | None = None,
    ) -> dict[str, Any]:
        timeout = timeout or get_settings().gemini_text_timeout_seconds
        config = types.GenerateContentConfig(
            temperature=0.3,
            max_output_tokens=4096,
            system_instruction=system_prompt,
        )
        return await self._run(self.text_model, user_prompt, config, timeout)

    async def analyze_image(
        self,
        image_bytes: bytes,
        mime_type: str,
        system_prompt: str,
        user_prompt: str,
        timeout: int | None = None,
    ) -> dict[str, Any]:
        timeout = timeout or get_settings().gemini_ocr_timeout_seconds
        contents = types.Content(
            parts=[
                types.Part.from_bytes(data=image_bytes, mime_type=mime_type),
                types.Part(text=user_prompt),
            ]
        )
        config = types.GenerateContentConfig(
            temperature=0.0,
            max_output_tokens=4096,
            system_instruction=system_prompt,
        )
        return await self._run(self.ocr_model, contents, config, timeout)

    async def check_reachable(self, timeout: int = 5) -> bool:
        """Lightweight reachability probe for the health endpoint (no generation cost)."""
        if not self._client._api_client.api_key:  # type: ignore[attr-defined]
            return False
        try:
            async def _list() -> bool:
                async for _ in await self._client.aio.models.list():
                    return True
                return True
            return await asyncio.wait_for(_list(), timeout=timeout)
        except Exception as exc:  # noqa: BLE001
            logger.warning("gemini reachability check failed", extra={"data": {"error": str(exc)}})
            return False

    # ── internals ──────────────────────────────────────────────────────────
    async def _run(self, model: str, contents: Any, config: Any, timeout: int) -> dict[str, Any]:
        try:
            text = await self._generate_with_retry(model, contents, config, timeout)
            return {"status": "success", "content": text}
        except GeminiError as ge:
            if ge.error_code == "MODEL_DEPRECATED":
                logger.error(
                    "Gemini model appears deprecated/unavailable — re-check the model id",
                    extra={"data": {"model": model, "error_code": ge.error_code}},
                )
            return {"status": "error", "error_code": ge.error_code, "message": ge.message}

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=8),
        retry=retry_if_exception(_is_retryable),
        reraise=True,
    )
    async def _generate_with_retry(self, model: str, contents: Any, config: Any, timeout: int) -> str:
        try:
            response = await asyncio.wait_for(
                self._client.aio.models.generate_content(
                    model=model, contents=contents, config=config
                ),
                timeout=timeout,
            )
        except asyncio.TimeoutError:
            raise GeminiError("TIMEOUT", f"Gemini call timed out after {timeout}s") from None
        except GeminiError:
            raise
        except Exception as exc:  # noqa: BLE001
            raise GeminiError(categorize_error(str(exc)), str(exc)) from exc
        return response.text or ""


_client: GeminiClient | None = None


def get_gemini_client() -> GeminiClient:
    global _client
    if _client is None:
        _client = GeminiClient()
    return _client
