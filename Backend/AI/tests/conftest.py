"""Shared test fixtures.

The non-live tiers run with NO external services and NO API key:
  * Database  → in-memory SQLite (StaticPool) with the real model metadata.
  * Redis     → fakeredis (async).
  * Job queue → a recording fake (jobs are driven manually by the tests).
  * Gemini    → a mock client returning schema-valid fixed responses.
"""

from __future__ import annotations

import os

# Configure environment BEFORE importing any app module (settings are cached).
os.environ.setdefault("ENVIRONMENT", "development")
os.environ.setdefault("AUTH_JWT_SECRET", "test-secret-key-at-least-32-bytes-long-000")
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite://")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/1")
os.environ.setdefault("GEMINI_API_KEY", "")

import fakeredis.aioredis as fakeredis_aio  # noqa: E402
import pytest  # noqa: E402
import pytest_asyncio  # noqa: E402
from httpx import ASGITransport, AsyncClient  # noqa: E402
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402

from app.core.config import get_settings  # noqa: E402

get_settings.cache_clear()

from app.core import database  # noqa: E402
from app.core.database import Base  # noqa: E402
import app.models  # noqa: E402,F401  (populate metadata)
from app.core.security import Role, mint_dev_token  # noqa: E402

# ── Test database (shared in-memory SQLite) ──────────────────────────────────
TEST_ENGINE = create_async_engine(
    "sqlite+aiosqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TEST_SESSIONMAKER = async_sessionmaker(TEST_ENGINE, expire_on_commit=False)

# Patch the app's global engine/sessionmaker so routes AND worker jobs use the test DB.
database._engine = TEST_ENGINE
database._sessionmaker = TEST_SESSIONMAKER


@pytest_asyncio.fixture(autouse=True)
async def _setup_db():
    async with TEST_ENGINE.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with TEST_ENGINE.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


# ── Fakes ────────────────────────────────────────────────────────────────────
@pytest_asyncio.fixture
async def fake_redis():
    r = fakeredis_aio.FakeRedis()
    yield r
    await r.flushall()
    await r.aclose()


class FakeQueue:
    """Records enqueue_job calls; does not run anything."""

    def __init__(self) -> None:
        self.jobs: list[tuple] = []

    async def enqueue_job(self, name: str, *args, **kwargs):
        self.jobs.append((name, args, kwargs))
        return None


@pytest.fixture
def fake_queue() -> FakeQueue:
    return FakeQueue()


# ── HTTP client with dependency overrides ────────────────────────────────────
@pytest_asyncio.fixture
async def client(fake_redis, fake_queue):
    from app.api.deps import get_db, get_redis, get_task_queue
    from app.main import app

    async def _db_override():
        async with TEST_SESSIONMAKER() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise

    app.dependency_overrides[get_db] = _db_override
    app.dependency_overrides[get_redis] = lambda: fake_redis
    app.dependency_overrides[get_task_queue] = lambda: fake_queue

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()


# ── JWT auth headers ─────────────────────────────────────────────────────────
def _auth(role: Role, user_id: str | None = None) -> dict[str, str]:
    return {"Authorization": f"Bearer {mint_dev_token(role, user_id=user_id)}"}


@pytest.fixture
def scout_headers():
    return _auth(Role.SCOUT, user_id="scout_1")


@pytest.fixture
def player_headers():
    return _auth(Role.PLAYER, user_id="player_1")


@pytest.fixture
def admin_headers():
    return _auth(Role.ATHLASX_ADMIN, user_id="admin_1")


@pytest.fixture
def academy_admin_headers():
    return _auth(Role.ACADEMY_ADMIN, user_id="acad_1")


@pytest.fixture
def tournament_admin_headers():
    return _auth(Role.TOURNAMENT_ORGANIZER, user_id="tourn_1")


def auth_headers(role: Role, user_id: str | None = None) -> dict[str, str]:
    return _auth(role, user_id)


# ── Valid psychology request payload builder ─────────────────────────────────
_LONG_ANSWER = (
    "In the district final last season I was batting on twelve off forty balls and "
    "the bowler kept beating my outside edge. I told myself to watch the ball onto "
    "the bat and wait for the loose delivery, and I went on to make seventy eight."
)


def build_psych_payload(player_id: str = "player_1", acsi_value: int = 3) -> dict:
    """A complete, valid psychology submission body."""
    return {
        "player_id": player_id,
        "acsi_responses": {str(n): acsi_value for n in range(1, 29)},
        "scenario_responses": {f"scenario_{i}": {"selected": "A", "other_text": ""} for i in range(1, 11)},
        "open_ended_responses": {f"q{i}": _LONG_ANSWER for i in range(1, 6)},
        "lie_scale_responses": [1, 1, 2, 1, 2],
        "player_context": {
            "age": 19,
            "primary_role": "Fast Bowler",
            "years_playing": 8,
            "competition_level": "District League",
            "state": "Karnataka",
        },
        "completion_time_minutes": 14,
    }


# ── Minimal valid 1x1 PNG (base64) for OCR tests ─────────────────────────────
TINY_PNG_BASE64 = (
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9"
    "awAAAABJRU5ErkJggg=="
)


# ── Mock Gemini client + schema-valid fake responses ─────────────────────────
VALID_VIDEO_JSON = {
    "clip_metadata": {
        "analysis_timestamp": "2026-06-21T10:30:00Z",
        "clip_type": "Batting – front-on",
        "player_role": "Batsman",
        "confidence": "medium",
    },
    "overall_assessment": {"summary": "Solid, balanced technique with minor tweaks needed.", "confidence": "medium"},
    "technique_observations": [
        {"marker": "Head position", "observation": "Head stable through contact.",
         "confidence": "high", "category": "strength", "evidence": "Front-on view shows still head."},
        {"marker": "Front foot", "observation": "Stride slightly short to pitched-up deliveries.",
         "confidence": "medium", "category": "development_area", "evidence": "Foot lands behind ball line."},
    ],
    "role_specific_scores": {"head_position": {"score": 4, "justification": "Stable and aligned."}},
    "recommendations": [
        {"priority": "medium", "description": "Lengthen front-foot stride.", "drill_suggestion": "Cone stride drill."}
    ],
    "analysis_caveats": ["Single camera angle limits depth assessment."],
    "data_quality_flags": ["angle_not_optimal"],
}

VALID_PSYCH_JSON = {
    "submission_metadata": {"player_id": "x", "completion_time_minutes": 14, "timestamp": "2026-06-21T10:30:00Z"},
    "acsi_subscale_scores": {},
    "response_quality_flags": {
        "social_desirability_risk": "low",
        "lie_scale_triggered": False,
        "open_ended_vagueness_flag": False,
        "response_inconsistency_flag": False,
    },
    "scout_summary": {
        "overall_mental_performance_level": 4,
        "key_strengths": ["Coachable", "Resilient"],
        "pressure_indicators": ["Mild pre-match nerves"],
        "coachability_signal": "strong",
        "recommendation": "Worth tracking.",
        "confidence": "medium",
    },
    "player_development_summary": {
        "strengths": ["Strong work ethic", "Open to feedback"],
        "development_areas": ["Concentration in long spells"],
        "suggested_focus": ["Focus-cue routine"],
    },
    "mandatory_caveats": [
        "This profile is generated by an AI system based on self-reported questionnaire data. It is not a clinical psychological assessment.",
        "The accuracy of this profile depends on the honesty and thoughtfulness of the player's responses.",
        "This profile should be used as ONE input among many for talent identification decisions.",
        "Players may respond differently on different days. A single assessment captures a snapshot.",
        "If you have concerns about a player's mental health, consult a licensed sports psychologist.",
    ],
    "raw_gemini_narrative": "Internal reasoning text.",
}

VALID_OCR_JSON = {
    "match_context": {
        "team_a": {"value": "Karnataka U19", "confidence": "high"},
        "team_b": {"value": "Kerala U19", "confidence": "high"},
        "venue": {"value": None, "confidence": "low"},
        "match_date": {"value": None, "confidence": "low"},
        "format": {"value": "List A", "confidence": "medium"},
    },
    "innings": [
        {
            "batting_team": {"value": "Karnataka U19", "confidence": "high"},
            "bowling_team": {"value": "Kerala U19", "confidence": "high"},
            "batting": [
                {"player_name": {"value": "R Sharma", "confidence": "high"},
                 "runs": {"value": 78, "confidence": "high"},
                 "balls_faced": {"value": 92, "confidence": "medium"},
                 "fours": {"value": 8, "confidence": "medium"},
                 "sixes": {"value": 1, "confidence": "medium"},
                 "dismissal": {"value": "c Nair b Khan", "confidence": "medium"}},
            ],
            "bowling": [
                {"player_name": {"value": "A Khan", "confidence": "high"},
                 "overs": {"value": 10.0, "confidence": "high"},
                 "maidens": {"value": 1, "confidence": "medium"},
                 "runs_conceded": {"value": 45, "confidence": "high"},
                 "wickets": {"value": 3, "confidence": "high"}},
            ],
            "extras": {"value": 12, "confidence": "medium"},
            "total": {"value": "245/8", "confidence": "high"},
        }
    ],
    "data_quality_flags": ["glare_or_shadow"],
}


class MockGeminiClient:
    """Drop-in for GeminiClient that returns fixed, schema-valid JSON."""

    def __init__(self, video=None, text=None, image=None, force_error=None):
        import json

        self._video = json.dumps(video if video is not None else VALID_VIDEO_JSON)
        self._text = json.dumps(text if text is not None else VALID_PSYCH_JSON)
        self._image = json.dumps(image if image is not None else VALID_OCR_JSON)
        self._force_error = force_error  # dict like {"status":"error","error_code":"...","message":"..."}

    async def analyze_video(self, *a, **k):
        return self._force_error or {"status": "success", "content": self._video}

    async def analyze_text(self, *a, **k):
        return self._force_error or {"status": "success", "content": self._text}

    async def analyze_image(self, *a, **k):
        return self._force_error or {"status": "success", "content": self._image}

    async def check_reachable(self, *a, **k):
        return False


@pytest.fixture
def mock_gemini():
    return MockGeminiClient()
