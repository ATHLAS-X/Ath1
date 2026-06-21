"""Standalone JWT authentication (HS256) + dev-only token minting.

RECONCILIATION (see RECONCILIATION_NOTES.md §4): the real platform uses Auth.js in
database-session mode within the Next.js core, which is not wired to this service.
This module provides a self-contained Bearer-token verifier (shared secret via
``AUTH_JWT_SECRET``) reading ``role`` and ``user_id``/``sub`` claims, plus a dev-only
helper to mint test tokens.

INTEGRATION TODO: replace this entire layer with whatever Auth.js issues; re-map the
role constants below to the canonical Prisma ``UserRole`` values.
"""

from __future__ import annotations

import enum
import time
import uuid

import jwt

from app.core.config import get_settings


class Role(str, enum.Enum):
    """Roles this service recognises.

    Maps to the real Prisma ``UserRole`` where possible. Note the divergences:
    the Prisma enum uses ``ATHLASX_ADMIN`` (not ``ADMIN``) and ``TOURNAMENT_ORGANIZER``
    (not the arch doc's ``TOURNAMENT_ADMIN``). We accept both admin spellings.
    """

    PLAYER = "PLAYER"
    SCOUT = "SCOUT"
    COACH = "COACH"
    ACADEMY_ADMIN = "ACADEMY_ADMIN"
    TOURNAMENT_ORGANIZER = "TOURNAMENT_ORGANIZER"
    ADMIN = "ADMIN"
    ATHLASX_ADMIN = "ATHLASX_ADMIN"


# Role groupings used by route dependencies.
ADMIN_ROLES = {Role.ADMIN, Role.ATHLASX_ADMIN}
# Who may submit scorecards for OCR (arch doc §15.1, mapped to real Prisma names).
OCR_SUBMITTER_ROLES = {
    Role.ACADEMY_ADMIN,
    Role.TOURNAMENT_ORGANIZER,
    Role.ADMIN,
    Role.ATHLASX_ADMIN,
}


class AuthError(Exception):
    """Raised on missing/invalid tokens. Translated to 401/403 by route deps."""

    def __init__(self, message: str, status_code: int = 401):
        self.message = message
        self.status_code = status_code
        super().__init__(message)


class Principal:
    """The authenticated caller."""

    def __init__(self, user_id: str, role: Role, raw_claims: dict):
        self.user_id = user_id
        self.role = role
        self.raw_claims = raw_claims

    @property
    def is_admin(self) -> bool:
        return self.role in ADMIN_ROLES


def decode_token(token: str) -> Principal:
    """Verify an HS256 Bearer token and extract the principal."""
    settings = get_settings()
    try:
        claims = jwt.decode(
            token,
            settings.auth_jwt_secret,
            algorithms=[settings.auth_jwt_algorithm],
        )
    except jwt.ExpiredSignatureError as exc:
        raise AuthError("Token has expired") from exc
    except jwt.InvalidTokenError as exc:
        raise AuthError("Invalid token") from exc

    user_id = claims.get("user_id") or claims.get("sub")
    role_raw = claims.get("role")
    if not user_id or not role_raw:
        raise AuthError("Token missing required claims (user_id/role)")
    try:
        role = Role(role_raw)
    except ValueError as exc:
        raise AuthError(f"Unknown role claim: {role_raw}") from exc
    return Principal(user_id=str(user_id), role=role, raw_claims=claims)


# ── Dev-only token minting ───────────────────────────────────────────────────
def mint_dev_token(role: Role | str, user_id: str | None = None, ttl_seconds: int = 3600) -> str:
    """Mint a test JWT. REFUSES to run unless ENVIRONMENT=development.

    Used by the test suite and manual testing so this service can authenticate
    without a running Next.js app.
    """
    settings = get_settings()
    if not settings.is_development:
        raise RuntimeError(
            "mint_dev_token is disabled outside ENVIRONMENT=development "
            f"(current: {settings.environment})."
        )
    role = Role(role) if not isinstance(role, Role) else role
    now = int(time.time())
    user_id = user_id or f"dev_{role.value.lower()}_{uuid.uuid4().hex[:8]}"
    payload = {
        "sub": user_id,
        "user_id": user_id,
        "role": role.value,
        "iat": now,
        "exp": now + ttl_seconds,
    }
    return jwt.encode(payload, settings.auth_jwt_secret, algorithm=settings.auth_jwt_algorithm)
