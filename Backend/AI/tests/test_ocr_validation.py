"""TIER 1/2 — OCR image validation logic (pure; no Gemini, no network)."""

from __future__ import annotations

import base64

import pytest

from app.core.errors import AppError
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
    class FakeResp:
        status_code = 200
        content = _PNG

    async def fake_fetch(url):
        return FakeResp()

    monkeypatch.setattr(v, "_fetch_image_url", fake_fetch)
    data, mime = await v.fetch_image_from_url("https://example.com/x.png")
    assert mime == "image/png"


@pytest.mark.asyncio
async def test_fetch_image_from_url_404(monkeypatch):
    class FakeResp:
        status_code = 404
        content = b""

    async def fake_fetch(url):
        return FakeResp()

    monkeypatch.setattr(v, "_fetch_image_url", fake_fetch)
    with pytest.raises(AppError) as ei:
        await v.fetch_image_from_url("https://example.com/missing.png")
    assert ei.value.error_code == "IMAGE_NOT_ACCESSIBLE"
