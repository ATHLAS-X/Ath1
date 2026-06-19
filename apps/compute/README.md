# ATHLASX Compute Service

**Owner: Mrigank** — this is the Python/AI lane. Do not add Next.js code here.

## Stack
- FastAPI + Uvicorn (2 workers)
- ARQ + Redis for background jobs
- SQLAlchemy async for DB reads (reflection only — never run migrations here)
- Google Gemini (`google-genai`) as the AI provider

## Schema rule
**Prisma (in the root Next.js app) is the sole schema owner.**
This service reads Neon via SQLAlchemy reflection. Never create an Alembic migration here.

## Endpoints
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/compute/health` | Health check |

All new AI endpoints go under `/api/v1/compute/`.

## Local dev
```bash
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

## Environment variables
Copy `infra/.env.template` and set `GEMINI_API_KEY`, `DATABASE_URL`, `REDIS_URL`.
