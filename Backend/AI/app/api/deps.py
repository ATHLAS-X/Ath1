"""Common FastAPI dependencies: DB session, Redis, authenticated principal, RBAC."""

from __future__ import annotations

import uuid
from collections.abc import AsyncIterator, Awaitable, Callable

from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.core.errors import forbidden, unauthorized
from app.core.security import AuthError, Principal, Role, decode_token


def gen_request_id() -> str:
    return f"req_{uuid.uuid4()}"


async def get_db() -> AsyncIterator[AsyncSession]:
    async for session in get_session():
        yield session


async def get_redis(request: Request):
    """Redis handle for rate-limit counters + cache (app.state.redis)."""
    return request.app.state.redis


async def get_task_queue(request: Request):
    """Job queue used to enqueue ARQ jobs (app.state.queue).

    In production this is the ARQ Redis pool; tests override this dependency with a
    fake whose ``enqueue_job`` simply records the call.
    """
    return request.app.state.queue


def _extract_bearer(request: Request) -> str:
    header = request.headers.get("Authorization") or request.headers.get("authorization")
    if not header or not header.lower().startswith("bearer "):
        raise unauthorized("Missing Bearer token")
    return header.split(" ", 1)[1].strip()


async def get_principal(request: Request) -> Principal:
    token = _extract_bearer(request)
    try:
        return decode_token(token)
    except AuthError as exc:
        raise unauthorized(exc.message) from exc


def require_roles(*roles: Role) -> Callable[..., Awaitable[Principal]]:
    """Dependency factory: allow only the given roles."""
    allowed = set(roles)

    async def _dep(principal: Principal = Depends(get_principal)) -> Principal:
        if principal.role not in allowed:
            raise forbidden(
                f"Role {principal.role.value} is not permitted for this action."
            )
        return principal

    return _dep
