"""Application configuration via Pydantic Settings.

All environment variables for the compute service are declared here. Defaults are
chosen so the service boots for local development against the isolated stack in
``docker-compose.dev.yml``. See ``.env.example`` for documentation of each var and
``RECONCILIATION_NOTES.md`` for why certain values diverge from the source docs.
"""

from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # ── Runtime ──────────────────────────────────────────────────────────────
    environment: Literal["development", "staging", "production"] = "development"

    # ── Database (SQLAlchemy async) ──────────────────────────────────────────
    # Standalone build: local isolated Postgres. Async driver URL required.
    database_url: str = "postgresql+asyncpg://athlasx:athlasx@localhost:5433/athlasx_compute"

    # ── Redis (ARQ + rate limit + cache) ─────────────────────────────────────
    redis_url: str = "redis://localhost:6380/1"

    # ── Gemini ───────────────────────────────────────────────────────────────
    gemini_api_key: str = ""
    # Configurable model strings — never hardcode these inline in the client.
    # gemini_video_model is a PREVIEW model (see gemini_client.py for caveats).
    gemini_video_model: str = "gemini-3.1-pro-preview"
    gemini_text_model: str = "gemini-3.5-flash"
    # OCR gets its own var (defaults to the text model) for future swap flexibility.
    gemini_ocr_model: str = "gemini-3.5-flash"

    # ── Auth (standalone HS256; replace with Auth.js at integration) ─────────
    auth_jwt_secret: str = "dev-only-insecure-secret-change-me"
    auth_jwt_algorithm: str = "HS256"

    # ── Observability ────────────────────────────────────────────────────────
    sentry_dsn: str = ""

    # ── Rate limits (see RECONCILIATION_NOTES.md for chosen values) ──────────
    video_analyses_per_player_per_day: int = 5
    video_max_clips_per_submission: int = 2
    psych_assessment_cooldown_days: int = 30
    ocr_scorecards_per_admin_per_day: int = 100

    # ── OCR input limits ─────────────────────────────────────────────────────
    ocr_max_image_bytes: int = 10 * 1024 * 1024  # 10 MB decoded cap

    # ── Gemini timeouts (seconds) — mirror arch doc 11.3 ARQ policy ──────────
    gemini_video_timeout_seconds: int = 120
    gemini_text_timeout_seconds: int = 60
    gemini_ocr_timeout_seconds: int = 60

    # ── CORS (so a browser frontend on another origin can call this API) ─────
    # Comma-separated list of allowed origins, e.g.
    #   "http://localhost:3000,https://app.athlasx.in"
    # "*" must NEVER be used in production — even with allow_credentials=False,
    # an open CORS policy lets any third-party site read this API's responses
    # from a logged-in user's browser. The default below is scoped to the local
    # Next.js dev server, not a wildcard.
    cors_allow_origins: str = "http://localhost:3000"

    @property
    def cors_origins_list(self) -> list[str]:
        raw = self.cors_allow_origins.strip()
        if raw == "*":
            return ["*"]
        return [o.strip() for o in raw.split(",") if o.strip()]

    @property
    def is_development(self) -> bool:
        return self.environment == "development"

    @property
    def is_production(self) -> bool:
        return self.environment == "production"


@lru_cache
def get_settings() -> Settings:
    """Cached settings singleton."""
    return Settings()
