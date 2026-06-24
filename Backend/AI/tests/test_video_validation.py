"""TIER 2 — video URL validation + Pydantic schema (no Gemini, no network)."""

from __future__ import annotations

import pytest

from app.services import validation as v


@pytest.mark.parametrize(
    "url",
    [
        "https://www.youtube.com/watch?v=AbCdEfGhIjK",
        "https://youtu.be/AbCdEfGhIjK",
        "http://youtube.com/watch?v=AbCdEfGhIjK",
        "https://www.youtube.com/shorts/AbCdEfGhIjK",
        "https://m.youtube.com/watch?v=AbCdEfGhIjK&t=10s",
    ],
)
def test_valid_youtube_urls(url):
    assert v.is_valid_youtube_url(url) is True
    assert v.extract_video_id(url) == "AbCdEfGhIjK"


@pytest.mark.parametrize(
    "url",
    [
        "https://vimeo.com/123456",
        "https://www.youtube.com/watch?v=short",   # id too short
        "not a url",
        "https://example.com/watch?v=AbCdEfGhIjK",
        "",
    ],
)
def test_invalid_youtube_urls(url):
    assert v.is_valid_youtube_url(url) is False


@pytest.mark.asyncio
async def test_check_youtube_accessible_true(monkeypatch):
    async def fake_status(url):
        return 200

    monkeypatch.setattr(v, "_oembed_status", fake_status)
    assert await v.check_youtube_accessible("https://youtu.be/AbCdEfGhIjK") is True


@pytest.mark.asyncio
async def test_check_youtube_accessible_false(monkeypatch):
    async def fake_status(url):
        return 404

    monkeypatch.setattr(v, "_oembed_status", fake_status)
    assert await v.check_youtube_accessible("https://youtu.be/AbCdEfGhIjK") is False
