"""Submission validation.

  * Video: YouTube URL format (Engineering Doc 3.2) + oEmbed accessibility check.
  * OCR: image source validation for base64 (magic-byte + size cap) and URL
    (reachability + image content-type).

HTTP calls go through small indirection functions (``_oembed_status`` /
``_fetch_image_url``) so the Tier-2 tests can monkeypatch them without real network.
"""

from __future__ import annotations

import asyncio
import base64
import binascii
import ipaddress
import re
import socket
from urllib.parse import urlsplit

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


_ALLOWED_SCHEMES = {"http", "https"}
_MAX_REDIRECTS = 5


def _is_blocked_ip(addr: ipaddress.IPv4Address | ipaddress.IPv6Address) -> bool:
    """True for loopback / private / link-local / multicast / reserved / unspecified
    ranges — covers 10.x, 172.16-31.x, 192.168.x, 127.x, 169.254.x and their IPv6
    equivalents (::1, fc00::/7, fe80::/10, etc.) plus IPv4-mapped IPv6 wrapping any
    of the above."""
    if isinstance(addr, ipaddress.IPv6Address) and addr.ipv4_mapped is not None:
        addr = addr.ipv4_mapped
    return (
        addr.is_loopback
        or addr.is_private
        or addr.is_link_local
        or addr.is_multicast
        or addr.is_reserved
        or addr.is_unspecified
    )


async def _resolve_host(host: str) -> list[str]:
    """Isolated so tests can monkeypatch DNS resolution without real network."""
    try:
        loop = asyncio.get_running_loop()
        addrinfo = await loop.getaddrinfo(host, None)
    except socket.gaierror as exc:
        raise AppError(
            ErrorCode.IMAGE_NOT_ACCESSIBLE, f"Could not resolve host: {host}", status_code=400
        ) from exc
    return [sockaddr[0] for *_rest, sockaddr in addrinfo]


async def _assert_host_is_safe(url: str) -> str:
    """Validate scheme + resolve hostname, rejecting anything that resolves to a
    private/loopback/link-local/reserved address. Returns the hostname for logging.
    Raises AppError on any violation — called again on every redirect hop so a
    public hostname that redirects to an internal IP (DNS rebinding) is still caught."""
    parts = urlsplit(url)
    if parts.scheme not in _ALLOWED_SCHEMES:
        raise AppError(
            ErrorCode.IMAGE_NOT_ACCESSIBLE,
            f"Unsupported URL scheme: {parts.scheme!r}. Only http/https are allowed.",
            status_code=400,
        )
    host = parts.hostname
    if not host:
        raise AppError(ErrorCode.IMAGE_NOT_ACCESSIBLE, "Image URL has no host.", status_code=400)

    for ip_str in await _resolve_host(host):
        if _is_blocked_ip(ipaddress.ip_address(ip_str)):
            raise AppError(
                ErrorCode.IMAGE_NOT_ACCESSIBLE,
                f"Image URL resolves to a disallowed address: {host}",
                status_code=400,
            )
    return host


async def _fetch_image_url(url: str) -> bytes:
    """Stream the response, validating the resolved IP at every redirect hop and
    aborting as soon as the body exceeds the size cap (never buffers an unbounded
    response). Redirects are followed manually — never automatically — so each
    hop is re-validated before the request is made."""
    cap = get_settings().ocr_max_image_bytes
    current_url = url
    timeout = httpx.Timeout(connect=5.0, read=15.0, write=5.0, pool=5.0)

    async with httpx.AsyncClient(timeout=timeout, follow_redirects=False) as client:
        for _ in range(_MAX_REDIRECTS + 1):
            await _assert_host_is_safe(current_url)
            async with client.stream("GET", current_url) as resp:
                if resp.is_redirect:
                    next_url = resp.headers.get("location")
                    if not next_url:
                        raise AppError(
                            ErrorCode.IMAGE_NOT_ACCESSIBLE,
                            f"Image URL returned a redirect with no Location: {current_url}",
                            status_code=400,
                        )
                    current_url = str(resp.url.join(next_url))
                    continue

                if resp.status_code != 200:
                    raise AppError(
                        ErrorCode.IMAGE_NOT_ACCESSIBLE,
                        f"Image URL returned status {resp.status_code}: {current_url}",
                        status_code=400,
                    )

                content_length = resp.headers.get("content-length")
                if content_length is not None and int(content_length) > cap:
                    raise AppError(
                        ErrorCode.INVALID_IMAGE,
                        f"Image exceeds the {cap // (1024 * 1024)} MB size limit.",
                        status_code=400,
                    )

                chunks = bytearray()
                async for chunk in resp.aiter_bytes():
                    chunks += chunk
                    if len(chunks) > cap:
                        raise AppError(
                            ErrorCode.INVALID_IMAGE,
                            f"Image exceeds the {cap // (1024 * 1024)} MB size limit.",
                            status_code=400,
                        )
                return bytes(chunks)

    raise AppError(
        ErrorCode.IMAGE_NOT_ACCESSIBLE,
        f"Too many redirects fetching image URL: {url}",
        status_code=400,
    )


async def fetch_image_from_url(url: str) -> tuple[bytes, str]:
    """Fetch an image URL and validate it. Returns (bytes, mime)."""
    try:
        data = await _fetch_image_url(url)
    except AppError:
        raise
    except httpx.HTTPError as exc:
        raise AppError(
            ErrorCode.IMAGE_NOT_ACCESSIBLE, f"Could not fetch image URL: {url}", status_code=400
        ) from exc
    mime = validate_image_bytes(data)
    return data, mime