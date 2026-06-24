# ATHLASX AI / Compute Service

**Owner: Mrigank — the Python/AI lane.** A standalone FastAPI service providing three AI
modules behind `/api/v1/compute`:

| Module | Endpoints | Engine |
|--------|-----------|--------|
| **Video Analysis** | `POST /video/analyze`, `GET /video/status/{task_id}`, `GET /video/player/{player_id}` | Gemini (video) |
| **Psychological Assessment** | `GET /psych/questionnaire`, `POST /psych/analyze`, `GET /psych/status/{task_id}`, `GET /psych/player/{player_id}` | Gemini (text) |
| **Scorecard OCR** | `POST /ocr/scorecard`, `GET /ocr/status/{task_id}` | Gemini (image) |
| Health | `GET /health` | — |

> Location: `Backend/AI/` (formerly `apps/compute/`).
>
> ⚠️ **This is a standalone build.** It is NOT wired into the Next.js core or the real
> `infra/Caddyfile`. The real `infra/docker-compose.yml` already defines `compute` /
> `compute-worker` services pointing at this directory, but the app code is not yet
> integrated. Before integrating, read [`RECONCILIATION_NOTES.md`](./RECONCILIATION_NOTES.md)
> and the **Integration TODO** at the bottom.

## Stack

- FastAPI + Uvicorn (2 workers)
- ARQ + Redis for async jobs (submit → poll pattern)
- SQLAlchemy 2.x async (asyncpg) + Alembic (LOCAL dev DB only — see schema-ownership note)
- Google Gemini via `google-genai` (native async)
- Standalone HS256 JWT auth (placeholder for Auth.js)
- CORS enabled (configurable) so a browser frontend can call the API

## Architecture (per module)

```
POST .../analyze  ──▶ validate → rate-limit → create task (PENDING) → enqueue ARQ job ──▶ {task_id}
                                                                            │
ARQ worker ──▶ load task → PROCESSING → Gemini call → validate JSON → store result → COMPLETE/FAILED
                                                                            │
GET .../status/{task_id} ──▶ PENDING | PROCESSING | COMPLETE (+result) | FAILED (+error)
```

## Run locally — with Docker (recommended)

```bash
cd Backend/AI
export GEMINI_API_KEY=...          # optional; only needed for live Gemini calls
docker compose -f docker-compose.dev.yml up --build
```

This starts an **isolated** Postgres (host port `5433`) and Redis (host port `6380`),
runs `alembic upgrade head` automatically, and serves the API at
<http://localhost:8000/docs>. It does not touch the project's real infra.

## Run locally — without Docker

```bash
cd Backend/AI
python -m venv .venv && source .venv/bin/activate   # (Windows: .venv\Scripts\activate)
pip install -r requirements.txt
cp .env.example .env                                 # then edit values

# Point DATABASE_URL / REDIS_URL at a local Postgres + Redis, then:
alembic upgrade head
uvicorn app.main:app --reload --port 8000
# In a second terminal, run the worker:
python -m arq app.worker.WorkerSettings
```

## Database migrations

```bash
alembic upgrade head        # apply (creates the 6 owned tables)
alembic downgrade base      # drop them
alembic current             # show applied revision
```

The 6 owned tables: `video_analysis_tasks`, `video_analysis_results`,
`psychology_assessment_tasks`, `psychology_assessment_results`, `ocr_tasks`,
`ocr_results`.

## Tests

```bash
# Tier 1 (pure logic) + Tier 2 (mocked Gemini, fakeredis, in-memory SQLite).
# No GEMINI_API_KEY and no external services required — runs in CI.
pytest -m "not live_api"

# Tier 3 (LIVE — calls the real Gemini API; costs money/quota). Skipped by default.
GEMINI_API_KEY=... pytest -m live_api
```

- **Tier 1** — pure psychology pre-processing.
- **Tier 2** — endpoint plumbing/contract with a mocked Gemini client.
- **Tier 3** — `@pytest.mark.live_api`, skipped by default; 10 synthetic psychology
  profiles run through the real prompt; the video/OCR live files have placeholders
  (`YOUTUBE_TEST_URLS`, `SCORECARD_TEST_IMAGES`).

## Required environment variables

See [`.env.example`](./.env.example). Key ones: `ENVIRONMENT`, `DATABASE_URL`,
`REDIS_URL`, `GEMINI_API_KEY`, `GEMINI_VIDEO_MODEL`, `GEMINI_TEXT_MODEL`,
`GEMINI_OCR_MODEL`, `AUTH_JWT_SECRET`, `CORS_ALLOW_ORIGINS`, optional `SENTRY_DSN`.

---

# Frontend Integration Guide

Everything a frontend developer needs to talk to this service.

## 1. Base URL & routing

| Environment | Base URL |
|-------------|----------|
| **Local dev** (this service directly) | `http://localhost:8000` |
| **Integrated** (behind the Caddy gateway) | same origin as the web app, under `/api/v1/compute/*` |

All routes are already prefixed with **`/api/v1/compute`**, e.g.
`http://localhost:8000/api/v1/compute/video/analyze`. In the integrated deployment Caddy
routes `/api/v1/compute/*` to this service, so from the browser you just call
`/api/v1/compute/...` (same origin — no CORS needed there).

Interactive API docs (request/response schemas, try-it-out):
**<http://localhost:8000/docs>** (Swagger) and **`/redoc`**.

## 2. CORS

CORS is enabled. In local dev the default `CORS_ALLOW_ORIGINS=*` lets a frontend on
`http://localhost:3000` call `http://localhost:8000` directly. In production set explicit
origins (e.g. `CORS_ALLOW_ORIGINS=https://app.athlasx.in`). Auth is a Bearer token (not
cookies), so credentialed CORS is not required.

## 3. Authentication

Every endpoint except `/health` requires a **Bearer JWT** (HS256) in the
`Authorization` header:

```
Authorization: Bearer <token>
```

The token must carry `user_id` (or `sub`) and `role` claims. Valid roles:
`PLAYER`, `SCOUT`, `COACH`, `ACADEMY_ADMIN`, `TOURNAMENT_ORGANIZER`, `ADMIN`,
`ATHLASX_ADMIN`.

> **Integration note:** in production these tokens come from Auth.js (the Next.js core).
> Until that's wired up, mint **dev** tokens locally (only works when
> `ENVIRONMENT=development`):
>
> ```bash
> cd Backend/AI
> python -c "from app.core.security import mint_dev_token, Role; print(mint_dev_token(Role.PLAYER, user_id='player_1'))"
> ```
>
> Use the printed string as the Bearer token. Mint with `Role.SCOUT`,
> `Role.ACADEMY_ADMIN`, etc. for the other endpoints.

### Which role can call what

| Endpoint | Allowed roles |
|----------|---------------|
| `POST /video/analyze`, `GET /video/status/{id}` | SCOUT, ADMIN |
| `GET /video/player/{id}` | any authenticated (response is **role-filtered**) |
| `GET /psych/questionnaire` | any authenticated |
| `POST /psych/analyze`, `GET /psych/status/{id}` | PLAYER, ADMIN (status: submitter or admin only) |
| `GET /psych/player/{id}` | any authenticated (**3-tier** filtered) |
| `POST /ocr/scorecard`, `GET /ocr/status/{id}` | ACADEMY_ADMIN, TOURNAMENT_ORGANIZER, ADMIN (status: submitter or admin only) |
| `GET /health` | public |

(`ADMIN` and `ATHLASX_ADMIN` are both treated as platform admin.)

## 4. The submit → poll pattern (important!)

The three analysis endpoints are **asynchronous**. A `POST` returns immediately with a
`task_id` and `status: "PENDING"`. The frontend then **polls** the matching
`GET .../status/{task_id}` until the status is terminal.

```
status: PENDING ─▶ PROCESSING ─▶ COMPLETE   (result is in the response)
                              └▶ FAILED      (error is in the response)
```

Suggested polling: every **5 seconds**. Typical completion: video ~30–120 s, psych
~5–15 s, OCR ~10–30 s. Stop polling on `COMPLETE` or `FAILED`. (A video cache hit can
return `COMPLETE` straight from the `POST`, with `estimated_completion_seconds: 0`.)

### Reference client (TypeScript)

```ts
const BASE = "/api/v1/compute"; // or "http://localhost:8000/api/v1/compute" in dev
const authHeader = (token: string) => ({ Authorization: `Bearer ${token}` });

async function submitAndPoll<T>(
  path: string, body: unknown, token: string,
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader(token) },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw await res.json();        // StandardErrorResponse

  const { task_id, status } = await res.json();
  const statusBase = path.replace(/\/[^/]+$/, "/status"); // e.g. /video/status
  let state = status;
  let result: unknown = null;

  while (state === "PENDING" || state === "PROCESSING") {
    await new Promise((r) => setTimeout(r, 5000));
    const s = await fetch(`${BASE}${statusBase}/${task_id}`, { headers: authHeader(token) });
    const data = await s.json();
    state = data.status;
    if (state === "COMPLETE") result = data.result;
    if (state === "FAILED") throw data.error;  // { code, message, retry_after }
  }
  return result as T;
}
```

## 5. Endpoint reference

### Video Analysis

**`POST /api/v1/compute/video/analyze`** (SCOUT)

```jsonc
{
  "player_id": "player_12345",
  "player_role": "Batsman",            // Batsman | Fast Bowler | Spin Bowler | Wicketkeeper | All-rounder
  "clips": [                            // 1 or 2 clips (1 → tagged "single_angle_only", never rejected)
    { "youtube_url": "https://www.youtube.com/watch?v=AbCdEfGhIjK", "clip_type": "Batting – side-on" },
    { "youtube_url": "https://youtu.be/XyZ01234567",                "clip_type": "Bowling – umpire view" }
  ],
  "context_notes": "Check front-foot movement vs spin",  // optional, ≤200 chars
  "opposition_quality": "U19 state attack",              // optional, ≤100 chars
  "ground_type": "Turf"                                  // optional: Turf | Matting | Synthetic | Unknown
}
```

`clip_type` enum: `Batting – front-on`, `Batting – side-on`, `Bowling – front-on`,
`Bowling – side-on`, `Bowling – umpire view`, `Bowling – rear view`,
`Wicketkeeping – behind stumps`, `Fielding`, `Match footage`.

Response: `{ "task_id": "...", "status": "PENDING", "estimated_completion_seconds": 60 }`

**`GET /api/v1/compute/video/status/{task_id}`** (SCOUT) → see §6 for the status shape.
On `COMPLETE`, `result` is the full analysis (`overall_assessment`,
`technique_observations`, `role_specific_scores`, `recommendations`, `analysis_caveats`,
`data_quality_flags`).

**`GET /api/v1/compute/video/player/{player_id}`** (any auth; role-filtered)

```jsonc
{ "player_id": "player_12345", "view": "SCOUT",
  "analyses": [ { "task_id": "...", "created_at": "...", "analysis": { /* … */ } } ] }
```
- **SCOUT/ADMIN** → full analysis. **PLAYER** → developmental view: `overall_assessment`,
  strengths-only `technique_observations`, `recommendations`, `data_quality_flags`
  (no `role_specific_scores`).

### Psychological Assessment

**`GET /api/v1/compute/psych/questionnaire`** (any auth) — the full instrument to render
the form: `instructions`, `response_scale`, `acsi_items` (28), `subscales`,
`lie_scale_items` (5), `scenarios` (10 × 4 options), `open_ended_questions` (5).

**`POST /api/v1/compute/psych/analyze`** (PLAYER) — submit the **raw** responses:

```jsonc
{
  "player_id": "player_1",
  "acsi_responses": { "1": 3, "2": 4, /* … all of 1..28 … */ "28": 2 },  // each value 1–4
  "scenario_responses": {
    "scenario_1": { "selected": "A", "other_text": "" },                 // scenario_1..10; selected A|B|C|D|Other
    "scenario_10": { "selected": "B", "other_text": "" }
  },
  "open_ended_responses": { "q1": "…", "q2": "…", "q3": "…", "q4": "…", "q5": "…" },
  "lie_scale_responses": [1, 1, 2, 1, 2],                                // exactly 5, each 1–4 (L1..L5)
  "player_context": { "age": 19, "primary_role": "Fast Bowler", "years_playing": 8,
                      "competition_level": "District League", "state": "Karnataka" },
  "completion_time_minutes": 14
}
```
Response: `{ "task_id": "...", "status": "PENDING", "estimated_completion_seconds": 15 }`.
Rate limit: **1 per player / 30 days** → `429 ASSESSMENT_TOO_FREQUENT` (with `retry_after`).

**`GET /api/v1/compute/psych/player/{player_id}`** (any auth; **3-tier** view):
- **SCOUT** → `scout_summary` + `response_quality_flags` + `mandatory_caveats`.
- **PLAYER** → `player_development_summary` + `mandatory_caveats`.
- **ADMIN** → full profile incl. `acsi_subscale_scores` and `raw_gemini_narrative`.

> ⚠️ `mandatory_caveats` MUST always be shown to the user and cannot be dismissed. If
> `response_quality_flags.social_desirability_risk` is `high` or `lie_scale_triggered`
> is `true`, show a prominent warning banner.

### Scorecard OCR

**`POST /api/v1/compute/ocr/scorecard`** (ACADEMY_ADMIN / TOURNAMENT_ORGANIZER / ADMIN) —
provide **exactly one** image source:

```jsonc
{ "image_url": "https://example.com/scorecard.jpg" }   // public jpg/png
// — or —
{ "image_base64": "<base64 jpg/png bytes, ≤10 MB decoded>" }
```
Response: `{ "task_id": "...", "status": "PENDING", "estimated_completion_seconds": 30 }`.

**`GET /api/v1/compute/ocr/status/{task_id}`** — on `COMPLETE`, `result` is
`{ "extraction": { match_context, innings[], data_quality_flags[] }, "review_status": "PENDING_REVIEW" }`.

> OCR output is **never auto-committed**. `review_status` is always `PENDING_REVIEW` here;
> a human approves/commits it elsewhere. `status: COMPLETE` means "extraction finished",
> not "approved". Every extracted field has a `{ value, confidence }` shape; illegible
> fields come back as `value: null` with a `data_quality_flags` entry.

## 6. Status response shape

```jsonc
// PENDING / PROCESSING
{ "task_id": "...", "status": "PROCESSING", "progress": null, "result": null, "error": null }
// COMPLETE
{ "task_id": "...", "status": "COMPLETE", "result": { /* module-specific */ } }
// FAILED
{ "task_id": "...", "status": "FAILED",
  "error": { "code": "GEMINI_TIMEOUT", "message": "…", "retry_after": 30 } }
```

## 7. Errors

All errors share one envelope:

```json
{ "error_code": "RATE_LIMIT_EXCEEDED", "error_message": "…", "retry_after": 3600,
  "request_id": "req_…" }
```

| HTTP | error_code | When |
|------|-----------|------|
| 400 | `INVALID_YOUTUBE_URL` | malformed YouTube URL |
| 400 | `VIDEO_NOT_ACCESSIBLE` | private/unlisted/deleted video |
| 400 | `INVALID_IMAGE` | OCR image not jpg/png, oversized, or bad base64 |
| 400 | `IMAGE_NOT_ACCESSIBLE` | OCR `image_url` unreachable |
| 401 | `UNAUTHORIZED` | missing/invalid token |
| 403 | `FORBIDDEN` | role not permitted for this endpoint |
| 404 | `TASK_NOT_FOUND` / `PLAYER_NOT_FOUND` | unknown id, or not yours to view |
| 422 | `INVALID_REQUEST` | body failed validation (e.g. >2 clips, missing ACSI items) |
| 429 | `RATE_LIMIT_EXCEEDED` | video 5/player/day or OCR 100/admin/day (see `retry_after`) |
| 429 | `ASSESSMENT_TOO_FREQUENT` | psych 1/player/30 days (see `retry_after`) |
| 500 | `INVALID_RESPONSE` | model returned unparseable output |

On `429`, also honour the `Retry-After` HTTP header.

## 8. Rate limits to surface in the UI

- **Video:** 5 submissions / player / day, max **2 clips** per submission.
- **Psychology:** 1 assessment / player / 30 days.
- **OCR:** 100 scorecards / submitting admin / day.

---

## Integration TODO (when wiring into the real system)

Cross-reference [`RECONCILIATION_NOTES.md`](./RECONCILIATION_NOTES.md). In short:

1. **Auth** — replace the standalone HS256 layer (`app/core/security.py`) with Auth.js
   tokens; re-map `Role` to the canonical Prisma `UserRole` values.
2. **Schema ownership** — Prisma is the sole migration runner against the shared DB.
   Reconcile these 6 tables and switch this service's Alembic to reflect-only.
3. **Models** — re-verify `GEMINI_VIDEO_MODEL` (`gemini-3.1-pro-preview` is a PREVIEW
   model) against the Gemini models page.
4. **OCR** — the admin-review/commit step (writing the real `scorecards` table) lives in
   the Next.js core, not here.
5. **Object Storage** — wire OCR image input to OCI Object Storage; base64 input is a
   standalone-testing affordance.
6. **CORS** — set explicit `CORS_ALLOW_ORIGINS` in production.
