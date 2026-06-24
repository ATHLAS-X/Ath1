# Reconciliation Notes — ATHLASX Compute Service (standalone build)

This service implements three AI modules — **Video Analysis**, **Psychological
Assessment**, and **Scorecard OCR** — as a **self-contained build**. It is NOT wired
into the Next.js core, the real `infra/docker-compose.yml`, or the real
`infra/Caddyfile`.

Three documents govern the build, with this precedence:

1. **SportX_System_Architecture v2.0** — authoritative for all infra / routing / auth /
   deployment / DB-ownership decisions. **Wins on any conflict** not explicitly overridden
   by the build instructions.
2. **Video & Psychological Analysis Engineering Doc** — authoritative for AI/business logic
   (system prompts, JSON schemas, the ACSI-28 question bank, scoring/pre-processing).
3. **AthlasX_Userflowv1_intermediate** — product/UX context only; not authoritative here.

Each conflict below records **what the docs said**, **what we did**, and **why**.

---

## 1. Gemini model names

| | Source |
|---|---|
| Engineering doc | `gemini-3.1-pro` (video) / `gemini-3.1-flash` (text) |
| Architecture doc | `gemini-2.5-pro` (video) / `gemini-2.5-flash` (text) |
| **Build instruction (authoritative)** | `gemini-3.1-pro-preview` (video) / `gemini-3.5-flash` (text) |

**Decision:** use the build-instruction strings as **defaults of configurable env vars**
(`GEMINI_VIDEO_MODEL`, `GEMINI_TEXT_MODEL`), never hardcoded inline. A third var
`GEMINI_OCR_MODEL` defaults to `gemini-3.5-flash` (see §7).

- `gemini-3.1-pro-preview` is a **PREVIEW** model: more restrictive rate limits, and can be
  deprecated with as little as ~2 weeks' notice. The Gemini client wrapper carries a comment
  flagging this, and a distinct `MODEL_DEPRECATED` error category so a retirement is
  loggable/spottable rather than a generic API failure.
- `gemini-3.5-flash` is the current stable flagship Flash model — no special handling.
- **Re-verify both strings against https://ai.google.dev/gemini-api/docs/models before any
  production deploy.**

## 2. Async task framework — ARQ + Redis (not BackgroundTasks)

The engineering doc specifies FastAPI `BackgroundTasks` for V1. The architecture doc (§7.2,
§11.3) and the existing `infra/docker-compose.yml` (`compute-worker` running
`python -m arq app.worker.WorkerSettings`) specify **ARQ + Redis from day one**.

**Decision:** follow the architecture doc — ARQ + Redis. The API enqueues a job and returns
a `task_id`; the worker processes it; the client polls a status endpoint.

## 3. Endpoint routing prefix — `/api/v1/compute/`

Engineering doc routes (`/analyze/video`, …) are re-nested under the architecture doc's Caddy
prefix `/api/v1/compute/*`. Logical sub-path behaviour/naming from the engineering doc is kept.

Final routes:
- `POST /api/v1/compute/video/analyze`, `GET …/video/status/{task_id}`, `GET …/video/player/{player_id}`
- `POST /api/v1/compute/psych/analyze`, `GET …/psych/status/{task_id}`, `GET …/psych/player/{player_id}`
- `POST /api/v1/compute/ocr/scorecard`, `GET …/ocr/status/{task_id}`
- `GET /api/v1/compute/health`

## 4. Authentication — standalone HS256 JWT

The engineering doc references "Scout JWT" / "Player JWT"; the architecture doc uses Auth.js
in **database session mode** within the Next.js core, which is not wired to this service.

**Decision:** implement a standalone HS256 Bearer-token verification dependency
(`AUTH_JWT_SECRET`) that validates signature/expiry and reads `role` + `user_id` (`sub`)
claims. A **dev-only** helper mints test tokens for PLAYER / SCOUT / ADMIN (and the
admin-class roles needed for OCR); it **refuses to run unless `ENVIRONMENT=development`**.

**Role-name divergence** (Phase 0 finding): the real Prisma `UserRole` enum uses
`ATHLASX_ADMIN` (not `ADMIN`) and `TOURNAMENT_ORGANIZER` (not the arch doc's
`TOURNAMENT_ADMIN`). The auth layer treats **both** `ADMIN` and `ATHLASX_ADMIN` as platform
admin, and accepts `ACADEMY_ADMIN` / `TOURNAMENT_ORGANIZER` as valid OCR submitters.

> **INTEGRATION TODO:** replace this entire standalone JWT layer with whatever Auth.js
> actually issues (session-token verification / shared secret / introspection). The role
> constants here must be re-mapped to the canonical Prisma `UserRole` values.

## 5. Database / schema ownership — local Alembic for owned tables only

The architecture doc (§7.3) makes Drizzle/Prisma the **sole** migration runner against the
shared DB and requires the compute service's ORM to be **reflect-only**.

**Decision (standalone-only divergence):** since there is no shared DB to reflect, we define
SQLAlchemy 2.x async models and **Alembic migrations** for **only the six tables this service
owns outright**, against a **LOCAL isolated Postgres** (`docker-compose.dev.yml`, port 5433):

- `video_analysis_tasks`, `video_analysis_results`
- `psychology_assessment_tasks`, `psychology_assessment_results`
- `ocr_tasks`, `ocr_results`

Models use **portable column types** (string UUIDs, generic `JSON`, tz-aware `DateTime`) so
the same metadata runs on Postgres (Alembic/dev/prod) and on in-memory SQLite (the
no-services test suite).

> **INTEGRATION TODO:** per the architecture doc's schema-ownership rule, when this service
> joins the real system these tables and their Alembic history must be reconciled with
> whatever ORM owns the shared schema at that time. The compute service must then run
> Alembic in **reflect/`alembic current`-only** mode and never `upgrade`/`revision` against
> the shared DB.

## 6. Scope

Built: **Video Analysis + Psychological Assessment + OCR**. (OCR was added after the initial
plan, which had deferred it.) **Not built:** SportX Score recompute — `app/api/routes/score.py`
is intentionally left as a reserved sibling slot so it can be added later without restructuring.

---

## OCR-specific reconciliations (arch doc §14.4 + §7.1 — the only spec)

There is **no system prompt or JSON schema** for OCR anywhere in the docs, so both were
designed here to match the rigor/structure of the video and psych prompts.

- **Model var:** introduced `GEMINI_OCR_MODEL` (defaults to `gemini-3.5-flash`) rather than
  reusing `GEMINI_TEXT_MODEL` directly — OCR is a distinct task that may want a different model
  later (e.g. a Pro/vision tier), and a dedicated var avoids a code change to split them.
- **No auto-commit / no `scorecards` ownership:** per arch §14.4, OCR output is never
  auto-committed. This service does **not** own or write the real `scorecards` table (the
  Next.js tournaments module does). The job ends by storing the extraction in this service's
  own `ocr_tasks` / `ocr_results` tables and returning it via the status endpoint for a human
  to review later. **There is deliberately no commit/confirm endpoint** — that integration
  lives outside this service.
- **Two separate state fields:** `status` is the task lifecycle
  (`PENDING → PROCESSING → COMPLETE/FAILED`, i.e. "did Gemini extraction finish"), identical to
  video/psych. `review_status` is an independent field that is **`PENDING_REVIEW` only** in this
  build — a placeholder for the human-approval workflow that will live in Next.js. They are
  never collapsed: `status: COMPLETE` means "extracted", never "approved".
- **Input handling:** the request accepts **either** a publicly fetchable image URL **or**
  base64-encoded image bytes (jpg/png). Reason: no Object Storage is wired up in the standalone
  build, so base64 enables fully offline/local testing while the URL path mirrors the eventual
  OCI-backed flow. Validation: URL → reachability + image content-type; base64 → decodes +
  jpg/png magic-byte check + **10 MB decoded size cap**.
- **Auth / role gating:** scorecard submission is an admin-class action (arch §15.1). Valid
  submitters: `ACADEMY_ADMIN`, `TOURNAMENT_ORGANIZER`, `ATHLASX_ADMIN`/`ADMIN`. `PLAYER` /
  `SCOUT` → 403.
- **Status access scoping:** the submitting admin (task owner by `user_id`) may poll their own
  `task_id`; `ATHLASX_ADMIN`/`ADMIN` may poll any task; a non-owner admin-class token gets 404;
  `PLAYER`/`SCOUT` are 403. Mirrors how video/psych scope result access.
- **Rate limit:** not specified in any doc → chose **100 scorecards per submitting admin per
  day** (Redis counter, 24 h TTL). Rationale: admins do bulk match-data entry, so the cap must
  sit well above the player video cap (5/day) while still bounding runaway/abuse cost.

---

## Other reconciliations discovered while building

- **Minimum-2-clips → soft flag, not hard reject.** Arch §14.2 says reject a single-clip
  submission; engineering doc §3.2 says it's a *recommendation* surfaced as a data-quality
  caveat. The **build instruction explicitly overrides toward the engineering doc**: a
  single-clip submission is accepted and tagged with the `single_angle_only`
  `data_quality_flag` — never rejected.
- **Video request shape — list of clips.** Engineering doc §3.6's body has a single
  `youtube_url`; arch §14.2 implies multiple angle-tagged clips. We merge them: the request
  accepts a **list of clips** `[{youtube_url, clip_type}]` plus top-level `player_role`,
  `context_notes`, `player_id`. This is what makes the "number of clips" soft-flag meaningful.
- **Video rate-limit semantics.** The "5 per player per day" limit counts **submissions**
  (1 submission = 1 analysis task = 1 `task_id`), incremented once per `POST /video/analyze`
  via a Redis day-keyed counter. Each submission is capped at **max 2 clips** (1 clip →
  `single_angle_only`; 2 clips = the recommended full analysis, e.g. umpire + side-on; >2 →
  422). Worst-case Gemini load = 5 × 2 = 10 clips/player/day. (Chosen with the user to bound
  cost; the original "5/day" predates the multi-clip request shape.)
- **Video dedup cache key (canonical).** Because `clips` is a list of dicts, the key must pin
  both the sort order and the serialization: sort clips by `(youtube_url, clip_type)`, then
  `sha256(json.dumps({"clips": sorted_clips, "player_role": role}, sort_keys=True,
  separators=(",", ":")))`. Cached under `video_analysis:{hash}`.
- **Analysis role enum follows the engineering doc** (Batsman, Fast Bowler, Spin Bowler,
  Wicketkeeper, All-rounder) because it drives which AI framework branch the prompt uses. This
  differs from Prisma's `PrimaryRole` (BATTER/BOWLER/ALL_ROUNDER/WICKETKEEPER) — a mapping is
  an integration concern.
- **Output schemas follow the engineering doc** (§3.5 video, §4.6 psych), which are richer than
  arch §14.2 — these are business logic.
- **Native-async Gemini.** The installed `google-genai` exposes `client.aio.models.*`, so the
  wrapper is async-native (no `run_in_executor`). A fallback comment documents the executor
  path for SDK versions lacking `.aio`.
- **Psych rate limit (1 / 30 days)** is enforced via a **DB query** on the latest
  `psychology_assessment_tasks` row for the player (robust over a 30-day window), not a Redis
  TTL. Video/OCR per-day caps use Redis counters.
- **Health check** returns **per-component** status (DB, Redis, Gemini reachability) per arch
  §7.1. DB+Redis failures make the overall status `unhealthy` (503); Gemini is reported but a
  Gemini hiccup alone degrades rather than hard-fails the endpoint.
- **Building into the pre-existing stub, then renamed.** Phase 0 found a placeholder service at
  `apps/compute/` (matching arch Appendix B). We built into it, replacing the stub `main.py`,
  `worker.py`, `Dockerfile`, `Dockerfile.worker`, `README.md`, `requirements.txt`. The directory
  was subsequently renamed to **`Backend/AI/`** (with `apps/` → `Backend/`); the real
  `infra/docker-compose.yml` build contexts were updated to `../Backend/AI` to match. The stub
  README's "never run Alembic / reflect-only" line is superseded **for this standalone build
  only** by §5 above; the integration TODO restores that rule.
- **Test database.** Tier-1/Tier-2 tests run against **in-memory SQLite** (via the portable
  model types) with `Base.metadata.create_all` — no Postgres/Redis services and no API key
  required, so the full non-live suite runs in CI. Redis is replaced by `fakeredis`; the Gemini
  client is mocked. The `docker-compose.dev.yml` Postgres/Redis are for running the actual
  service and Alembic, not for the test suite.
