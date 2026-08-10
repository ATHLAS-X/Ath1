# CONNECTION AUDIT — ATHLASX AI Modules
**Audited:** 2026-06-25 | **Auditor:** Antigravity AI
**Scope:** Next.js API routes (onboarding/video, onboarding/behaviour, onboarding/match)
          vs. Backend/AI FastAPI service (api/routes/video.py, psych.py, ocr.py)

## Post-Fix Status (2026-06-25)

All three modules have been wired to the compute service. The table below summarizes the current integration state:

| Module | Calls Compute? | Auth Bridge? | Role Filtering? | DB Persistence | Frontend Form |
|--------|---------------|--------------|-----------------|----------------|---------------|
| Video | ✅ YES | ✅ HS256 JWT | ✅ Player sees dev view only | ✅ video_analysis (TODO: compute_task_id) | Unchanged |
| Psychology | ✅ YES | ✅ HS256 JWT | ✅ 3-tier (player/scout/admin) | ✅ behavioral_assessment + mindset_score | **REBUILT** (ACSI-28) |
| OCR | ✅ YES | ✅ HS256 JWT | N/A (structural data) | ✅ match_logs (PENDING_REVIEW) | Unchanged |

**Key changes:**
- `@google/generative-ai` removed from `package.json` — all Gemini calls go through compute service
- `jose@^4.15.9` added explicitly (matches next-auth transitive)
- Auth bridge: `lib/computeAuth.ts` + `lib/computeClient.ts`
- Status proxy endpoints for all three modules with role-based filtering
- `advanceStep(8)` deliberately NOT called from psychology (standalone page, not wizard step)
- `mindset_score` derived from ACSI subscale scores (0-100 scale)

---

---

## EXECUTIVE SUMMARY

**None of the three Next.js onboarding routes call the compute service (Backend/AI).**
All three operate as self-contained Next.js handlers that use their own embedded Gemini
calls, fallbacks, or stub logic. The compute service exists as a standalone, fully
functional FastAPI service but is **not yet wired to the Next.js frontend at all**.

Additionally, the compute service uses a **different auth mechanism** (standalone HS256
JWT with `AUTH_JWT_SECRET`) than the Next.js core (Auth.js database-session tokens).
Any integration attempt will require bridging this auth gap.

---

## MODULE 1: VIDEO ANALYSIS

### 1. Next.js Side — `app/api/onboarding/video/route.ts`

**Status: STUB / FALLBACK ONLY. Does NOT call the compute service.**

The route (`POST /api/onboarding/video`) lives at
[`app/api/onboarding/video/route.ts`](file:///c:/Users/Mrigank%20Singh/Desktop/Athlasx/app/api/onboarding/video/route.ts).

**Critical lines:**

```typescript
// Line 96 — the Gemini branch is permanently disabled with `&& false`
if (process.env.GEMINI_API_KEY && false) {
    // Direct @google/generative-ai call — NOT the compute service
    const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genai.getGenerativeModel({ model: MODEL, systemInstruction: SYSTEM_PROMPT });
    ...
} else {
    // Line 112 — always takes this path in production
    console.log("[video] Using deterministic fallback — real analysis via compute service (TODO).");
}
```

```typescript
// Lines 26–33 — the comment explicitly says compute isn't wired yet
/**
 * Placeholder analysis — NOT derived from the submitted video. Gemini
 * cannot fetch a YouTube URL directly (see the route's NOTE below); real
 * per-video analysis needs frame extraction or routing through Backend/AI,
 * neither of which is wired up yet.
 */
```

**What actually happens:**
1. User submits a YouTube URL.
2. Route validates the YouTube ID via `extractYouTubeId(url)`.
3. `&& false` short-circuits the Gemini branch unconditionally.
4. `fallback()` is called, returning hard-coded placeholder strings (`"Pending full review"` for all fields).
5. Result is written to Next.js's own `video_analysis` Postgres table (via `@/lib/db`).
6. Response includes `preliminary: true` to signal the UI this is a placeholder.

**No HTTP request is made to `http://localhost:8000/api/v1/compute/video/analyze`.**

---

### 2. AI Service Side — `Backend/AI/app/api/routes/video.py`

**Status: FULLY IMPLEMENTED. Enqueues real ARQ jobs. Gemini call is real (not a stub).**

[`app/api/routes/video.py`](file:///c:/Users/Mrigank%20Singh/Desktop/Athlasx/Backend/AI/app/api/routes/video.py):
- `POST /api/v1/compute/video/analyze` → calls `video_analysis.submit_video_analysis()`
- `GET /api/v1/compute/video/status/{task_id}` → polls task status
- `GET /api/v1/compute/video/player/{player_id}` → role-filtered results

[`app/services/video_analysis.py`](file:///c:/Users/Mrigank%20Singh/Desktop/Athlasx/Backend/AI/app/services/video_analysis.py):
- Line 107: `await queue.enqueue_job("video_analyze", task.id)` — **real ARQ enqueue**
- Line 136: `result = await gemini.analyze_video(urls, VIDEO_ANALYSIS_SYSTEM_PROMPT, _build_user_prompt(req_like))` — **real Gemini call** via `GeminiClient.analyze_video()`

[`app/workers/jobs.py`](file:///c:/Users/Mrigank%20Singh/Desktop/Athlasx/Backend/AI/app/workers/jobs.py):
- Lines 38–53: `video_analyze()` acquires the `_VIDEO_SEMAPHORE`, opens a DB session, calls `video_analysis.process_video_task()` — **real implementation**.

[`app/core/gemini_client.py`](file:///c:/Users/Mrigank%20Singh/Desktop/Athlasx/Backend/AI/app/core/gemini_client.py):
- Line 111: `types.Part(file_data=types.FileData(file_uri=url))` — sends YouTube URL to Gemini as FileData (the native google-genai SDK supports this for video understanding).
- Line 194: `self._client.aio.models.generate_content(...)` — **real async Gemini API call**.

---

### 3. ENV VARS — Video Analysis

| Variable | Next.js `.env.local.example` | Compute `config.py` | Compute `docker-compose.dev.yml` |
|---|---|---|---|
| `GEMINI_API_KEY` | ❌ NOT PRESENT | ✅ `gemini_api_key: str = ""` (line 37) | ✅ `GEMINI_API_KEY: ${GEMINI_API_KEY:-}` (line 54) |
| `GEMINI_VIDEO_MODEL` | ❌ NOT PRESENT | ✅ defaults `"gemini-3.1-pro-preview"` (line 40) | ✅ `${GEMINI_VIDEO_MODEL:-gemini-3.1-pro-preview}` (line 55) |
| `GEMINI_TEXT_MODEL` | ❌ NOT PRESENT | ✅ defaults `"gemini-3.5-flash"` (line 41) | ✅ present (line 56) |
| `GEMINI_OCR_MODEL` | ❌ NOT PRESENT | ✅ defaults `"gemini-3.5-flash"` (line 43) | ✅ present (line 57) |

**Findings:**
- The Next.js `.env.local.example` does **not** reference `GEMINI_API_KEY` at all. The behaviour route does reference `process.env.GEMINI_API_KEY` (line 71 of behaviour/route.ts), but it's absent from the template — frontend devs must know to add it manually.
- No `infra/.env.template` file exists. The compute service has its own `docker-compose.dev.yml` which correctly passes all Gemini vars through from the host shell environment.
- The three model env vars (`GEMINI_VIDEO_MODEL`, `GEMINI_TEXT_MODEL`, `GEMINI_OCR_MODEL`) are correctly wired in the compute service and default to reasonable values. They are NOT referenced by the Next.js side (the Next.js routes use the `@google/generative-ai` SDK directly with hardcoded model strings, not the compute service).

---

### 4. DATA FLOW — Video Analysis

**Intended flow (per architecture doc):**
```
Browser → POST /api/onboarding/video (Next.js)
  → Next.js calls POST /api/v1/compute/video/analyze (compute service)
  → Compute: validate + rate-limit → create VideoAnalysisTask (PENDING) → enqueue ARQ job
  → ARQ worker: PROCESSING → gemini.analyze_video() → store VideoAnalysisResult → COMPLETE
  → Next.js polls GET /api/v1/compute/video/status/{task_id} until COMPLETE
  → Next.js writes result to its own `video_analysis` table
  → Returns result to browser
```

**Actual flow:**
```
Browser → POST /api/onboarding/video (Next.js)
  → Next.js: `&& false` disables Gemini branch entirely
  → fallback() returns hardcoded placeholder strings
  → Next.js writes placeholder to its own `video_analysis` table
  → Returns { preliminary: true, ...placeholder } to browser
  ✗ CHAIN BREAKS IMMEDIATELY — compute service is NEVER called
```

**Where the chain breaks:** Line 96 of `app/api/onboarding/video/route.ts` — the `&& false` guard permanently bypasses any real analysis. The compute service's video endpoint is never called.

---

## MODULE 2: PSYCHOLOGICAL / BEHAVIOUR ASSESSMENT

### 1. Next.js Side — `app/api/onboarding/behaviour/route.ts`

**Status: PARTIAL STUB. Has a real Gemini call (via @google/generative-ai directly), but uses the wrong schema and does NOT call the compute service.**

[`app/api/onboarding/behaviour/route.ts`](file:///c:/Users/Mrigank%20Singh/Desktop/Athlasx/app/api/onboarding/behaviour/route.ts):

**Critical lines:**

```typescript
// Line 71 — Gemini is called when GEMINI_API_KEY is set, but directly, not via compute
if (process.env.GEMINI_API_KEY) {
    try {
        const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genai.getGenerativeModel({ model: MODEL, systemInstruction: SYSTEM_PROMPT });
        const resp = await model.generateContent(
            `MCQ answers: ${JSON.stringify(answers)}. Free text: ${freeText}`
        );
        ...
    }
} else {
    // Line 85 — fallback when no key
    console.log("[behaviour] GEMINI_API_KEY not set — using deterministic fallback analysis.");
}
```

**Schema divergences from compute service:**
- Input: This route accepts `mcq_answers` (10 questions) + `free_text` — a simplified form, **not** the ACSI-28 + lie scale + 10 scenarios + 5 open-ended questions that the compute service's `PsychAnalyzeRequest` requires.
- Output: This route produces `{ strengths, gaps, mental_rating, coaching_tip }` — does not match the compute service's rich `PsychAnalysisResult` schema (which has `acsi_subscale_scores`, `scout_summary`, `player_development_summary`, `response_quality_flags`, `mandatory_caveats`, etc.).
- The system prompt (line 7–9) is a simplified version: `"Return ONLY valid JSON (no markdown): {strengths: string[], gaps: string[], mental_rating: number (0-100), coaching_tip: string}"` — not the full engineering doc prompt.
- Pre-processing (subscale aggregation, reverse-scoring items 27/28, lie-scale detection, response inconsistency flagging) is **entirely absent** from the Next.js route.
- Result is stored in Next.js's own `behavioral_assessment` table, not the compute service's `psychology_assessment_results` table.

**What actually happens:**
1. User submits 10 MCQ answers + free text.
2. If `GEMINI_API_KEY` is set, a direct `@google/generative-ai` call is made (no compute service involvement).
3. If key is absent, `fallbackAnalysis()` computes a rule-based `mental_rating`.
4. Result written to Next.js `behavioral_assessment` table.

**No HTTP request is made to `http://localhost:8000/api/v1/compute/psych/analyze`.**

---

### 2. AI Service Side — `Backend/AI/app/api/routes/psych.py`

**Status: FULLY IMPLEMENTED. Enqueues real ARQ jobs. Gemini call is real. Full ACSI-28 preprocessing pipeline exists.**

[`app/api/routes/psych.py`](file:///c:/Users/Mrigank%20Singh/Desktop/Athlasx/Backend/AI/app/api/routes/psych.py):
- `POST /api/v1/compute/psych/analyze` → calls `psychology.submit_psych_analysis()`
- `GET /api/v1/compute/psych/questionnaire` → returns the full ACSI-28 instrument
- `GET /api/v1/compute/psych/status/{task_id}` → polls + role-filters result
- `GET /api/v1/compute/psych/player/{player_id}` → 3-tier role-filtered view

[`app/services/psychology.py`](file:///c:/Users/Mrigank%20Singh/Desktop/Athlasx/Backend/AI/app/services/psychology.py):
- Line 72: `await queue.enqueue_job("psych_analyze", task.id)` — **real ARQ enqueue**
- Line 102: `result = await gemini.analyze_text(PSYCH_ANALYSIS_SYSTEM_PROMPT, user_prompt)` — **real Gemini call**

Pre-processing pipeline (`app/services/preprocessing.py`) runs server-side:
subscale aggregation, reverse scoring (items 27/28), lie-scale detection, open-ended vagueness detection, response inconsistency detection.

---

### 3. DATA FLOW — Psychological Assessment

**Intended flow:**
```
Browser → POST /api/onboarding/behaviour (Next.js)
  → Next.js calls POST /api/v1/compute/psych/analyze (compute service)
  → Compute: rate-limit (1/30 days) → create PsychologyAssessmentTask → enqueue ARQ job
  → Worker: preprocessing → gemini.analyze_text() → finalize + validate → store result → COMPLETE
  → Next.js polls GET /api/v1/compute/psych/status/{task_id} until COMPLETE
  → Returns role-filtered profile to browser
```

**Actual flow:**
```
Browser → POST /api/onboarding/behaviour (Next.js)
  → Next.js: direct `@google/generative-ai` call (if GEMINI_API_KEY set) with simplified schema
    OR deterministic fallback
  → Writes simplified result to Next.js `behavioral_assessment` table
  ✗ Compute service NEVER called
  ✗ ACSI-28 preprocessing NEVER runs
  ✗ Mandatory caveats NEVER generated
  ✗ 30-day rate limit NEVER enforced
  ✗ 3-tier role filtering NEVER applied
```

**Where the chain breaks:** The behaviour route accepts a different, simplified payload (`mcq_answers` dict + `free_text`) that cannot map to the compute service's `PsychAnalyzeRequest` without frontend form redesign. The connection is fundamentally structural — not just a missing HTTP call.

---

## MODULE 3: OCR SCORECARD

### 1. Next.js Side — `app/api/onboarding/match/route.ts`

**Status: COMPLETE STUB. No Gemini, no compute service call. MVP hardcoded values.**

[`app/api/onboarding/match/route.ts`](file:///c:/Users/Mrigank%20Singh/Desktop/Athlasx/app/api/onboarding/match/route.ts):

**Critical lines:**

```typescript
// Lines 16–23 — TODO comment acknowledges OCR pipeline is missing
// TODO: Production OCR pipeline
//   1. Push scorecard to GCS / S3.
//   2. Run Vision API or Tesseract.js to extract...
//   3. If confidence >= 0.80 → ocr_status = 'VERIFIED'...

// Lines 58–60 — MVP stub: hardcoded values
// MVP simulated OCR — always auto-verified.
const ocrStatus = "VERIFIED";
const pts = 3;
```

**What actually happens:**
1. User uploads a scorecard image as multipart form data.
2. Image is saved to storage via `saveUpload()`.
3. `ocrStatus = "VERIFIED"` is hardcoded — always auto-approved.
4. `pts = 3` is hardcoded.
5. No OCR extraction is performed. No image is sent to any AI service.
6. Written to Next.js's own `match_logs` table.

**Critical discrepancy:** The compute service mandates `review_status = PENDING_REVIEW` (never auto-committed). The Next.js route does the opposite — it always sets `ocr_status = "VERIFIED"` and auto-approves. This is a **data-integrity conflict** that must be resolved before integration.

**No HTTP request is made to `http://localhost:8000/api/v1/compute/ocr/scorecard`.**

---

### 2. AI Service Side — `Backend/AI/app/api/routes/ocr.py`

**Status: FULLY IMPLEMENTED. Enqueues real ARQ jobs. Gemini image analysis is real.**

[`app/api/routes/ocr.py`](file:///c:/Users/Mrigank%20Singh/Desktop/Athlasx/Backend/AI/app/api/routes/ocr.py):
- `POST /api/v1/compute/ocr/scorecard` → calls `ocr.submit_ocr_scorecard()`
- `GET /api/v1/compute/ocr/status/{task_id}` → polls task status

[`app/services/ocr.py`](file:///c:/Users/Mrigank%20Singh/Desktop/Athlasx/Backend/AI/app/services/ocr.py):
- Line 67: `await queue.enqueue_job("ocr_scorecard", task.id)` — **real ARQ enqueue**
- Line 88: `result = await gemini.analyze_image(image_bytes, mime, OCR_SCORECARD_SYSTEM_PROMPT, user_prompt)` — **real Gemini call**
- Line 116: `review_status` is always `PENDING_REVIEW` — never auto-committed.

**Role gating:** Only `ACADEMY_ADMIN`, `TOURNAMENT_ORGANIZER`, `ADMIN`, `ATHLASX_ADMIN` may submit scorecards. The Next.js route has no role gating (any authenticated Next.js session can call it).

---

### 3. DATA FLOW — OCR Scorecard

**Intended flow:**
```
Browser → POST /api/onboarding/match (Next.js, multipart)
  → Next.js saves image, calls POST /api/v1/compute/ocr/scorecard (compute service)
  → Compute: admin-role check → rate-limit (100/admin/day) → create OcrTask → enqueue ARQ job
  → Worker: PROCESSING → gemini.analyze_image() → validate OcrScorecardResult → store → COMPLETE
  → Next.js polls GET /api/v1/compute/ocr/status/{task_id} until COMPLETE
  → Human reviewer approves in admin flow → commits to match_logs
```

**Actual flow:**
```
Browser → POST /api/onboarding/match (Next.js, multipart)
  → Next.js saves file, sets ocrStatus = "VERIFIED" (hardcoded)
  → Writes to match_logs with pts = 3 (hardcoded)
  ✗ Compute service NEVER called
  ✗ No OCR extraction performed
  ✗ Auto-verified (opposite of compute's PENDING_REVIEW design)
  ✗ No admin role check
  ✗ No rate limiting
```

**Where the chain breaks:** Entirely — no call is made and the MVP behavior is architecturally inverted relative to the compute service's design (auto-verify vs. always-PENDING_REVIEW).

---

## ENV VARS — COMPLETE PICTURE

### Next.js `.env.local.example`
```
DATABASE_URL=...           # Neon Postgres for Next.js
NEXTAUTH_SECRET=...
NEXTAUTH_URL=...
NEXT_PUBLIC_APP_URL=...
NEXT_PUBLIC_SUPABASE_URL=  # empty
NEXT_PUBLIC_SUPABASE_ANON_KEY=  # empty
SUPABASE_SERVICE_ROLE_KEY=  # empty
```
**Missing entirely:** `GEMINI_API_KEY`, `COMPUTE_SERVICE_URL` (for calling Backend/AI), `COMPUTE_SERVICE_JWT_SECRET` (if bridging auth).

### Compute Service `config.py` + `docker-compose.dev.yml`
| Variable | Default in config.py | Status |
|---|---|---|
| `GEMINI_API_KEY` | `""` | ✅ Defined; blank = no live calls |
| `GEMINI_VIDEO_MODEL` | `"gemini-3.1-pro-preview"` | ✅ Configurable |
| `GEMINI_TEXT_MODEL` | `"gemini-3.5-flash"` | ✅ Configurable |
| `GEMINI_OCR_MODEL` | `"gemini-3.5-flash"` | ✅ Configurable |
| `DATABASE_URL` | `postgresql+asyncpg://...@localhost:5433/...` | ✅ Isolated dev DB |
| `REDIS_URL` | `redis://localhost:6380/1` | ✅ Isolated dev Redis |
| `AUTH_JWT_SECRET` | `"dev-only-insecure-..."` | ✅ Standalone HS256 |

**Missing from compute config:** `GEMINI_VIDEO_THINKING_BUDGET`, `GEMINI_TEXT_THINKING_BUDGET`, `GEMINI_OCR_THINKING_BUDGET` (to be added per Part 3).

---

## AUTH TOKEN MISMATCH (Required Manual Fix)

> ⚠️ **This is a blocker for any integration. DO NOT fix in Next.js source files per constraints.**

**Problem:** The Next.js core uses **Auth.js in database-session mode** — session tokens are opaque
session IDs that Auth.js resolves against the Prisma/Neon database. They do not carry `user_id`/`role`
JWT claims in the `Authorization: Bearer` header format that the compute service expects.

The compute service authenticates via **standalone HS256 JWT** with `AUTH_JWT_SECRET`, expecting
`{ sub/user_id, role, iat, exp }` claims — a format Auth.js does NOT produce.

**Required manual fix (documented, not coded):**

Option A — **Shared secret bridge**: When Next.js calls the compute service on behalf of a user,
Next.js's server-side code should mint a short-lived HS256 JWT using the shared `AUTH_JWT_SECRET`,
embedding the user's real `user_id` and `role` claim, then forward it as the `Authorization: Bearer`
header to the compute service. This is the minimal-change path and matches the compute service's
existing `mint_dev_token()` pattern (which must be restricted to `ENVIRONMENT=development` only —
the production minting logic needs to live in Next.js server code, not in the compute service itself).

Option B — **Replace compute auth**: Replace `app/core/security.py`'s standalone verifier with one
that validates Auth.js session tokens (e.g., by looking up the session in the shared Neon DB or via
Auth.js's own token-verification callback). This is more correct long-term but requires the compute
service to share DB access with the Next.js app, which conflicts with the standalone-build intent.

**Recommended:** Option A for V1 integration. Add `COMPUTE_SERVICE_URL` and `COMPUTE_AUTH_SECRET`
to `.env.local.example` as part of the integration work.

---

## SUMMARY TABLE

| Module | Next.js Route | Calls Compute? | Compute Implemented? | ARQ Job Enqueued? | Gemini Called? | Chain Breaks At |
|---|---|---|---|---|---|---|
| Video | `onboarding/video` | ❌ | ✅ | ✅ | ✅ | Next.js `&& false` guard (line 96) |
| Psychology | `onboarding/behaviour` | ❌ | ✅ | ✅ | ✅ (direct) | Schema mismatch + no compute call |
| OCR | `onboarding/match` | ❌ | ✅ | ✅ | ✅ | Hardcoded MVP stub; no compute call |

**In all three cases:** The compute service is fully implemented and production-ready; the Next.js
onboarding routes are not connected to it and must be updated (or new dedicated API routes must be
written) to call the compute service. The auth token format mismatch is a prerequisite blocker that
must be resolved before any connection can work.
