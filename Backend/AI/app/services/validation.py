"""Submission validation.

  * Video: YouTube URL format (Engineering Doc 3.2) + oEmbed accessibility check.
  * OCR: image source validation for base64 (magic-byte + size cap) and URL
    (reachability + image content-type).

HTTP calls go through small indirection functions (``_oembed_status`` /
``_fetch_image_url``) so the Tier-2 tests can monkeypatch them without real network.
"""

from __future__ import annotations

import base64
import binascii
import re

import httpx

from app.core.config import get_settings
from app.core.errors import AppError, invalid_request
from app.schemas.common import ErrorCode

# ── YouTube URL validation ───────────────────────────────────────────────────
# Accepts watch?v=, youtu.be/, /shorts/, /embed/ forms.
_YOUTUBE_RE = re.compile(
    r"^(?:https?://)?(?:www\.|m\.)?"
    r"(?:youtube\.com/(?:watch\?(?:.*&)?v=|shorts/|embed/|v/)|youtu\.be/)"
    r"(?P<id>[A-Za-z0-9_-]{11})"
    r"(?:[?&#].*)?$"
)


def is_valid_youtube_url(url: str) -> bool:
    return bool(_YOUTUBE_RE.match(url.strip()))


def extract_video_id(url: str) -> str | None:
    m = _YOUTUBE_RE.match(url.strip())
    return m.group("id") if m else None


async def _oembed_status(url: str) -> int:
    """Return the HTTP status of YouTube's oEmbed endpoint for ``url``."""
    oembed = "https://www.youtube.com/oembed"
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(oembed, params={"url": url, "format": "json"})
        return resp.status_code


async def check_youtube_accessible(url: str) -> bool:
    """Public/accessible if the oEmbed endpoint returns 200 (Engineering Doc 3.2)."""
    try:
        status = await _oembed_status(url)
    except httpx.HTTPError:
        return False
    return status == 200


async def validate_youtube_clip(url: str) -> None:
    """Raise AppError on bad format / inaccessible video; otherwise return None."""
    if not is_valid_youtube_url(url):
        raise invalid_request(
            f"Invalid YouTube URL: {url}", error_code=ErrorCode.INVALID_YOUTUBE_URL
        )
    if not await check_youtube_accessible(url):
        raise AppError(
            ErrorCode.VIDEO_NOT_ACCESSIBLE,
            f"YouTube video is private, unlisted, deleted, or unreachable: {url}",
            status_code=400,
        )


# ── OCR image validation ─────────────────────────────────────────────────────
_PNG_MAGIC = b"\x89PNG\r\n\x1a\n"
_JPG_MAGIC = b"\xff\xd8\xff"


def detect_image_mime(data: bytes) -> str | None:
    """Return 'image/png' / 'image/jpeg' from magic bytes, or None if unsupported."""
    if data.startswith(_PNG_MAGIC):
        return "image/png"
    if data.startswith(_JPG_MAGIC):
        return "image/jpeg"
    return None


def validate_image_bytes(data: bytes) -> str:
    """Validate decoded image bytes (type + size cap). Returns the mime type."""
    cap = get_settings().ocr_max_image_bytes
    if len(data) > cap:
        raise AppError(
            ErrorCode.INVALID_IMAGE,
            f"Image exceeds the {cap // (1024 * 1024)} MB size limit.",
            status_code=400,
        )
    mime = detect_image_mime(data)
    if mime is None:
        raise AppError(
            ErrorCode.INVALID_IMAGE,
            "Unsupported image format. Only JPG and PNG are accepted.",
            status_code=400,
        )
    return mime


def decode_base64_image(b64: str) -> tuple[bytes, str]:
    """Decode a base64 image string and validate it. Returns (bytes, mime)."""
    # Strip a possible data-URL prefix.
    if b64.startswith("data:") and "," in b64:
        b64 = b64.split(",", 1)[1]
    try:
        data = base64.b64decode(b64, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise AppError(
            ErrorCode.INVALID_IMAGE, "image_base64 is not valid base64.", status_code=400
        ) from exc
    if not data:
        raise AppError(ErrorCode.INVALID_IMAGE, "image_base64 decoded to empty bytes.", status_code=400)
    mime = validate_image_bytes(data)
    return data, mime


async def _fetch_image_url(url: str) -> httpx.Response:
    async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
        return await client.get(url)


async def fetch_image_from_url(url: str) -> tuple[bytes, str]:
    """Fetch an image URL and validate it. Returns (bytes, mime)."""
    try:
        resp = await _fetch_image_url(url)
    except httpx.HTTPError as exc:
        raise AppError(
            ErrorCode.IMAGE_NOT_ACCESSIBLE, f"Could not fetch image URL: {url}", status_code=400
        ) from exc
    if resp.status_code != 200:
        raise AppError(
            ErrorCode.IMAGE_NOT_ACCESSIBLE,
            f"Image URL returned status {resp.status_code}: {url}",
            status_code=400,
        )
    data = resp.content
    mime = validate_image_bytes(data)
    return data, mime
