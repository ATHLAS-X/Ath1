"""FastAPI application entrypoint for the ATHLASX compute service."""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.deps import gen_request_id
from app.api.routes import health, ocr, psych, video
from app.core.config import get_settings
from app.core.errors import AppError
from app.core.logging import configure_logging, get_logger
from app.core.redis import close_arq_pool, get_arq_pool
from app.schemas.common import ErrorCode, StandardErrorResponse

logger = get_logger(__name__)

DESCRIPTION = """
AI compute service for ATHLASX. Three async modules behind `/api/v1/compute`:

* **Video Analysis** — Gemini multimodal technique analysis of YouTube clips.
* **Psychological Assessment** — ACSI-28 questionnaire → Gemini mental-performance profile.
* **Scorecard OCR** — Gemini image-to-structured-data extraction (review-only).

Long-running work is enqueued as ARQ jobs; clients poll the `status` endpoints.
This is a standalone build — see `RECONCILIATION_NOTES.md` for integration TODOs.
"""


@asynccontextmanager
async def lifespan(app: FastAPI):
    configure_logging()
    settings = get_settings()
    if settings.sentry_dsn:
        try:
            import sentry_sdk

            sentry_sdk.init(dsn=settings.sentry_dsn, environment=settings.environment)
            logger.info("sentry initialised")
        except Exception as exc:  # noqa: BLE001
            logger.warning("sentry init failed", extra={"data": {"error": str(exc)}})

    pool = await get_arq_pool()
    app.state.redis = pool   # rate-limit counters + cache
    app.state.queue = pool   # ARQ enqueue_job
    logger.info("compute service started", extra={"data": {"environment": settings.environment}})
    try:
        yield
    finally:
        await close_arq_pool()


app = FastAPI(
    title="ATHLASX Compute",
    version="0.1.0",
    description=DESCRIPTION,
    lifespan=lifespan,
)

# CORS so a browser frontend (e.g. the Next.js app on localhost:3000) can call this
# API cross-origin. Origins are configurable via CORS_ALLOW_ORIGINS (see config.py).
# allow_credentials is False: auth is a Bearer token in the Authorization header (not
# cookies), so the wildcard default works in browsers. If you switch to cookie auth,
# set explicit CORS_ALLOW_ORIGINS and flip allow_credentials to True.
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_origins_list,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Exception handlers (Engineering Doc 5.4 error envelope) ──────────────────
@app.exception_handler(AppError)
async def _app_error_handler(request: Request, exc: AppError) -> JSONResponse:
    body = StandardErrorResponse(
        error_code=exc.error_code,
        error_message=exc.message,
        retry_after=exc.retry_after,
        request_id=gen_request_id(),
    )
    headers = {"Retry-After": str(exc.retry_after)} if exc.retry_after else None
    return JSONResponse(status_code=exc.status_code, content=body.model_dump(), headers=headers)


@app.exception_handler(RequestValidationError)
async def _validation_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    body = StandardErrorResponse(
        error_code=ErrorCode.INVALID_REQUEST.value,
        error_message="Request validation failed: " + "; ".join(
            f"{'.'.join(str(p) for p in e.get('loc', []))}: {e.get('msg', '')}" for e in exc.errors()
        ),
        retry_after=None,
        request_id=gen_request_id(),
    )
    return JSONResponse(status_code=422, content=body.model_dump())


@app.exception_handler(Exception)
async def _unhandled_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.error("unhandled error", extra={"data": {"error": str(exc), "path": str(request.url)}})
    body = StandardErrorResponse(
        error_code=ErrorCode.UNKNOWN.value,
        error_message="An unexpected error occurred.",
        retry_after=None,
        request_id=gen_request_id(),
    )
    return JSONResponse(status_code=500, content=body.model_dump())


# ── Routers ──────────────────────────────────────────────────────────────────
app.include_router(health.router)
app.include_router(video.router)
app.include_router(psych.router)
app.include_router(ocr.router)
