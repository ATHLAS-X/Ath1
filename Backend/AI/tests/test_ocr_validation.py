"""TIER 1/2 — OCR image validation logic (pure; no Gemini, no network)."""

from __future__ import annotations

import base64

import pytest

from app.core.errors import AppError
from app.schemas.common import ErrorCode
from app.services import validation as v
from tests.conftest import TINY_PNG_BASE64

_PNG = base64.b64decode(TINY_PNG_BASE64)
_JPG = b"\xff\xd8\xff\xe0" + b"\x00" * 32  # minimal JPEG magic + filler


def test_detect_image_mime():
    assert v.detect_image_mime(_PNG) == "image/png"
    assert v.detect_image_mime(_JPG) == "image/jpeg"
    assert v.detect_image_mime(b"not an image") is None


def test_validate_image_bytes_accepts_png_jpg():
    assert v.validate_image_bytes(_PNG) == "image/png"
    assert v.validate_image_bytes(_JPG) == "image/jpeg"


def test_validate_image_bytes_rejects_unknown():
    with pytest.raises(AppError) as ei:
        v.validate_image_bytes(b"%PDF-1.4 fake pdf")
    assert ei.value.error_code == "INVALID_IMAGE"


def test_validate_image_bytes_rejects_oversized(monkeypatch):
    from app.core.config import get_settings

    settings = get_settings()
    monkeypatch.setattr(settings, "ocr_max_image_bytes", 4)
    with pytest.raises(AppError) as ei:
        v.validate_image_bytes(_PNG)  # larger than 4 bytes
    assert ei.value.error_code == "INVALID_IMAGE"


def test_decode_base64_image_ok():
    data, mime = v.decode_base64_image(TINY_PNG_BASE64)
    assert mime == "image/png"
    assert data.startswith(b"\x89PNG")


def test_decode_base64_image_with_data_url_prefix():
    data, mime = v.decode_base64_image("data:image/png;base64," + TINY_PNG_BASE64)
    assert mime == "image/png"


def test_decode_base64_image_rejects_garbage():
    with pytest.raises(AppError) as ei:
        v.decode_base64_image("@@@not-base64@@@")
    assert ei.value.error_code == "INVALID_IMAGE"


@pytest.mark.asyncio
async def test_fetch_image_from_url_ok(monkeypatch):
    async def fake_fetch(url):
        return _PNG

    monkeypatch.setattr(v, "_fetch_image_url", fake_fetch)
    data, mime = await v.fetch_image_from_url("https://example.com/x.png")
    assert mime == "image/png"


@pytest.mark.asyncio
async def test_fetch_image_from_url_404(monkeypatch):
    async def fake_fetch(url):
        raise AppError(
            ErrorCode.IMAGE_NOT_ACCESSIBLE, "Image URL returned status 404", status_code=400
        )

    monkeypatch.setattr(v, "_fetch_image_url", fake_fetch)
    with pytest.raises(AppError) as ei:
        await v.fetch_image_from_url("https://example.com/missing.png")
    assert ei.value.error_code == "IMAGE_NOT_ACCESSIBLE"


# ── SSRF protections ──────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_assert_host_is_safe_rejects_bad_scheme():
    with pytest.raises(AppError) as ei:
        await v._assert_host_is_safe("ftp://example.com/x.png")
    assert ei.value.error_code == "IMAGE_NOT_ACCESSIBLE"


@pytest.mark.parametrize(
    "ip",
    [
        "127.0.0.1",       # loopback
        "10.0.0.5",        # private
        "172.16.0.5",      # private
        "192.168.1.5",     # private
        "169.254.169.254", # link-local / cloud metadata
        "::1",             # IPv6 loopback
        "fe80::1",         # IPv6 link-local
        "fc00::1",         # IPv6 unique local
    ],
)
@pytest.mark.asyncio
async def test_assert_host_is_safe_rejects_private_ips(monkeypatch, ip):
    async def fake_resolve(host):
        return [ip]

    monkeypatch.setattr(v, "_resolve_host", fake_resolve)
    with pytest.raises(AppError) as ei:
        await v._assert_host_is_safe("https://internal.example.com/x.png")
    assert ei.value.error_code == "IMAGE_NOT_ACCESSIBLE"


@pytest.mark.asyncio
async def test_assert_host_is_safe_allows_public_ip(monkeypatch):
    async def fake_resolve(host):
        return ["93.184.216.34"]  # example.com — public

    monkeypatch.setattr(v, "_resolve_host", fake_resolve)
    host = await v._assert_host_is_safe("https://example.com/x.png")
    assert host == "example.com"


@pytest.mark.asyncio
async def test_fetch_image_from_url_rejects_oversize(monkeypatch):
    """A response whose declared Content-Length exceeds the cap must be rejected
    before the body is read."""
    monkeypatch.setattr(v, "_assert_host_is_safe", lambda url: _noop())

    class FakeStreamResp:
        is_redirect = False
        status_code = 200
        headers = {"content-length": str(50 * 1024 * 1024)}  # 50 MB > 10 MB cap

        async def aiter_bytes(self):
            if False:
                yield b""

    class FakeStreamCtx:
        async def __aenter__(self):
            return FakeStreamResp()

        async def __aexit__(self, *exc):
            return False

    class FakeClient:
        def stream(self, method, url):
            return FakeStreamCtx()

        async def __aenter__(self):
            return self

        async def __aexit__(self, *exc):
            return False

    monkeypatch.setattr(v.httpx, "AsyncClient", lambda *a, **kw: FakeClient())
    with pytest.raises(AppError) as ei:
        await v._fetch_image_url("https://example.com/huge.png")
    assert ei.value.error_code == "INVALID_IMAGE"


async def _noop():
    return "example.com"
