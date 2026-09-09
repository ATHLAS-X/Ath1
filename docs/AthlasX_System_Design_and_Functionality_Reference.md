# AthlasX — System Design & Functionality Reference

_Generated 2026-09-05 against the live `main` branch of `Athlasx.git`, read directly from the repository (not from an earlier snapshot). Covers every file under `src/`, `prisma/`, `tests/`, `scripts/`, and the root config/tooling files. `Old_SportX_Files_Initial/`, the orphaned `Backend/AI/` FastAPI service, and `infra/` have already been removed from this branch as of the most recent commits and are intentionally out of scope — see "Known Gaps" for what that cleanup implicated._

## Contents

1. [Executive Overview](#1-executive-overview)
2. [System Architecture](#2-system-architecture)
3. [Authentication & Authorization Design](#3-authentication--authorization-design)
4. [Data Model (prisma/schema.prisma)](#4-data-model-prismaschemaprisma) — 35 models, 28 enums
5. [Core Domain Library (src/lib)](#5-core-domain-library-srclib) — 34 modules
6. [API Route Reference (src/app/api)](#6-api-route-reference-srcappapi) — 46 routes
7. [Pages, Layouts & Components Reference](#7-pages-layouts--components-reference) — 20 pages, 7 components
8. [Key End-to-End Procedures](#8-key-end-to-end-procedures) — claim, ingest, grading, dossier, academy flows traced across layers
9. [Testing Strategy & Test Suite](#9-testing-strategy--test-suite) — 24 files, ~230 cases
10. [Tooling & Configuration](#10-tooling--configuration)
11. [Known Gaps, Risks & Findings](#11-known-gaps-risks--findings) — read this before treating anything above as a finished system

Sections 4–7 and 9 are grounded, file-by-file walkthroughs — read them like a reference, not top to bottom. Sections 1–3, 8, and 11 are the synthesis: read those straight through first if you want the shape of the system before the detail.

---

## 1. Executive Overview

AthlasX is a cricket talent-scouting and academy-management platform serving Indian district/state cricket associations. It solves a specific problem: getting a player's real match performance — not a self-report, not a coach's opinion — in front of the selectors and academies deciding their future, with a paper trail proving where every number came from.

Four workflows carry the product:

1. **Data ingest** — an association uploads match data (CSV, a documented CricHeroes fixture, OCR, or a structured API sync). Every row is confidence-scored by its source adapter, and every player is matched to a real identity via a name/DOB/district algorithm that refuses to guess when it isn't sure — an ambiguous row becomes a human review task (`IdentityException`), never a silent misattribution.
2. **Claiming** — a player finds their own "shadow" profile (created by ingest before they ever had an account) and takes ownership of it via phone OTP, with a guardian-consent path for minors, per India's DPDP data-protection act.
3. **Blind selection** — a committee of selectors independently grades players against real verified match stats; no selector sees another's grade until the chair explicitly unlocks convergence. This is the single design principle called out most often in the codebase's own comments as the thing that must never regress.
4. **Season tracking, coaching, and academy operations** — squads, weekly form tracking with drop/rise flags, coach advisory notes (explicitly walled off from ever influencing the score), and — ported in from a separate branch — academy batch scheduling, attendance follow-ups, and join-request approval.

Everything scored (the "AthlasX Score," 0–100) is computed exclusively from association-approved match data. Self-reported stats are rejected at the API boundary; coach ratings were structurally removed from the score engine after an internal audit found they could be gamed (documented in the codebase as "DEFECT 1," now fixed).

## 2. System Architecture

```
                      ┌─────────────────────────────┐
                      │        Vercel (bom1)         │
                      │   Next.js 14 App Router      │
                      │                              │
  Browser  ───────────▶  src/app/**  (pages, client   │
                      │  components)                 │
                      │        │                      │
                      │        ▼                      │
                      │  src/app/api/**/route.ts      │
                      │  (46 route handlers)          │
                      │        │                      │
                      │        ▼                      │
                      │  src/lib/**  (34 modules —     │
                      │  auth, identity resolution,   │
                      │  ingest adapters, scoring,    │
                      │  visibility, academy)         │
                      │        │                      │
                      │        ▼                      │
                      │  prisma/schema.prisma          │
                      │  (35 models, 28 enums,         │
                      │   Postgres schema "athlasx")   │
                      └────────┼─────────────────────┘
                               ▼
                      Neon serverless Postgres
                      (same DB also hosts ~30 legacy
                       "SportX" tables in the public
                       schema — isolated via @@schema,
                       never touched by this app)
```

There is no separate backend service in this branch — the entire application is one Next.js deployment. Route handlers call into `src/lib` directly; `src/lib` calls Prisma directly. The only external dependency in the request path is Neon Postgres itself; there is no Redis, no queue, no background job runner (the codebase is explicit about this in several places — dossiers and academy production rankings are computed lazily on read, not by a scheduled job).

## 3. Authentication & Authorization Design

Every authorization decision in this codebase reduces to five chokepoints, each documented in its own file and never reimplemented inline in a route:

| Chokepoint | File | Resolves |
|---|---|---|
| Session identity | `src/lib/require-auth.ts` | Who is the caller, from their own signed JWT cookie — never a client-supplied id |
| Association scope | `src/lib/association-scope.ts` | Which `Association` ids the caller may act on, from their real `AssociationStaff` rows |
| Squad access | `src/lib/squad-access.ts` | Whether the caller may act on one squad — ops, scoped staff, or a real `SquadCoach` row |
| Academy scope | `src/lib/academy/scope.ts` | An `academy_admin`'s own `Academy`, from `Academy.admin_user_id` — never a client-supplied academy id |
| Cross-association visibility | `src/lib/player-visibility.ts` | Whether a player outside the caller's own association may be seen at all, gated by `visibility_tier` |

The pattern that recurs everywhere: **derive identity and scope from something the server already trusts (a signed session, a membership row), never from a value the client typed into a request body.** The API route reference below documents several places where this was previously violated and then fixed — a selector grading "as" the chair by naming the chair in the POST body, a chair unlocking convergence because the route trusted a client-supplied chair id, a route resolving "the most recent session in the entire database" instead of scoping to the caller's association. Each of those is now closed by routing through one of the five chokepoints above instead of trusting request input.

Session mechanics: NextAuth with a single `CredentialsProvider` (email/bcrypt password), JWT session strategy. The deliberate choice documented in `src/lib/auth.ts` is that routes verify sessions via `next-auth/jwt`'s `getToken()` reading the request's own cookie, not `getServerSession()`, specifically so route handlers can be invoked directly with a bare `NextRequest` in tests — the entire integration test suite depends on this. Two flows mint a session without going through the credentials POST at all: `claim/verify` (OTP-based) and `player/onboard` (self-registration) — both use `encodeSessionToken`/`applySessionCookie` from the same file to produce a cookie indistinguishable from a normal sign-in.

---
## 4. Data Model (prisma/schema.prisma)

### Schema-level notes

- **Postgres schema isolation**: every model is pinned to `@@schema("athlasx")`, and the `datasource` block restricts Prisma to `schemas = ["athlasx"]`. This is deliberate: the same Neon database already hosts ~30 legacy tables from an archived "SportX" codebase in the `public` schema (same table names, different shapes), and `@@schema` guarantees `prisma migrate`/`db push` never touches them.
- **Naming convention**: PascalCase Prisma model names map to snake_case Postgres tables via `@@map`; field names are already snake_case so they match `src/types/index.ts` 1:1 with no re-mapping at the API boundary.
- **IDs**: every model uses a `String @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid` — Postgres-generated UUIDs, not Prisma's `cuid()`/`uuid()`.
- **`ConvergenceView` is not a table.** It's a read model computed at query time from `Grade` rows (documented in `src/types/index.ts`), not a Prisma model — mentioned here so its absence from the model list below isn't mistaken for an omission.
- Comment markers like `W1`–`W8` throughout the schema refer to workflow/ticket numbers from the project's "Pivot Document" (the product spec this codebase implements), e.g. W1 = ingest, W2 = claim/identity, W4 = selection committee, W5 = weekly tracking, W7 = squads, W8 = academy matching.

### Enums

| Enum | Values | Represents |
|---|---|---|
| `UserRole` | `player, selection_panel, coach, association, athlasx_ops, academy_admin` | The six platform roles a `User` account can hold; drives route-level authorization gates. |
| `BattingStyle` | `Right-handed, Left-handed` | A player's batting handedness. |
| `BowlingStyleEnum` | `Right-arm Fast/Medium/Off-spin/Leg-spin, Left-arm Fast/Medium/Orthodox/Unorthodox, None` | A player's bowling style, or `None` for non-bowlers. |
| `PlayingRoleEnum` | `Batsman, Bowler, All-rounder, Wicket-keeper Batsman` | A player's primary playing role; used to select which score dimensions apply. |
| `Format` | `T20, ODI, Test, T10` | Cricket match format; also used as a player's array of preferred formats. |
| `TournamentLevel` | `local, district, state, national` | Competitive tier of a tournament; feeds the score engine's TQI (tournament quality index) weighting. |
| `VisibilityTier` | `association_only, cross_association, franchise_scout` | Who beyond the player's own association may see their profile. `association_only` is the default (own association's staff + unrestricted `athlasx_ops`); `cross_association` is opt-in visibility to any association's staff; `franchise_scout` is opt-in, additionally gated adult-only and behind a `FRANCHISE_SCOUT_ENABLED` feature flag — off by default, no scout-facing role exists yet on this branch. |
| `AssociationType` | `state, district` | Tier of a cricket association in the hierarchy. |
| `IngestMethod` | `api_sync, structured_parser, ocr, excel_mapper, manual` | How a Match/Performance/IngestJob's data was captured. |
| `ApprovalStatus` | `pending, approved, rejected` | Association-side review state on ingested `Match`/`Performance` rows. |
| `ClaimStatus` | `unclaimed, pending_verification, claimed` | State-machine status of a `PlayerProfile`'s ownership claim. |
| `ConsentStatus` | `not_required, pending, granted, withdrawn` | DPDP-style consent state, on both `PlayerProfile` and `PlayerClaim`. |
| `GradeStatus` | `not_started, in_progress, submitted` | Status of a selector's `Grade` on a player (defaults to `submitted` — grades are written atomically, not drafted). |
| `SelectionStatus` | `open, grading, converging, locked` | Lifecycle of a `SelectionSession`: open → grading → converging (after chair unlocks) → locked (roster final). |
| `FlagType` | `form_drop, skill_below_threshold, on_form, none` | Trend classification on a `PlayerWeek`/`TrendAlert`. |
| `TrialCycleStatus` | `upcoming, registration_open, registration_closed, in_progress, completed` | Lifecycle of a `TrialCycle`. |
| `FeeStatus` | `pending, paid, waived` | Payment state of a trial `Registration`. |
| `ProfileSource` | `ingest, self_registered, academy_join_request` | How a `PlayerProfile` originated — from scorecard ingest, self-registration, or an approved academy join request. |
| `ClaimVerificationMethod` | `phone_otp, guardian_otp` | Which OTP channel a `PlayerClaim`/`PhoneOtp` uses — the player's own phone (adult) or the guardian's (minor). |
| `IdentityExceptionReason` | `AMBIGUOUS_MATCH, MULTIPLE_CANDIDATES` | Why an ingested performance row couldn't be auto-attributed to a player. |
| `IdentityExceptionStatus` | `OPEN, CONFIRMED, SPLIT, MERGED, REJECTED` | Resolution state machine for an `IdentityException`: opens on ambiguity, then a human confirms one candidate, splits into a new shadow profile, merges onto an existing one, or rejects the row. |
| `AcademyBatchStatus` | `ACTIVE, ARCHIVED` | Whether an `AcademyBatch` (training group) is current or retired. |
| `AcademyBatchMembershipStatus` | `active, removed` | A player's current standing in a batch roster (soft-delete, not a hard row delete). |
| `AcademyJoinRequestStatus` | `pending, approved, rejected` | State machine for a candidate's request to join an academy. |
| `AcademyAttendanceFlagStatus` | `dismissed, snoozed` | A coach's manual override decision on a computed attendance-flag warning (the flag itself is computed, not stored — only the override is). |
| `AcademyMatchStatus` | `unmatched, suggested, confirmed, rejected` | State machine for reconciling a raw ingested academy-name string against the `Academy` registry. |
| `SquadStatus` | `draft, locked` | Whether a `Squad` roster can still be edited. |
| `IngestJobStatus` | `pending_review, approved, rejected, processing` | Lifecycle of a bulk `IngestJob` (a batch of scorecards/CSV/API sync awaiting association review). |

28 enums total.

### ### Identity & Claiming

**`User`** — an optional account; most players never have one (shadow profiles from ingest exist independently). Key fields: `email`/`phone` unique, `role` (`UserRole`), `linked_player_id`/`linked_staff_id` (loose pointers, not FK-enforced relations). Relations: one-to-one with `PlayerProfile`, `CoachProfile`, `SelectorProfile`, `Academy` (as admin); one-to-many with `Grade` (as `selector`), `AssociationStaff`, `IdentityException` (as resolver), `SquadCoach`, `CoachAdvisoryNote` (as coach).

**`PlayerProfile`** — the central player entity, exists independently of any `User`. Key fields: `claim_status` (default `unclaimed`), `consent_status` (default `not_required`), `visibility_tier` (default `association_only` — the privacy-by-default rule), `profile_source`, `athlasx_score` (nullable float, presumably the cached score-engine output), `preferred_formats` (`Format[]`). Relations: belongs to one optional `Association`; has many `Performance`, `Registration`, `Dossier`, `Grade`, `PlayerWeek`, `TrendAlert`, `SquadPlayer`, `CoachAdvisoryNote`, `SessionAttendance`, `AcademyBatchMembership`, `AcademyJoinRequest`, `AcademyAttendanceFlag`; has one optional `PlayerClaim`. Indexed on `claim_status` and `association_id`.

**`PlayerClaim`** — the W2 claim-and-consent record; one-to-one with `PlayerProfile` (`onDelete: Cascade`). Key fields: `method` (`ClaimVerificationMethod`), `is_minor`, `guardian_*` fields (only populated for minors), `consent_status` (default `pending`), `consent_granted_at`/`consent_withdrawn_at`/`verified_at` timestamps. Has many `PhoneOtp`.

**`PhoneOtp`** — one-time codes for claim verification, belongs to one `PlayerClaim` (cascade delete). Key fields: `code_hash` (bcrypt, never plaintext — see the `otp.test.ts` notes below), `purpose`, `attempts` (default 0, attempt-limited), `expires_at`, `consumed_at` (single-use). Indexed on `claim_id` and `expires_at`.

**`Association`** — a state or district cricket body. Self-referential hierarchy (`parent`/`children` via the `AssociationHierarchy` relation name) lets district associations nest under state ones. Key fields: `type` (`AssociationType`), `data_sharing_signed` (default `false`). Has many `PlayerProfile`, `Tournament`, `TrialCycle`, `SelectionSession`, `AssociationStaff`, `IdentityException`, `IngestJob`, `Squad`. Indexed on `type`.

**`AssociationStaff`** — the join table that is the *sole* source of truth for association-scoped access (per an in-schema comment, `src/lib/association-scope.ts` derives a caller's allowed association IDs from this table and never trusts a client-supplied `associationId`). Composite-unique on `[association_id, user_id]`; `is_lead` boolean; cascades on delete of either parent. Ported from an earlier branch's `association_staff` design.

**`IdentityException`** — the W2 exception queue for ambiguous ingested rows. Belongs to one `Association` (cascade) and optionally one `Match`. Key fields: `reason` (`IdentityExceptionReason`), `candidate_player_ids` (`String[]`, default empty), `performance_snapshot` (`Json?` — holds the skipped `NormalizedPerformanceRow` so confirm/split/merge can later write it as a real `Performance`), `status` (default `OPEN`), `resolved_by`/`resolved_at`. Indexed on `association_id` and `status`.

### ### Associations & Ingest

**`Tournament`** — belongs to one `Association`. Key fields: `format` (`Format`), `level` (`TournamentLevel` — feeds score-engine weighting), `age_category`, `start_date`/`end_date`. Has many `Match`.

**`Match`** — belongs to one `Tournament`. Key fields: `confidence` (float, ingest-adapter confidence score), `ingest_method`, `association_approval_status` (default `pending`). Has many `Performance` and `IdentityException`.

**`Performance`** — one player's batting/bowling/fielding line in one match. Belongs to one `Match` and one `PlayerProfile`. Nearly every stat field is nullable (`batting_runs`, `bowling_wickets`, `catches`, etc. — a bowler-only performance has null batting fields and vice versa). Carries its own `source`, `ingest_method`, `confidence_score`, and `association_approval_status` (default `pending`) — i.e. approval is tracked per-performance, not only per-match. Indexed on `player_id`. **Important business rule surfaced by the integration tests**: several API routes (`my-record`, `dashboard`, `candidate-pool`, `coach/squad`) must only ever read `Performance` rows where `association_approval_status = 'approved'` — pending/unapproved rows must not contribute to a player's visible stats (see `tests/integration/fake-performance-sweep.test.ts` and `grading-quickview.test.ts`).

**`IngestJob`** — a bulk-ingest batch record. Optionally belongs to an `Association`. Key fields: `method` (`IngestMethod`), `status` (`IngestJobStatus`, default `pending_review`), `confidence`, `conflicts` (default 0), `raw_payload` (`Json?` — the `NormalizedIngestPayload`; nullable only because 4 pre-existing seed rows predate this field, but the real approve path requires it and fails loudly if absent).

**`AcademyMatchCandidate`** — raw academy-name strings seen during ingest, queued for fuzzy-match reconciliation against the `Academy` registry (never auto-merged). Key fields: `similarity_score` (float), `status` (`AcademyMatchStatus`, default `unmatched`), optional `suggested_academy`. Indexed on `status`.

### ### Performance & Matches

(Tournament/Match/Performance are grouped above under Associations & Ingest since they are ingest-provenance-carrying; cross-referenced here as the performance data backbone that `Dossier`, `Grade`, and the score engine all read from.)

### ### Trial Cycles, Dossiers & Selection

**`TrialCycle`** — belongs to one `Association`. Key fields: `dob_window_start`/`dob_window_end` (age-eligibility window), `fee_amount`, `registration_opens`/`registration_closes`, `status` (`TrialCycleStatus`, default `upcoming`). Has many `TrialVenue`, `Registration`, `SelectionSession`, `Squad`.

**`TrialVenue`** — belongs to one `TrialCycle` (cascade delete). Has many `Registration`.

**`Registration`** — a player's sign-up for a trial cycle at a specific venue. Belongs to `TrialCycle`, `PlayerProfile`, `TrialVenue`. Key fields: `fee_status` (default `pending`), `documents_uploaded`/`footage_attached`/`checked_in` booleans. Has one optional `Dossier`. Indexed on `trial_cycle_id`.

**`Dossier`** — a generated scouting report, one-to-one with `Registration` (`@unique registration_id`). Key fields: `has_match_history`, `percentile_vs_cohort`, `contents_snapshot` (`Json` — batting/bowling 0-10 scores, match_count, data_sources, cohort_size, recent_form).

**`SelectionSession`** — the W4 selection-committee workspace for a trial cycle. Belongs to `TrialCycle` and `Association`. Key fields: `status` (`SelectionStatus`, default `open`), `chair_id` (a raw `User` id, not a relation), `squad_size_target`, `convergence_unlocked_at`/`squad_locked_at` (nullable timestamps that gate the blind-grading boundary — a schema comment notes this is enforced server-side in the grading API routes, not client state). Has many `Grade`, `Selection`, `OmissionRationale`.

**`Grade`** (blind grading) — one selector's private rating of one player in one session. Belongs to `SelectionSession` (cascade), `selector` (`User`), and `PlayerProfile`. Key fields: `overall_grade` (Int), `status` (default `submitted`). **Unique constraint on `[selection_session_id, selector_id, player_id]`** — this is what makes re-grading idempotent (an upsert, not a duplicate row) per the integration tests. Indexed on `selection_session_id`.

**`Selection`** / **`OmissionRationale`** — the outcome of convergence: `Selection` records a player chosen with a `rationale` and `decided_by` (`String[]` of selector ids); `OmissionRationale` records why a graded player was *not* selected. Both belong to a `SelectionSession`.

### ### In-season Tracking

**`PlayerWeek`** (W5) — one player's weekly rollup. Belongs to `PlayerProfile`. Key fields: `rolling_4week_average`, `score_delta`, `flag_type` (default `none`), `coach_note` (comment notes a 200-char cap enforced at the API boundary, not in the schema), `fitness_rating`/`behaviour_rating` (1-5, comment: "coach-supervised only — never self-reported"). **Unique on `[player_id, week_start]`** — one row per player per week. Indexed on `flag_type`.

**`TrendAlert`** — belongs to `PlayerProfile`. Key fields: `flag_type`, `consecutive_declining_weeks`, `skill_dimension`, `notified_coach`/`notified_selector` booleans. Indexed on `player_id`.

### ### Squads & Coaching

**`CoachProfile`** — belongs to a `User` (1:1) and an `Association`. Notable: `squad_ids` (`String[]`) is called out in a schema comment as a **pre-existing, unused placeholder** — confirmed by repo-wide grep that no route or component reads/writes it — superseded by the real `SquadCoach` join table; deliberately left in place rather than removed.

**`Squad`** (W7) — belongs to one `Association`, softly linked (nullable FK) to a `TrialCycle` it may have originated from — "a squad outlives the selection session that built it, and not every squad need trace back to one." Key fields: `status` (`SquadStatus`, default `draft`). Has many `SquadCoach`, `SquadPlayer`, `TrainingSession`, `CoachAdvisoryNote`. Indexed on `association_id`. A schema comment records the history here: the API route for coach/squad previously had no real Squad concept and just returned the most-recently-created `SelectionSession` — this model is the fix.

**`SquadCoach`** — coach-to-squad membership, mirrors `AssociationStaff`'s shape (`squad_id`/`user_id`/`is_lead`), same "membership row is the only source of access" discipline one level down. Unique on `[squad_id, user_id]`; cascades on either parent's delete.

**`SquadPlayer`** — roster membership. Unique on `[squad_id, player_id]`; indexed on `player_id`; cascades on squad delete (not on player delete).

**`CoachAdvisoryNote`** — a coach's advisory-only rating of a squad player. Schema comment is explicit: this model is "DEFECT 1's fix" and **deliberately has no relationship of any kind to `Grade`/`Selection`/`SelectionSession`** — a coach's `user_id` has no path into the scoring tables, so even a buggy write attempt has nowhere to land, and the score engine (`calculateAthlasXScore`) never reads this table. Key fields: `fitness_rating`/`behaviour_rating` (1-5, advisory only), free-text `note`. Indexed on `[squad_id, player_id]`.

**`TrainingSession`** / **`SessionAttendance`** — a squad's training calendar and per-player attendance. `SessionAttendance` is unique on `[training_session_id, player_id]`, cascades on session delete. This is explicitly a *different* attendance concept from the academy-scoped `AcademyAttendanceFlag` below (squad training attendance vs. academy batch attendance-flag overlay).

### ### Academy — batches, attendance, join-requests

This subsystem was **ported from a separate branch (`origin/v1-features-sparsh`)** onto the main Prisma/`src` shape — the schema comments repeatedly flag this provenance.

**`Academy`** — the academy registry. Key fields: `name_variants` (`String[]`, used for fuzzy matching), `verified` (default `false`), `players_at_district_plus` (counter), `admin_user_id` (nullable, unique — an academy created purely from ingest matching may have no admin yet). Has many `AcademyMatchCandidate`, `AcademyBatch`, `AcademyJoinRequest`, `AcademyAttendanceFlag`.

**`AcademyBatch`** — a training group/cohort within an academy. Belongs to `Academy` (cascade). Key fields: `schedule_days` (`String[]`), `schedule_time`, `batch_status` (`AcademyBatchStatus`, default `ACTIVE`), `max_players` (nullable cap), `created_by_user_id`. Has many `AcademyBatchMembership`. Indexed on `academy_id`.

**`AcademyBatchMembership`** — a player's roster slot in a batch. Belongs to `AcademyBatch` and `PlayerProfile` (both cascade). Key fields: `status` (`AcademyBatchMembershipStatus`, default `active` — removal is a soft status flip to `removed`, not a row delete). Unique on `[batch_id, player_id]`; indexed on `player_id`.

**`AcademyJoinRequest`** — a candidate's request to join an academy, which may or may not yet be linked to a `PlayerProfile`. Key fields: `status` (default `pending`), `reviewed_by`/`reviewed_at`. Approving a request (per the integration tests) creates a real `PlayerProfile` plus an `AcademyBatchMembership` row in one action; a request can only be approved once (a second approval attempt 404s). Indexed on `[academy_id, status]`.

**`AcademyAttendanceFlag`** — explicitly a **state-overlay table, not the computed flag itself**. A schema comment clarifies: the "N absences in a row" warning is computed at request time from `AcademyBatchMembership`/attendance history (`src/lib/academy/attendance-flags.ts`); this table stores only a coach's dismiss/snooze *decision* about that computed warning. Key fields: `status` (`dismissed`/`snoozed`), `snoozed_until`, `duration_days`. **Unique on `[academy_id, player_id]`** — one override state per player per academy. Cascades on either parent's delete.

**Cross-cutting note on this subsystem**: `tests/helpers/test-db.ts`'s `resetDb()` TRUNCATE list (used between every integration-test suite) does **not** include `academy_batches`, `academy_batch_memberships`, `academy_join_requests`, or `academy_attendance_flags` — only the older `academies` and `academy_match_candidates` tables are truncated. This looks like an oversight from when the academy-batch subsystem was ported in; the academy batch integration tests appear to rely on `beforeEach` creating fresh fixtures rather than on a clean table, but it's worth flagging for anyone extending that test file.

### ### Auth & Users

**`SelectorProfile`** — belongs to a `User` (1:1) and an `Association`. Minimal — `full_name`, `avatar_url`.

(`User`, `AssociationStaff`, `CoachProfile` are documented above under Identity & Claiming / Squads & Coaching respectively, since their relationships are more meaningfully grouped there — they are the auth-adjacent staff-profile models.)

### Constraints and business-rule summary

- **Unique constraints encoding business rules**: `Grade[selection_session_id, selector_id, player_id]` (one grade per selector per player per session — makes re-grading an upsert); `PlayerWeek[player_id, week_start]` (one rollup per player per week); `AcademyBatchMembership[batch_id, player_id]` and `SquadPlayer[squad_id, player_id]` and `SquadCoach[squad_id, user_id]` and `AssociationStaff[association_id, user_id]` (all membership tables prevent duplicate rostering); `AcademyAttendanceFlag[academy_id, player_id]` (one override per player per academy); `SessionAttendance[training_session_id, player_id]`; `PlayerClaim.player_id`, `Dossier.registration_id`, `User.email`, `User.phone`, `PlayerProfile.user_id`, `CoachProfile.user_id`, `SelectorProfile.user_id`, `Academy.admin_user_id` are all `@unique` 1:1 anchors.
- **Cascade deletes** are used consistently for membership/child rows whose parent's deletion should remove them: `AssociationStaff`, `IdentityException`, `PlayerClaim`, `PhoneOtp`, `AcademyBatch`, `AcademyBatchMembership`, `AcademyJoinRequest` (cascade on academy, not on player), `AcademyAttendanceFlag`, `SquadCoach`, `SquadPlayer` (cascade on squad only), `Grade`, `CoachAdvisoryNote`, `TrainingSession`, `SessionAttendance` all cascade from their owning parent. Notably `Match`, `Tournament`, `Performance`, and most `PlayerProfile` relations do **not** cascade — player and match/performance history is meant to survive deletion of upstream rows (or such deletes are presumably disallowed at the app layer).
- **Default values that encode policy**: `PlayerProfile.visibility_tier` defaults to `association_only` (privacy-by-default); `PlayerProfile.claim_status` defaults to `unclaimed` and `consent_status` to `not_required` (a shadow/ingested profile starts with no consent obligation until claimed); `Match`/`Performance.association_approval_status` default to `pending` (nothing is visible/scored until an association approves it); `Grade.status` defaults to `submitted` (no draft state in practice); `SelectionSession.status` defaults to `open`; `Squad.status` defaults to `draft`; `AcademyBatch.batch_status` defaults to `ACTIVE`; `AcademyBatchMembership.status` defaults to `active`; `IngestJob.status` defaults to `pending_review`.
- **State machines observed from enum usage and tests**:
  - `SelectionStatus`: `open → grading → converging → locked`. `converging`/`locked` are gated by `SelectionSession.convergence_unlocked_at`/`squad_locked_at` timestamps, settable only by the session's `chair_id`, enforced server-side (grading API routes derive the caller's identity from a signed session, never from the request body — see Part 2, S2).
  - `ClaimStatus`: `unclaimed → pending_verification → claimed`, driven by `PlayerClaim`/`PhoneOtp` OTP verification.
  - `ConsentStatus`: `not_required → pending → granted`, and separately `→ withdrawn` at any point after granted; withdrawal must (per the security tests) immediately remove the player from every read path, not just flip the flag.
  - `IdentityExceptionStatus`: `OPEN → {CONFIRMED | SPLIT | MERGED | REJECTED}` — confirm attaches the skipped performance to an existing candidate, split creates a new shadow profile, merge attaches to an explicit different candidate.
  - `IngestJobStatus`: `pending_review → {approved | rejected}`, with `processing` as an in-flight state; approval is transactional — creates `Tournament`/`Match`/`Performance` rows, triggers W2 identity resolution and W8 academy-candidate capture together.
  - `AcademyJoinRequestStatus`: `pending → {approved | rejected}`, single-transition only (double-approve 404s).
  - `AcademyMatchStatus`: `unmatched → suggested → {confirmed | rejected}`, driven by a similarity-score threshold (seed data uses `>= 0.55` to suggest).

### `prisma/seed.ts` summary

A ~200-line one-off dev/fixture seed script (`npx tsx prisma/seed.ts`), intended to "create enough real rows to exercise the W2 claim flow, blind grading, and W8 academy matching end to end" — i.e. a manual/dev-exploration fixture, distinct from the automated test fixtures in `tests/helpers/test-db.ts`. It seeds, in order:
1. One `Association` ("UPCA", Uttar Pradesh state body, `data_sharing_signed: true`).
2. Three `User`s with hashed passwords (`hashPassword`, dev password `athlasx-dev-password`): a selection-panel chair, a second selector, and an association-staff user (made a lead `AssociationStaff` member), each with a matching `SelectorProfile` where applicable.
3. Three "shadow" `PlayerProfile`s — two `ingest`-sourced and unclaimed (Arjun Sharma, Dev Patel), one `self_registered` and already `claimed`/consent `granted` (Rohan Verma).
4. One `TrialCycle` (U-19, `in_progress`) and one `SelectionSession` (`grading` status) chaired by the seeded chair.
5. One `Grade` already submitted by the chair for Arjun Sharma — the comment notes this specifically demonstrates the blind boundary: selector2 querying `/mine` should never see this row.
6. One verified `Academy` ("Tara Cricket Academy") plus three raw ingested-string `AcademyMatchCandidate` rows run through the real `bestSimilarity` function — two score high enough to auto-suggest a match, one ("Prime Sports Academy") deliberately stays `unmatched`.
7. Four weeks of `PlayerWeek` rows for two of the shadow players — one with a declining score trend (triggers `form_drop`), one rising (`on_form`) — plus one `TrendAlert` per player matching that trend.
8. Four `IngestJob` rows spanning `pending_review`, `approved`, and `rejected` statuses with varying confidence/conflict counts, to populate the ingest review UI with realistic states.

The script logs every created id to the console for manual use and disconnects Prisma in a `finally` block.

## 5. Core Domain Library (src/lib)

### Authentication & Security

#### src/lib/auth.ts

**Purpose:** NextAuth configuration and the credential-verification core the rest of the auth system builds on. Defines the `authOptions` object NextAuth uses, plus standalone helpers that let non-NextAuth code (e.g. an OTP-based claim flow) mint a session cookie that is indistinguishable from a normal sign-in.

**Exported functions/procedures:**
- `authenticateWithPassword(email, password)` — normalizes the email (`trim().toLowerCase()`), rejects empty email/password, looks up `db.user.findUnique({ where: { email } })` selecting `id, email, role, password_hash`, returns `null` if no user or no `password_hash`, then verifies via `comparePassword` (bcrypt). Returns a minimal `AuthenticatedUser { id, email, role }` or `null`. No throwing on bad creds — always a clean `null`, so callers can't distinguish "no such user" from "wrong password" (timing/enumeration hygiene).
- `encodeSessionToken(user)` — encodes a JWT with the same claim shape (`id`, `email`, `role`) the CredentialsProvider's `jwt` callback would produce, using `next-auth/jwt`'s `encode` and `NEXTAUTH_SECRET`. Throws if the secret env var is missing. This is what lets a non-NextAuth route (e.g. OTP claim completion) issue a session indistinguishable from a real sign-in.
- `applySessionCookie(res, token)` — sets the session cookie on a `NextResponse`. Chooses `__Secure-next-auth.session-token` vs. plain `next-auth.session-token` based on whether `NEXTAUTH_URL` starts with `https://` or `VERCEL` is set; sets `httpOnly`, `sameSite: lax`, `path: /`, `secure` conditionally, `maxAge: 30 days`.
- `authOptions` — the `NextAuthOptions` object: JWT session strategy, single `CredentialsProvider` calling `authenticateWithPassword`, `jwt` callback copying `id/role/email` onto the token, `session` callback copying them onto `session.user`. Comment explicitly documents that JWT strategy is chosen so every route can verify a session by decoding its own request cookie via `getToken` (see `require-auth.ts`), rather than `getServerSession`, keeping route handlers testable with a bare `NextRequest`.

**Depends on / used by:** imports `db` (`db.ts`) and `comparePassword` (`password.ts`). `SESSION_COOKIE_NAME` and `encodeSessionToken`/`applySessionCookie` are consumed by any OTP/claim-completion route that needs to log a user in outside the normal credentials POST. `require-auth.ts` is the read-side counterpart (uses `getToken` against the same cookie/secret).

#### src/lib/password.ts

**Purpose:** Thin bcrypt wrapper — the single place password hashing parameters live.

**Exported functions/procedures:**
- `hashPassword(password)` — `bcrypt.hash(password, 10)` (SALT_ROUNDS = 10).
- `comparePassword(password, hash)` — `bcrypt.compare(password, hash)`.

**Depends on / used by:** `bcryptjs`. Used by `auth.ts`'s `authenticateWithPassword` and presumably user-registration/password-change routes.

#### src/lib/require-auth.ts

**Purpose:** The auth gate every API route handler is expected to call first. Verifies the session JWT directly from the request's own cookies rather than relying on Next's ambient request context, which is what makes route handlers unit-testable by invoking them directly with a bare `NextRequest`.

**Exported functions/procedures:**
- `getSessionUser(req)` — calls `next-auth/jwt`'s `getToken({ req, secret: NEXTAUTH_SECRET })`; if the token has no `id`, returns `null`; otherwise returns `{ id, email, role }` (email/role default to `""` if absent on the token).
- `requireAuth(req)` — calls `getSessionUser`; if null, returns a ready-made `NextResponse.json({ error: "Unauthorized" }, { status: 401 })`; otherwise returns `{ user }`. Callers check `if (auth instanceof NextResponse) return auth;`.
- `requireRole(req, roles)` — calls `requireAuth`; if that already failed, propagates it; otherwise checks `roles.includes(auth.user.role)` and returns `403 Forbidden` via `NextResponse.json` if not, else `{ user }`.

**Depends on / used by:** `next-auth/jwt` (`getToken`), `next/server`. This is the foundational gate that `squad-access.ts`, `association-scope.ts`, and presumably every `src/app/api/**` route handler builds on (`SessionUser` type is imported by `squad-access.ts` and `association-scope.ts`).

#### src/lib/otp.ts

**Purpose:** OTP generation/hashing/verification primitives for the phone-based player-claim flow. Documents an explicit security fix: OTP hashing moved from a deterministic unsalted SHA-256 (rainbow-table-able against the ~900k 6-digit code space) to salted bcrypt.

**Exported functions/procedures:**
- `generateOtp()` — `String(randomInt(100000, 999999))` using Node's CSPRNG-backed `crypto.randomInt`, i.e. a uniformly random 6-digit code.
- `hashOtp(code)` — `bcrypt.hash(code, 10)`. Non-deterministic (same code hashes differently each call) by design.
- `verifyOtpCode(code, hash)` — `bcrypt.compare(code, hash)`; replaces the old `hashOtp(code) !== stored` equality check, which cannot work once hashing is salted.
- `otpExpiry()` — `new Date(Date.now() + 10 minutes)`.
- `isOtpExpired(expiresAt)` — `Date.now() > expiresAt.getTime()`.
- `maskPhone(phone)` — masks all but the last 4 digits (e.g. `"9876543210"` → `"******3210"`); returns `null` for falsy input; fully masks strings of length ≤4. Documented as the only thing ever logged for a phone number.
- Also re-exports `MAX_ATTEMPTS = 5`.

**Depends on / used by:** `crypto` (Node built-in `randomInt`), `bcryptjs`. `maskPhone` is imported by `otp-log.ts`. Presumably consumed by claim-flow API routes that generate/verify OTPs and enforce `MAX_ATTEMPTS`.

#### src/lib/otp-log.ts

**Purpose:** Structured, privacy-safe event logging for the OTP claim flow (one JSON line per event, phone always masked, code never logged). Notes that a prior branch backed this with a DB table (`otp_events`); this codebase has no such table so it logs structured JSON to `console.log` instead.

**Exported functions/procedures:**
- `logOtpEvent({ flowType, event, phone?, claimId?, failureReason? })` — builds and `console.log`s a JSON object `{ otp_event, flow_type, masked_phone, claim_id, failure_reason, at }`, wrapped in try/catch so a logging failure can never break the calling OTP flow. `flowType` is currently only `'claim_player'`; `event` is one of `generated | sent | rate_limited | verify_attempt | verify_success | verify_failed | consumed | expired`.

**Depends on / used by:** imports `maskPhone` from `otp.ts`. Called by whatever route implements the OTP claim flow, at each step of that state machine.

#### src/lib/rate-limit.ts

**Purpose:** In-memory sliding-window rate limiter. Explicitly documented as a stopgap: no Redis (`UPSTASH_REDIS_REST_URL/TOKEN`) is configured, so state is per-process and does not survive a restart or scale across instances; `@upstash/ratelimit`/`@upstash/redis` are already dependencies for a future swap.

**Exported functions/procedures:**
- `rateLimit(name, key, max, windowSeconds)` — keys a module-level `Map<string, number[]>` by `` `${name}:${key}` ``, filters recorded hit timestamps to those within `windowSeconds` of now. If the filtered count is `>= max`, returns `{ success: false, remaining: 0, resetMs: <time until oldest hit exits window> }` without recording a new hit. Otherwise appends `now`, stores it back, and returns `{ success: true, remaining: max - hits.length, resetMs: windowMs }`.
- `__resetRateLimitsForTests()` — clears the whole bucket map; documented as a test-only escape hatch since the map is a module singleton persisting across tests in a file.

**Depends on / used by:** no internal imports. Consumed by any route that needs throttling (e.g. OTP send/verify endpoints, login attempts) — `otp-log.ts`'s `'rate_limited'` event name implies this module gates the OTP send/verify routes.

### Identity Resolution & Claiming

#### src/lib/identity-normalize.ts

**Purpose:** Pure name/district normalization and fuzzy-similarity primitives that back player identity matching. Ported near-verbatim from another branch since it has no schema dependency.

**Exported functions/procedures:**
- `normalizeName(raw)` — Unicode-NFKD normalizes and strips diacritics (regex over the combining-marks range), lowercases, replaces punctuation with spaces, splits on whitespace, drops tokens found in a fixed `HONORIFICS` set (`mr, mrs, ms, miss, shri, smt, dr, capt, master, kumari`), then **sorts** the remaining tokens and rejoins with spaces — token-sorting neutralizes name-order variance (e.g. "Singh Raj" vs "Raj Singh" normalize identically).
- `normalizeDistrict(raw)` — lowercases, strips the word "dist"/"district" (with optional trailing period) via regex, strips punctuation, collapses whitespace, trims.
- `nameSimilarity(a, b)` — normalizes both names via `normalizeName`, computes full Levenshtein edit distance (a hand-rolled DP implementation), returns `1 - dist / max(len(a), len(b), 1)`, i.e. a 0–1 ratio. Explicitly documented as *not* the same function as `string-similarity.ts`'s `similarity()` — that function has a known disambiguation collision (can't rank a true variant above a rival by score alone); `nameSimilarity` is deliberately only ever used as a binary threshold gate (`>= 0.85`) in `identity-resolution.ts`, paired with independent DOB/district corroboration, rather than being used to rank/sort candidates.
- `NAME_SIMILARITY_HIGH_CONFIDENCE = 0.85` — the threshold constant.

**Depends on / used by:** no internal imports (pure functions). Used by `identity-resolution.ts`.

#### src/lib/identity-resolution.ts

**Purpose:** The core player-identity matching algorithm — given a raw name/DOB/district from an ingest row, decides whether it's a high-confidence match to an existing `PlayerProfile`, an ambiguous case needing human review, or a genuinely new player. This is the mechanism behind "claim your performance record" and behind how ingested match rows attach to the right player without ever silently misattributing one player's stats to another.

**Exported functions/procedures:**
- `resolveIdentity(input, client = db)` — `input: { associationId, nameRaw, dobRaw, districtRaw }`. Algorithm:
  1. Fetch candidate pool: all `playerProfile` rows for `input.associationId` where `consent_status !== 'withdrawn'` — a withdrawn-consent player is permanently excluded from ever being re-attached to.
  2. `nameMatches` = candidates where `nameSimilarity(candidate.full_name, input.nameRaw) >= 0.85`.
  3. `fullyCorroborated` = subset of `nameMatches` where **both** an independent DOB match (`sameDay`, comparing UTC year/month/date) and an independent district match (`normalizeDistrict` equality) hold — each corroboration only counts if the corresponding raw input field was actually supplied.
  4. If exactly one candidate is fully corroborated → `{ outcome: "HIGH_CONFIDENCE", playerId }`.
  5. Else if any name matches exist at all (whether 0 or >1 fully corroborated) → creates an `identityException` row (`association_id`, `raw_name`, `raw_dob`, `raw_district`, `reason` = `"MULTIPLE_CANDIDATES"` if >1 fully corroborated else `"AMBIGUOUS_MATCH"`, `candidate_player_ids` = all name-matched IDs, `status: "OPEN"`) and returns `{ outcome: "AMBIGUOUS", exceptionId }`. The system never guesses between multiple plausible identities.
  6. Else (no name match cleared the 0.85 threshold at all) → creates a brand-new shadow `playerProfile` (`full_name` = raw name, `dob` = raw DOB or epoch `new Date(0)` if absent, `district`/`state` blank-filled, `association_id`, `claim_status: "unclaimed"`, `consent_status: "not_required"`, `profile_source: "ingest"`) and returns `{ outcome: "NO_MATCH", playerId: created.id }`.
  - `sameDay(a, b)` (internal helper) compares UTC year/month/date only.
  - Accepts an optional Prisma transaction client so it can run inside a larger transactional ingest-approval flow.

**Depends on / used by:** imports `db` (`db.ts`), `nameSimilarity`/`normalizeDistrict`/`NAME_SIMILARITY_HIGH_CONFIDENCE` (`identity-normalize.ts`), and Prisma models `PlayerProfile`/`IdentityException`. Touches the `PlayerProfile` and `IdentityException` tables directly (reads and creates rows in both). `identity-exception-attach.ts` is the downstream consumer that later resolves an `AMBIGUOUS` outcome once a human picks the right player.

#### src/lib/identity-exception-attach.ts

**Purpose:** Completes the other half of the ambiguous-match flow: once a human reviewer confirms which player an `IdentityException` actually belongs to (or splits/merges it), this writes the originally-skipped `Performance` row onto exactly that one player, using the snapshot captured on the exception at ingest time.

**Exported functions/procedures:**
- `attachSkippedPerformance(client, exception, playerId)` — requires `exception.match_id` and `exception.performance_snapshot` to both be present; throws `AttachSnapshotMissingError` if either is missing. Looks up the `match` by `exception.match_id`; throws the same error if not found. Casts `performance_snapshot` (stored JSON) to `Partial<NormalizedPerformanceRow>`. Creates a `performance` row: `match_id`, `player_id`, all batting/bowling fields copied from the snapshot, plus `source`/`ingest_method`/`confidence_score` copied from the resolved `match`. Returns the created `Performance`.
- `AttachSnapshotMissingError` — a named `Error` subclass for the "nothing to attach" case.

**Depends on / used by:** imports `IdentityException`/`Prisma`/`PrismaClient` types from `@prisma/client` and `NormalizedPerformanceRow` from `ingest/types.ts`. Writes to the `Performance` model, reads `Match`. Called by whatever route implements the exception-review confirm/split/merge UI (not itself in `src/lib`).

#### src/lib/string-similarity.ts

**Purpose:** A *separate*, deliberately different similarity function used specifically for academy-name reconciliation (matching a raw academy string from ingest/registration against the canonical `Academy` registry) — not player identity. The file's own comment documents a fixed defect (`tests/known-defects DEFECT 3`): the naive whole-string normalized-Levenshtein ratio couldn't distinguish "Sharma Cricket Academy" vs. "Sharma Cricket Acad." (a true abbreviation) from "Sharma Cricket Academy" vs. "Verma Cricket Academy" (a different academy) — both scored identically (0.8636) because generic words like "Cricket Academy" dominate the edit distance regardless of whether the identifying word matches.

**Exported functions/procedures:**
- `similarity(a, b)` — normalizes both strings (`normalize`: lowercase, strip `.`/`,`, collapse whitespace, trim). If normalized strings are exactly equal, returns `1` immediately. Otherwise computes `wholeSim` = whole-string character similarity (`charSim`, Levenshtein-ratio based) and `idMatch` = best pairwise character-similarity between each string's "identity tokens" (`identityTokens`: tokens of length >1 excluding a fixed `BOILERPLATE` set — `cricket, academy, acad, club, ca, cc, sc, sports, sport, association, assn, institute, school, trust, society, foundation`). If either side has zero identity tokens, falls back to `wholeSim` alone. Otherwise returns `0.7 * idMatch + 0.3 * wholeSim` — the identifying word dominates the score, whole-string similarity is a smaller secondary term so genuine abbreviation variants still get a boost from matching boilerplate.
- `bestSimilarity(raw, academyName, variants)` — returns the max of `similarity(raw, academyName)` and `similarity(raw, v)` for every known name variant.
- (internal) `levenshtein`, `normalize`, `charSim`, `identityTokens`, `bestIdentityMatch`.

**Depends on / used by:** no internal imports (pure). Used by `academy-capture.ts` (`enqueueAcademyCapture`) and `academy-production.ts` (`getAcademyProduction`) — both explicitly note they reuse this function rather than a second matcher so the reconciliation queue and any ranking view never disagree on what counts as "the same academy."

### Data Ingest Pipeline

#### src/lib/ingest/types.ts

**Purpose:** Shared TypeScript contract for the whole ingest pipeline — the normalized shape every source adapter (CSV, Excel, OCR, API) must produce, re-targeted from a prior branch's schema to this codebase's field names (`full_name` not `player_name_raw`) and designed to be stored as plain JSON on an `IngestJob` rather than dedicated match/performance columns, since normalization happens before DB write.

**Exported types (no functions):** `IngestSourceKey` (`'api_sync' | 'structured_parser' | 'ocr' | 'excel_mapper'`), `NormalizedPerformanceRow` (name/dob/district/academy_raw plus optional batting/bowling numeric fields), `NormalizedIngestPayload` (tournament/season/format/ageCategory/level/matchDate/teams/venue + `performances[]`), `IngestSourceResult` (`{ payload, confidence }`), and the `IngestSource` interface (`{ key, normalize(input): IngestSourceResult }`) every adapter implements.

**Depends on / used by:** consumed by every file in `ingest/` and `ingest/sources/`, and by `identity-exception-attach.ts` (imports `NormalizedPerformanceRow`).

#### src/lib/ingest/confidence.ts

**Purpose:** Shared completeness-scoring math used identically by all four source adapters, so confidence formulas differ only in their source-specific trust weighting, not in how "how complete is this row" is computed.

**Exported functions/procedures:**
- `completenessScore(row)` — checks presence (non-null/undefined/non-empty-string) of 4 fields (`full_name`, `dob`, `district`, `academy_raw`); `present / 4`, then multiplied by `1.0` if the row has *any* batting or bowling data (`batting_runs !== undefined || bowling_wickets !== undefined`) or `0.7` if it has neither — a row with full identity fields but no actual match stats is capped at 70% completeness.
- `payloadCompleteness(payload)` — average `completenessScore` across all `payload.performances`; returns `0` if there are no performance rows at all.
- `roundConfidence(n)` — clamps `n` to `[0,1]` then rounds to 3 decimal places (`Math.round(n*1000)/1000`).

**Depends on / used by:** imports types from `./types`. Used by all four `ingest/sources/*.ts` adapters.

#### src/lib/ingest/csv-to-payload.ts

**Purpose:** Maps a documented, fixed-header CSV export into the same normalized payload shape the `excel_mapper` adapter expects — explicitly *not* a general Excel importer, just an exact-header CSV-to-payload mapper, with a hand-rolled CSV parser (no library).

**Exported functions/procedures:**
- `INGEST_CSV_HEADERS` — the full ordered list of expected column headers.
- `mapCsvToIngestPayload(csv)` — parses the CSV via `parseCsv`; throws if fewer than 2 rows (header + ≥1 data row). Builds a case-insensitive header→column-index map; throws `"CSV is missing required header: X"` if any of `tournamentName, matchDate, homeTeam, awayTeam, full_name` is absent. For each data row, skips rows with an empty `full_name`; builds a `NormalizedPerformanceRow` with `dob`/`district`/`academy_raw` mapped through `emptyToNull`, `batting_dismissed` parsed via `parseBoolean` (accepts `true/yes/1` and `false/no/0`, else `undefined`), and each of the 5 numeric performance fields parsed via `parseNumber` (only set if `Number.isFinite`). Throws `"CSV has no player rows"` if every row was skipped. Match-level metadata (`tournamentName`, `season`, `format` default `'T20'`, `level` default `'district'`, etc.) is read from the **first** data row only. Returns the payload with `mappingConfidence: 1` (a CSV with exact headers has no mapping ambiguity, unlike a fuzzy Excel column-guesser).
- `parseCsv(text)` — a minimal RFC-4180-ish hand-rolled parser: strips a leading BOM, handles quoted fields, escaped `""` quotes, CRLF/LF line endings, commas inside quotes; filters out fully-blank rows.

**Depends on / used by:** imports types from `./types`. Presumably invoked by an "upload CSV" ingest route which then feeds the resulting payload into `excelMapperSource.normalize` or directly into the confidence pipeline (the type is literally `MappedExcelPayload = NormalizedIngestPayload & { mappingConfidence }`).

#### src/lib/ingest/registry.ts

**Purpose:** Simple lookup table mapping an `IngestSourceKey` to its concrete adapter implementation — the single indirection point so routes don't import each adapter module directly.

**Exported functions/procedures:**
- `resolveIngestSource(key)` — looks `key` up in a `REGISTRY` record populated with all four adapters; throws `"Unknown ingest source: ${key}"` if not found.

**Depends on / used by:** imports all four `ingest/sources/*` modules and `IngestSource`/`IngestSourceKey` types. Used by ingest API routes to dispatch to the right `.normalize()` implementation based on the upload's declared source type.

#### src/lib/ingest/sources/api-sync.ts

**Purpose:** Adapter for data pulled from an already-validated external platform/API. Treated as the most structurally trustworthy source.

**Exported functions/procedures:**
- `apiSyncSource: IngestSource` (`key: 'api_sync'`) — `normalize(input)` coerces every top-level field to its expected type/default (e.g. `format` defaults `'T20'`, `level` defaults `'district'`, `performances` defaults `[]` if not an array), computes `completeness = payloadCompleteness(payload)`, then `confidence = roundConfidence(0.9 * completeness + 0.1 * 1.0)` — a fixed trust weight of `1.0` for 10% of the score, completeness for the remaining 90%. Notably also applies `Math.max(confidence, completeness >= 0.99 ? 0.75 : confidence)` — a completeness-≥0.99 payload is floored at 0.75 confidence regardless of the formula's raw output.

**Depends on / used by:** imports `payloadCompleteness`/`roundConfidence` from `../confidence` and types from `../types`.

#### src/lib/ingest/sources/excel-mapper.ts

**Purpose:** Adapter for Excel/CSV register uploads where column-header mapping to the normalized shape is partly auto-guessed rather than exact — `mappingConfidence` is a caller-supplied signal for how much of that guessing was needed.

**Exported functions/procedures:**
- `excelMapperSource: IngestSource` (`key: 'excel_mapper'`) — reads `body.mappingConfidence` (defaults `0.7` if not a number), normalizes the payload the same way as `api-sync.ts`, computes `completeness`, and `rowParseCleanliness = 1` if any performance rows parsed else `0`. Confidence = `roundConfidence(0.5*completeness + 0.3*mappingConfidence + 0.2*rowParseCleanliness)`.

**Depends on / used by:** same as above.

#### src/lib/ingest/sources/ocr.ts

**Purpose:** Adapter for OCR-scanned physical scoresheets — the lowest-trust source by construction (capped below other sources pre-human-review).

**Exported functions/procedures:**
- `ocrSource: IngestSource` (`key: 'ocr'`) — reads `body.ocrEngineConfidence` (caller-supplied, defaults `0.5`), normalizes the payload, computes `completeness`, and treats `humanReviewed` as always `0` at normalize-time (a human reviewer bumping the job's status happens later, elsewhere, not inside `normalize()`). Confidence = `roundConfidence(0.6*ocrEngineConfidence + 0.3*completeness + 0.1*humanReviewed)` — max possible pre-review confidence is capped at 0.9 since the human-review term is always 0 here.

**Depends on / used by:** same as above.

#### src/lib/ingest/sources/structured-scorecard.ts

**Purpose:** Adapter for digital scorecard exports with an expected fixed shape — confidence is weighted on both data completeness and how cleanly the payload matched that expected schema.

**Exported functions/procedures:**
- `structuredScorecardSource: IngestSource` (`key: 'structured_parser'`) — checks that all 5 required top-level keys (`tournamentName, season, matchDate, homeTeam, awayTeam`) are present on the raw input; `schemaValidationScore` starts at `1.0`, drops to `0.6` if any is missing, and is further floored to `0` if the parsed payload ends up with zero performance rows. Confidence = `roundConfidence(0.7*completeness + 0.3*schemaValidationScore)`.

**Depends on / used by:** same as above.

### Performance, Scoring & Visibility

#### src/lib/athlasx-score.ts

**Purpose:** The AthlasX Score engine (v1.2) — computes the platform's core 0–100 talent-composite score strictly from association-**verified** match data. The file's extensive header comment documents a fixed security/integrity defect (DEFECT 1): earlier versions let a caller-supplied, self-reported `coachFitnessRating`/`coachBehaviourRating` contribute up to 25 of 100 points with no provenance check distinguishing a real coach-supervised assessment from a self-report. The fix removes coach ratings from the score's inputs entirely — the score is now 100% performance/experience/volume from verified match data; coach ratings remain a separate advisory-only signal (`CoachAdvisoryNote` model, not in this score).

**Exported functions/procedures:**
- `TQI` — Tournament Quality Index multiplier table: `national: 1.0, state: 1.0, district: 0.75, local: 0.5`. Applied once as a multiplicative discount on finished rate stats (never baked into both numerator and denominator, which would cancel out).
- `calculateAthlasXScore(input: AthlasXScoreInput)` — main entry point. Input: `{ playingRole, performances: VerifiedPerformanceRow[], yearsExperience, coachFitnessRating?/coachBehaviourRating? (deprecated, never read) }`.
  - **Performance component (0–40):** aggregates batting (`aggregateBatting`: average = runs per dismissal, not per innings, so an unbeaten innings never penalizes the average; strike rate = runs/balls*100; a `qualityFactor = tqiSum/matches` discounts both) and bowling (`aggregateBowling`: economy = runsConceded/overs, average = runsConceded/wickets or, with zero wickets, `economy*6` as an economy-implied ceiling rather than a fixed 99; discounted by *dividing* by `qualityFactor` since lower economy/average is better — the mirror direction of batting's multiply). Each is converted to a 0–10 display score against fixed benchmarks (batting: avg 35 / SR 140 = full marks, weighted 55/45; bowling: economy 6.5 / average 40→0,15→10, weighted 55/45). The role determines the 0–40 blend: pure batting display for Batsman/Wicket-keeper Batsman, pure bowling display for Bowler, `battingDisplay*0.55 + bowlingDisplay*0.45` for All-rounder.
  - **Experience component (0–15):** `matchVol` = TQI-weighted match count scaled to 8 points at 30 weighted matches; `yearsScore` = years-experience scaled to 4 points at 8 years; `levelScore` = 3 if any national/state performance exists, 2 if any district, else 1. Summed and clamped to 15.
  - **Fitness/Behaviour components:** `calcFitness`/`calcBehaviour` always called with `undefined` — always return `0`; `fitnessAssessed`/`behaviourAssessed` are hardcoded `false`. This is the literal enforcement of DEFECT 1's fix — the functions still exist (so a future real coach-provenance signal could plug in) but are never fed real input.
  - **Volume component (0–10):** TQI-weighted match count scaled to 10 at 25 weighted matches.
  - **Total:** `total = round((performance + experience + volume) / (40+15+10) * 100)`, i.e. always normalized against the fixed 65-point active max (no renormalization branch since fitness/behaviour never contribute).
  - Returns an `AthlasXScoreBreakdown` with `total`, per-component 0–10/0–40/0–15/0–10 display values, `fitnessAssessed`/`behaviourAssessed` (always false), `verifiedMatchCount`, and `tqiWeightedMatches` (rounded to 1 decimal) for provenance display.
- `getScoreTier(score)` — maps total score to a label/color/description tier: ≥85 "Elite" (green), ≥70 "Advanced" (blue), ≥55 "Developing" (amber), else "Rising" (purple).
- `getProvenanceLabel(count, tqiWeighted, topLevel)` — formats a display string like `"12 verified matches · District level · TQI-weighted 9.5"`; `topLevel` collapses to "State" for state/national, else "District".

**Depends on / used by:** imports `TournamentLevel`/`PlayingRole` from `@/types`. Consumed by `dossier.ts` (`getOrGenerateDossier`, `cohortPercentile`) and by any player-profile/scouting-view page that needs a score; fed by `verified-performances.ts` (real data) or `mock-performance-seed.ts` (seed/demo data) as its `performances` input.

#### src/lib/mock-performance-seed.ts

**Purpose:** Deterministic pseudo-random match-history generator, used as a stand-in for real ingested `Performance` rows in demo/dev contexts before the ingest pipeline has populated real data for a player. Seeded by player ID so the same player always produces identical numbers across reloads and across client/server, and the score-engine view (`seedPerformances`) and the match-list view (`seedMatchHistory`) are derived from the same underlying rows so they never disagree.

**Exported functions/procedures:**
- `dbRoleMap` — maps DB enum role strings (`Batsman, Bowler, All_rounder, Wicket_keeper_Batsman`) to the app's `PlayingRole` union.
- `seedMatchHistory(playerId, role)` — seeds a mulberry32 PRNG from a simple string hash of `playerId` (`hashSeed`: 31-multiplier rolling hash), generates 12–24 fake matches with role-appropriate batting/bowling stats (batters/all-rounders bat, bowlers/all-rounders bowl), fixed opponent/tournament name pools, dates spaced 9 days apart ending near "now", all at `level: 'district'`.
- `seedPerformances(playerId, role)` — maps `seedMatchHistory`'s output down to just the `VerifiedPerformanceRow` shape `athlasx-score.ts` expects.

**Depends on / used by:** imports `PlayingRole` from `@/types` and `VerifiedPerformanceRow` from `athlasx-score.ts`. No DB access at all — pure/synthetic. Used wherever a player has no real verified performances yet but the UI needs something to render (dev/demo path, not touched in production ingest flow).

#### src/lib/verified-performances.ts

**Purpose:** Batch query layer over association-**approved** `Performance` rows, joined to their match's tournament level — the same shape `dossier.ts`'s single-player query uses, but fetched for many players in one round trip (for pages like `/grading` Quick View that need every candidate's verified data at once).

**Exported functions/procedures:**
- `verifiedMatchHistoryForPlayer(playerId)` — `db.performance.findMany({ where: { player_id, association_approval_status: 'approved' }, include: match→tournament, orderBy: match.date desc })`. Maps to `VerifiedMatchRow[]` including `opponent` (taken from `match.away_team` — there's no stored "player's own team" field, so this is documented as the real recorded opponent, not a synthetic pairing), `tournament` (name), `date`, `level`, and all batting/bowling fields (nulls coalesced to `undefined`).
- `verifiedPerformancesByPlayer(playerIds)` — single `db.performance.findMany({ where: { player_id: { in: playerIds }, association_approval_status: 'approved' } })` with tournament level joined, then groups results into a `Record<playerId, VerifiedPerformanceRow[]>` pre-seeded with an empty array for every requested ID (so callers never get `undefined` for a player with zero performances). Returns immediately with all-empty map if `playerIds` is empty (skips the query).

**Depends on / used by:** imports `db` and `VerifiedPerformanceRow` type from `athlasx-score.ts`. Touches `Performance`, `Match`, `Tournament` Prisma models. Feeds `athlasx-score.ts`'s `calculateAthlasXScore` for real (non-seed) data paths, and is functionally parallel to `dossier.ts`'s internal `playerVerifiedPerformances` (same query shape, single- vs. batch-player).

#### src/lib/player-visibility.ts

**Purpose:** The single authorization chokepoint for cross-association player visibility. Every `PlayerProfile` belongs to one association and defaults to `association_only` visibility (only that association's own staff, plus unrestricted `athlasx_ops`, can see it); a player can opt into broader visibility tiers. The file's header comment states explicitly that every route touching cross-association `PlayerProfile` data must route through this module rather than reimplementing the logic.

**Exported functions/procedures:**
- `isAdult(dob)` — `dob <= (today - 18 years)`.
- `visibilityWhere(viewerScope)` — builds a Prisma `PlayerProfileWhereInput`. If `viewerScope === null` (unrestricted `athlasx_ops`), returns `{}` (no filter). Otherwise builds an `OR` of: `{ association_id: { in: viewerScope } }` (own association's players), `{ visibility_tier: 'cross_association' }` (any association can see), and — **only if** `FRANCHISE_SCOUT_ENABLED` is true — `{ visibility_tier: 'franchise_scout', dob: { lte: 18-years-ago } }`. Since the flag is currently `false`, franchise-scout-tier players are invisible cross-association regardless of what's stored on the row.
- `canViewPlayerProfile(viewerScope, player)` — single-record equivalent: `true` if `viewerScope === null`; else `true` if the player's `association_id` is in scope; else `true` if `visibility_tier === 'cross_association'`; else `true` only if `visibility_tier === 'franchise_scout' AND FRANCHISE_SCOUT_ENABLED AND isAdult(player.dob)`; else `false`. The flag check is re-verified here too — even if a row somehow already has the `franchise_scout` tier set, this function still blocks it while the flag is off, so a flag never accidentally "goes live" for existing rows.

**Depends on / used by:** imports `Prisma` types and `FRANCHISE_SCOUT_ENABLED` from `feature-flags.ts`. Every list/detail route over `PlayerProfile` that crosses association boundaries is expected to call this.

#### src/lib/dossier.ts

**Purpose:** Generates the pre-camp "dossier" document for a trial-cycle registrant — a scored, cohort-percentile-ranked summary computed lazily on first view and then cached (immutable) as a `Dossier` row, matching the codebase's "compute once, cache, regenerate only if explicitly asked" convention (there's no scheduled job runner).

**Exported functions/procedures:**
- `getOrGenerateDossier(registrationId)` — first checks `db.dossier.findUnique({ where: { registration_id } })` and returns it as-is if it already exists (dossiers are immutable once created). Otherwise loads the `registration` (with its `player`); returns `null` if not found. Fetches the player's verified performances via the internal `playerVerifiedPerformances` (same query shape as `verified-performances.ts`, ordered by `id desc`). Two branches:
  - **Has history:** computes `calculateAthlasXScore` via the internal `scoreFor` helper (uses the player's `playing_role`, defaulting to `'Batsman'` if unset, and a hardcoded `yearsExperience: 3` since it isn't collected at registration time — same neutral placeholder used elsewhere). Computes `cohortPercentile` (see below). Builds `contents`: `batting`, `bowling`, `total`, `match_count`, `data_sources: ['association-verified match data']`, `cohort_size`, and `recent_form` (the 5 most recent performances' level/runs/wickets).
  - **No history:** `has_match_history: false`, zeros/empty across the board, no score or percentile — the code comment stresses "never a fabricated number."
  - Persists via `db.dossier.create` with `registration_id, player_id, trial_cycle_id, generated_at, has_match_history, percentile_vs_cohort, contents_snapshot`.
- `cohortPercentile(trialCycleId, registrationId, playerTotal)` (internal, not exported but documents the algorithm): fetches every other `registration` in the same `trial_cycle_id` (excluding the subject), computes each cohort member's score the same way, filters out cohort members with zero verified performances, and only proceeds if the qualifying cohort has ≥`MIN_COHORT_FOR_PERCENTILE` (5) scored members — otherwise returns `{ percentile: null, cohortSize }` so a thin cohort never produces a misleadingly precise number. Percentile = `round((count of cohort scores below playerTotal / cohortScores.length) * 1000) / 10` (one decimal place), a hand-rolled rank-based percentile, not a library.

**Depends on / used by:** imports `db`, `calculateAthlasXScore`/`VerifiedPerformanceRow` from `athlasx-score.ts`, `PlayingRole` from `@/types`. Touches `Dossier`, `Registration`, `Performance`, `Match`, `Tournament`, `PlayerProfile` models.

### Academy Subsystem

#### src/lib/academy-capture.ts

**Purpose:** Enqueues one raw academy/club name string (captured from an approved match/ingest row) into the academy-name reconciliation queue, so association/academy staff can later confirm which real `Academy` it refers to. Reuses the same `similarity()` matcher the confirm/reject UI routes use, so this capture step and human review never disagree on candidates.

**Exported functions/procedures:**
- `AUTO_ATTACH_THRESHOLD = 0.9`, `SUGGEST_THRESHOLD = 0.65` (module constants; `AUTO_ATTACH_THRESHOLD` is also re-exported and consumed by `academy-production.ts`).
- `enqueueAcademyCapture(rawAcademyName, source, client = db)` — trims the input, returns `null` immediately if empty. Loads every `academy` (`id, name, name_variants`). For each, computes `Math.max(similarity(trimmed, name), ...name_variants.map(v => similarity(trimmed, v)))` and tracks the best-scoring academy. Status logic: `'unmatched'` if no academies exist at all; else `'suggested'` if score `>= 0.9` (still requires human confirmation — the doc comment is explicit that scores above the auto-attach threshold are *never* auto-merged, only fast-tracked to "suggested"); also `'suggested'` if score `>= 0.65`; else `'unmatched'`. Creates an `academyMatchCandidate` row (`raw_string`, `source`, `suggested_academy_id` set only when status is `'suggested'`, `similarity_score`, `status`). Returns `{ candidateId, status }`.

**Depends on / used by:** imports `db` and `similarity` from `string-similarity.ts`. Writes `AcademyMatchCandidate`, reads `Academy`. Consumed by the (not-in-scope) `/api/academy-matching/**` routes and by `academy-production.ts` (imports `AUTO_ATTACH_THRESHOLD`).

#### src/lib/academy-production.ts

**Purpose:** Computes a ranked "academy production" leaderboard — which academies have produced the most players who advanced to district-or-higher tournament level. Because there is no direct FK from `PlayerProfile` to `Academy` (players only carry a free-text `academy` string from ingest), affiliation is computed live via fuzzy matching against the confirmed registry, reusing the exact same threshold/matcher as `academy-capture.ts` so the reconciliation queue and this ranking never disagree about "same academy."

**Exported functions/procedures:**
- `getAcademyProduction()` — in parallel, fetches all `academy` rows (`id, name, district, name_variants`) and all `playerProfile` rows with a non-null `academy` string, each including its `approved` `performances` joined to `match.tournament.level`. Builds `playerAdvanced: Map<playerId, boolean>` = true if any approved performance has `tournament.level !== 'local'`. For each academy, iterates every player, computes `bestSimilarity(player.academy, academy.name, academy.name_variants)`, counts the player as `affiliated` if score `>= AUTO_ATTACH_THRESHOLD` (0.9) and additionally `advanced` if that player is in `playerAdvanced`. Returns rows sorted descending by `advancedPlayers`, then `affiliatedPlayers`.

**Depends on / used by:** imports `db`, `bestSimilarity` (`string-similarity.ts`), `AUTO_ATTACH_THRESHOLD` (`academy-capture.ts`). Reads `Academy`, `PlayerProfile`, `Performance`, `Match`, `Tournament`. This is an O(academies × players) live computation — no caching — each call to `getAcademyProduction()`.

#### src/lib/academy/attendance-flags.ts

**Purpose:** A ported dismiss/snooze state machine for flagging players with consecutive training absences, for the academy admin's follow-up queue. The header comment documents a scope limitation from the port: the source branch computed "N consecutive absences" from a batch-scoped `training_sessions`/`session_attendance` schema that doesn't exist on this branch (main's `TrainingSession`/`SessionAttendance` models belong to a different, Squad-scoped subsystem). Only the pure state-machine logic plus a real Prisma-backed dismiss/snooze store (`AcademyAttendanceFlag`) were ported; the actual absence-counting computation is left to be supplied by a future caller.

**Exported functions/procedures:**
- `DEFAULT_ABSENCE_THRESHOLD = 2`, `MIN_SNOOZE_DAYS = 1`, `MAX_SNOOZE_DAYS = 90`.
- `formatAbsenceReason(absences)` — `"${n} absence(s) in a row"` with correct singular/plural.
- `parseSnoozeDurationDays(raw)` — coerces to integer, returns `null` if not an integer or outside `[1, 90]`.
- `snoozeUntilFromDays(days, now)` — adds `days` (UTC date arithmetic) to `now`.
- `isSnoozeActive(snoozedUntil, now)` — `false` for null/invalid dates, else `snoozedUntil > now`.
- `classifyFollowUpStatus({ consecutiveAbsences, threshold, state, now })` — pure classifier: `'clear'` if `consecutiveAbsences < threshold`; else if no stored state, `'open'`; else if state is `'snoozed'`, `'snoozed'` if still active else `'open'`; else if `'dismissed'`, stays `'dismissed'`; else `'open'`.
- `loadAttendanceFollowUpForPlayer(academyId, playerId, consecutiveAbsences, threshold?, now?)` — loads the stored `academyAttendanceFlag` row (composite key `academy_id_player_id`). Self-heals stale state: if absences have dropped back under threshold while a flag row exists, deletes it; if a snooze has expired, also deletes it. Classifies via `classifyFollowUpStatus`, returns a full status object including `flagged` (true only when status is `'open'`) and `can_unsnooze` (true only when `'snoozed'`).
- `dismissAttendanceFlag(academyId, playerId)` — upserts the flag row to `status: 'dismissed'` (clearing any snooze fields).
- `snoozeAttendanceFlag(academyId, playerId, durationDays, now?)` — validates duration via `parseSnoozeDurationDays` (throws `"Invalid snooze duration"` if invalid), computes `snoozed_until`, upserts `status: 'snoozed'` with the until-date and duration.
- `unsnoozeAttendanceFlag(academyId, playerId)` — `deleteMany` where `status: 'snoozed'` for that player/academy.
- `applyAttendanceFlagAction(academyId, playerId, action, durationDays?, now?)` — single dispatcher for `'dismiss' | 'snooze' | 'unsnooze'`; returns a structured `{ ok: false, error }` for a bad snooze duration rather than throwing, so a route handler can turn it directly into a 400 response.

**Depends on / used by:** imports `db`. Touches `AcademyAttendanceFlag` model only (reads/writes/deletes). The actual `consecutiveAbsences` input must be computed by a caller not in this file.

#### src/lib/academy/batches.ts

**Purpose:** Scheduling and roster management for academy training batches (the academy-admin's batch CRUD/roster surface). Ported from a raw-SQL/hand-rolled-DDL implementation on another branch onto this codebase's real Prisma `AcademyBatch`/`AcademyBatchMembership` models — only the pure scheduling helpers and query logic survived the port; all "ensureTable" DDL plumbing was dropped since Prisma already models the tables.

**Exported functions/procedures (selected — this is the largest file in the group):**
- `BATCH_AGE_GROUPS` (`Any, U-10, U-13, U-17, Senior`), `BATCH_WEEKDAYS` (`Mon..Sun`).
- `scheduleSlotsShareOneTime(slots)` — true if all slots share identical start/end (needed because the DB stores only one shared `schedule_time` string for potentially multiple weekday slots).
- `scheduleToDbFields(slots)` — encodes UX slots into `{ schedule_days: string[], schedule_time: "HH:MM-HH:MM" }`, taking the first slot's times as the shared window; empty input yields empty fields.
- `scheduleFromDbFields(days, time)` — decodes DB columns back to UX slots, validating the time string against `SCHEDULE_TIME_RE` and each weekday against the known list; silently drops unrecognized weekdays.
- `mapBatchStatusFromDb`/`mapBatchStatusToDb`/`isBatchArchived` — maps between the UX `'active'|'archived'` strings and the Prisma `AcademyBatchStatus` enum (`'ACTIVE'|'ARCHIVED'`).
- `parseAgeGroup(raw)` — validates against `BATCH_AGE_GROUPS`, else `null`.
- `parseSchedule(raw)` — validates an array of `{day, start, end}` slots: rejects non-arrays, empty arrays, unrecognized weekdays, non-`HH:MM` (24h) times, `start >= end`, and — critically — rejects (with an explanatory error message) any set of slots whose times aren't all identical, since the DB schema can only store one shared time window; suggests the caller create separate Morning/Evening batches instead. Returns `{ ok: true, value }` or `{ ok: false, error }`.
- `mapBatchRow(row, playerCount?)` — maps a raw `AcademyBatch` Prisma row to the `BatchRow` API shape.
- `loadOwnedActiveBatch(academyId, batchId)` — `db.academyBatch.findFirst({ where: { id, academy_id } })`, the ownership-scoped batch lookup every mutating function below builds on.
- `assertPlayerExists(playerId)` — validates a non-empty ID and that the `playerProfile` exists.
- `assignPlayerToBatch(academyId, batchId, playerId)` — loads the owned batch (404 if not found/not owned), rejects (400) if the batch is archived, validates the player exists (400 if not), then either no-ops if already an active `academyBatchMembership` exists, reactivates it (`status: 'active'`) if it exists but inactive, or creates a new membership row.
- `removePlayerFromBatch(academyId, batchId, playerId)` — 404 if batch not found or membership not active/absent; else updates membership `status: 'removed'` (soft delete).
- `listPlayersInBatch(academyId, batchId)` — 404 if batch not owned; else all active memberships with `player` included, ordered by `joined_at desc`.
- `playerCountsByBatch(academyId)` — `groupBy` active memberships by `batch_id` scoped to the academy's own batches, returns a `Map<batchId, count>`.
- `formatScheduleLabel(schedule)` — e.g. `"Mon/Wed · 6:30–8:00am"` (uses internal `to12h`).
- `nextSessionLabel(schedule, now?)` — computes the soonest upcoming weekly occurrence across all slots (handling "today but already passed → next week" via a `+7 days` rollover), returns `"Today · 6:30am"`, `"Tomorrow · 5:00pm"`, or `"Thu · 5:00pm"` style labels; `"—"` if no schedule.
- `loadDashboardBatchSummary(academyId)` — parallel-fetches active-membership count, pending `academyJoinRequest` count, all `ACTIVE` batches, and per-batch player counts; returns `{ stats: { players, batches, pending_joins }, batches: DashboardBatchSummary[] }` (each with formatted schedule label and next-session label).

**Depends on / used by:** imports `db` and `AcademyBatch`/`AcademyBatchStatus` types from `@prisma/client`. Touches `AcademyBatch`, `AcademyBatchMembership`, `PlayerProfile`, `AcademyJoinRequest`. Exports (`loadOwnedActiveBatch`, `isBatchArchived`) are reused directly by `academy/join-requests.ts`.

#### src/lib/academy/join-requests.ts

**Purpose:** Manages the academy join-request queue (a prospective player/parent applies to join an academy; academy admin approves into a specific batch or rejects). Ported from a branch that modeled a "join request" as a `PlayerProfile` row with a pending-approval status; this codebase instead introduces a dedicated `AcademyJoinRequest` model since main's `PlayerProfile` has no such status/source-channel columns — approval creates or reuses a real `PlayerProfile` and links it via `AcademyBatchMembership`.

**Exported functions/procedures:**
- `listPendingJoinRequests(academyId)` — all `academyJoinRequest` rows with `status: 'pending'` for the academy, ordered oldest-first, mapped to `{ id, name, age (computed via ageFromDob), candidate_phone, submitted_at }`.
- `approveJoinRequest(academyId, requestId, batchId, reviewedByUserId)` — loads the owned active batch (404/400 exactly as in `batches.ts`); loads the pending request scoped to the academy (404 `"Join request not found or already handled"` if missing or already processed); inside a `db.$transaction`: reuses `request.player_id` if the request already links to a player, else creates a new `playerProfile` (`full_name` from candidate name, `dob` from candidate DOB or a `2000-01-01` fallback, `profile_source: 'academy_join_request'`, `association_id: null`); upserts an active `academyBatchMembership` for that player+batch; marks the request `'approved'` with `reviewed_by`/`reviewed_at`. Returns `{ ok: true, player_id }`.
- `rejectJoinRequest(academyId, requestId, reviewedByUserId)` — 404 if not found/pending; else marks `'rejected'` with reviewer/timestamp.
- `ageFromDob(dob)` (internal) — floors `(now - dob) / 365.25 days`.

**Depends on / used by:** imports `db`, and `isBatchArchived`/`loadOwnedActiveBatch` from `academy/batches.ts`. Touches `AcademyJoinRequest`, `PlayerProfile`, `AcademyBatchMembership`.

#### src/lib/academy/profile-fields.ts

**Purpose:** Field-contract and validation layer for the academy onboarding/profile-edit form — a fixed schema of allowed fields, their types, and validation rules, driven by an internal "AthlasX Master Data Points" spec.

**Exported functions/procedures:**
- `ACADEMY_PROFILE_FIELDS` — a `Record<fieldName, FieldType>` (`string | number | boolean | jsonb | textarr`) enumerating every allowed academy profile field (name, description, contact info, affiliations, facilities, etc.).
- `ACADEMY_TYPES`, `GROUND_TYPES`, `ACTIVE_PLAYER_COUNT_RANGES` (canonical, using an en-dash e.g. `"50–100"`) — fixed enum value lists.
- `coerceAcademyField(v, type)` — type-coerces a raw input value per its declared `FieldType`: `undefined` passes through as `undefined`; `null`/`""` become `null`; numbers via `Number()` (invalid → `null`); booleans accept `true/1/"1"/"true"` and `false/0/"0"/"false"`, otherwise return a sentinel `Symbol.for('academy.invalid_boolean')` so downstream validation can reject junk explicitly rather than silently nulling it; `textarr` only accepts real arrays (else `null`); `jsonb` parses a JSON string or passes an object through; else stringifies.
- `validateAcademyField(key, value)` — returns a human-readable error string or `null`. Checks the boolean sentinel first; then null/undefined always pass; then field-specific rules: `academy_type`/`ground_type` must be in their enum; `active_player_count_range` must match a known key in the alias map; `founded_year` must be an integer in `[1950, currentYear]`; `contact_email` must match a basic email regex; `academy_name` must be ≥2 chars trimmed; `branch` must be ≤160 chars.
- `normalizeAcademyField(key, value)` — resolves `active_player_count_range` aliases (e.g. `"50-100"` → `"50–100"` canonical en-dash form) via `PLAYER_COUNT_ALIASES`; trims `academy_name`/`branch`/`contact_name` strings.

**Depends on / used by:** no internal imports — pure validation/normalization logic. Presumably consumed by an academy-profile PATCH/PUT route to validate incoming field updates before writing to the `Academy` model.

#### src/lib/academy/scope.ts

**Purpose:** Tiny helper resolving an `academy_admin` user's own `Academy` row — the academy subsystem's equivalent of `association-scope.ts`/`squad-access.ts`'s "membership row is the only source of access" discipline: an academy admin's scope is derived from the real `Academy.admin_user_id` ownership link, never from a client-supplied `academyId`.

**Exported functions/procedures:**
- `getOwnedAcademy(userId)` — `db.academy.findUnique({ where: { admin_user_id: userId } })`.

**Depends on / used by:** imports `db`. Presumably called at the top of every `/api/academy/**` route to derive the caller's own academy before any batch/join-request/attendance operation.

### Squads, Associations & Access Control

#### src/lib/squad-access.ts

**Purpose:** Authorization chokepoint for squad-scoped actions (coach/season-tracking subsystem). Determines whether a session user may act on a given `Squad`.

**Exported functions/procedures:**
- `canAccessSquad(user, squadId)` — `true` immediately for `athlasx_ops` (unrestricted). Otherwise loads the squad's `association_id`; returns `false` if the squad doesn't exist. Resolves the caller's association scope via `resolveAssociationScope`; `true` if the squad's association is in that scope. Otherwise checks for a real `squadCoach` row for this `squad_id` + `user_id`; `true` only if that membership row exists. So access is granted via exactly one of: platform-ops role, association-staff membership over the squad's owning association, or a direct coach-assignment row — never a client-asserted role/ID alone.
- `squadIdsForCoach(userId)` — all `squad_id`s where the user has a `squadCoach` row; used so a coach-facing route can resolve "my own squad(s)" from real membership rather than a client-supplied parameter.

**Depends on / used by:** imports `db`, `SessionUser` type (`require-auth.ts`), `resolveAssociationScope` (`association-scope.ts`). Touches `Squad`, `SquadCoach`.

#### src/lib/association-scope.ts

**Purpose:** Resolves which `Association` IDs a caller may act on, derived strictly from their own `AssociationStaff` membership rows — never a client-supplied association ID. This is the foundational scoping primitive that `squad-access.ts` and `player-visibility.ts`'s callers build on.

**Exported functions/procedures:**
- `resolveAssociationScope(user)` — returns `null` for `athlasx_ops` (unrestricted, treated as a superset of every scope check rather than a separate code path elsewhere). For any other role, queries `db.associationStaff.findMany({ where: { user_id } })` and returns the list of `association_id`s — possibly an empty array, which callers must treat as "scoped to zero associations," never as "unscoped."
- `resolveRequestedAssociationScope(user, requestedAssociationId)` — narrows the caller's own scope down to a specific requested association: `null` scope (ops) passes through unrestricted regardless of the request; if no association was requested, returns the caller's full scope; if one was requested but it's *not* in the caller's own scope, returns an **empty array** rather than silently falling back to the caller's actual associations — an explicit request for access the caller doesn't have never quietly substitutes something else.

**Depends on / used by:** imports `db`, `SessionUser` (`require-auth.ts`). Touches `AssociationStaff`. Used by `squad-access.ts`; the `[] | null` scope contract is also the shape `player-visibility.ts`'s `visibilityWhere`/`canViewPlayerProfile` expect their `viewerScope` argument in.

#### src/lib/feature-flags.ts

**Purpose:** A single hand-rolled boolean feature flag — the file's comment explicitly notes there is no flag infrastructure (LaunchDarkly/Statsig/etc.) anywhere in the codebase (confirmed by repo-wide grep) and a real flag service is deliberately out of scope for one flag.

**Exported functions/procedures:**
- `FRANCHISE_SCOUT_ENABLED = false` — gates the `franchise_scout` player-visibility tier, which exists as a valid enum value in the data model but has no scout role, route, or franchise-org qualification logic implemented anywhere yet. The comment stresses this is enforced in three independent places: the UI never offers the option, POST routes reject the value outright, and `canViewPlayerProfile` (`player-visibility.ts`) re-checks the flag even if a row somehow already has the tier set — so flipping this one constant is not, by itself, sufficient to "turn on" the feature if the other two enforcement points were ever removed.

**Depends on / used by:** no imports. Consumed by `player-visibility.ts`.

#### src/lib/chrome.ts

**Purpose:** Static configuration and small pure helpers for the dashboard's navigation "chrome" — which nav sections/links are visible to which role, and how to render a signed-in user's identity badge.

**Exported functions/procedures:**
- `NAV_SECTIONS` — a fixed array of nav sections (`Association`, `Selection`, `Season`, `Player`, `Account`), each with a `roles` allowlist and a list of `{ label, href, badge? }` items (badges are hardcoded static counts like `"2 flags"`, not live-computed here).
- `navSectionsForRole(role)` — filters `NAV_SECTIONS` to those whose `roles` includes the given role.
- `navHrefsForRole(role)` — flat list of every href visible to a role (derived from `navSectionsForRole`).
- `rootDestination(session)` — `/dashboard` if `session.user.id` present, else `/api/auth/signin?callbackUrl=/dashboard`.
- `chromeIdentity(user)` — `{ email, roleLabel }`, mapping the raw role string through a fixed `ROLE_LABELS` dictionary (defaults to `''` for unknown roles).

**Depends on / used by:** imports `UserRole` from `@/types`. Pure UI-config helpers — no DB access; consumed by the dashboard shell/layout component.

### Infrastructure Utilities

#### src/lib/db.ts

**Purpose:** The single shared Prisma client instance, with the standard Next.js dev-mode hot-reload guard (stash the client on `globalThis` outside production so repeated module reloads don't spawn a new `PrismaClient`/connection pool each time).

**Exported functions/procedures:**
- `db` — the singleton `PrismaClient` (`globalForPrisma.prisma ?? new PrismaClient()`); re-stashed on `globalThis` when `NODE_ENV !== 'production'`.

**Depends on / used by:** imports `PrismaClient` from `@prisma/client`. Imported by virtually every other file in this library (`auth.ts`, `identity-resolution.ts`, `dossier.ts`, `academy/*`, `squad-access.ts`, `association-scope.ts`, `verified-performances.ts`, etc.) — this is the DB access root.

#### src/lib/upload.ts

**Purpose:** Minimal, self-contained local-disk file upload helper for trial-registration document/footage fields. The header comment notes no prior upload pattern existed anywhere in the codebase (confirmed via repo-wide search) — this is deliberately narrow, not a general-purpose upload service. Files are validated by magic bytes rather than the client-supplied MIME type, so a renamed/relabeled file can't bypass the allowlist.

**Exported functions/procedures:**
- `saveTrialUpload(dataUri)` — regex-matches a `data:<mime>;base64,<data>` URI (throws `UploadValidationError('Expected a base64 data URI')` if the shape doesn't match); decodes the base64 payload; throws on empty buffer or if it exceeds `MAX_BYTES` (8MB); checks the buffer's leading bytes against a fixed `MAGIC_BYTES` table (JPEG `FF D8 FF`, PNG `89 50 4E 47`, PDF `%PDF`) — throws `'Only JPEG, PNG, or PDF files are accepted'` if none match; creates `public/uploads/trial-docs/` if needed; writes the file under a `crypto.randomUUID()`-generated filename with the detected extension; returns the public URL path (`/uploads/trial-docs/<uuid>.<ext>`) to store on the record.
- `UploadValidationError` — named `Error` subclass for all validation failures above, letting a route handler distinguish "bad upload" (400) from unexpected server errors (500).

**Depends on / used by:** imports Node's `fs/promises` (`writeFile`, `mkdir`), `path`, `crypto`. No DB access itself — the caller is responsible for persisting the returned URL onto whatever record needs it (e.g. a trial `Registration`).

#### src/lib/utils.ts

**Purpose:** Single trivial Tailwind class-name utility, the standard `clsx` + `tailwind-merge` combinator used throughout component code to conditionally compose class strings without Tailwind class conflicts.

**Exported functions/procedures:**
- `cn(...inputs)` — `twMerge(clsx(inputs))`.

**Depends on / used by:** imports `clsx` and `tailwind-merge` (both external packages). Used by UI components across the app, not by other `src/lib` domain files.
## 6. API Route Reference (src/app/api)

All routes read the session via `getSessionUser()`/`requireAuth()`/`requireRole()` in `src/lib/require-auth.ts`, which decodes the NextAuth JWT directly off request cookies with `next-auth/jwt#getToken` (not `getServerSession`, so routes are testable with a bare `NextRequest`). `requireAuth` returns `{ user }` or a `401 { error: "Unauthorized" }` `NextResponse`; `requireRole(req, roles)` additionally 403s with `{ error: "Forbidden" }` if `user.role` isn't in the allowed list. Every handler follows the pattern `const auth = await requireAuth(req); if (auth instanceof NextResponse) return auth;`.

Two scoping helpers recur throughout: `resolveAssociationScope(user)` (`src/lib/association-scope.ts`) returns `null` for `athlasx_ops` (unrestricted) or the array of `AssociationStaff.association_id` rows for the caller — never a client-supplied association id; `resolveRequestedAssociationScope(user, requestedId)` narrows that further, resolving a requested id the caller isn't scoped to down to an **empty** scope rather than falling back to the caller's own associations. `canAccessSquad(user, squadId)` (`src/lib/squad-access.ts`) additionally allows a coach with a real `SquadCoach` row for that squad. `getOwnedAcademy(userId)` (`src/lib/academy/scope.ts`) resolves an `academy_admin`'s own `Academy` row via `Academy.admin_user_id`. `visibilityWhere()`/`canViewPlayerProfile()` (`src/lib/player-visibility.ts`) are the single chokepoint for cross-association player visibility (`visibility_tier`: `association_only` (default) / `cross_association` / `franchise_scout`, the last hard-gated behind `FRANCHISE_SCOUT_ENABLED` and adult-only).

---

### Authentication (auth/[...nextauth])

#### GET/POST /api/auth/[...nextauth]
**Purpose.** Standard NextAuth.js catch-all handler wiring up credentials/session logic for the app.

**Auth/role gating.** None at the route level — NextAuth's own internal logic handles sign-in/sign-out/session/callback sub-routes.

**Procedure.** The file itself is a two-line passthrough: `NextAuth(authOptions)` (from `@/lib/auth`) is exported as both `GET` and `POST`. All actual behavior (credential verification, JWT construction, session shape) lives in `authOptions` in `src/lib/auth.ts`, which is also where `applySessionCookie`/`encodeSessionToken` (used by `claim/verify` and `player/onboard` to sign a caller in without going through this handler) are defined.

**Notable edge cases.** None specific to this file; see `src/lib/auth.ts` for JWT/session callback details if deeper auth internals need documenting.

---

### Player Claiming (claim/*)

#### POST /api/claim/search
**Purpose.** Lets a prospective player find their own unclaimed "shadow" profile (created by association data ingest) before they have any account, as the first step of self-claiming.

**Auth/role gating.** None — deliberately public. Comment in the file explains this is a player identifying *their own* profile pre-authentication, not staff browsing rosters, so it is intentionally exempt from `resolveAssociationScope`/visibility-tier gating (same reasoning as `my-record`'s self-lookup exemption).

**Procedure.** Requires `fullName` and `district` in the JSON body (400 if missing); `dob` is optional. Queries `PlayerProfile` where `claim_status: 'unclaimed'`, `consent_status: { not: 'withdrawn' }`, `district` matches case-insensitively, `full_name` contains the input case-insensitively, and `dob` equals exactly if supplied. Returns up to 10 candidates with `id, full_name, dob, district, state, academy, playing_role, profile_source` — no phone is stored on ingested profiles so matching relies on name+district+DOB.

**Edge cases.** No rate limiting on this endpoint (contrast with `claim/start`'s explicit OTP throttle) — it only returns non-sensitive shadow-profile metadata.

#### POST /api/claim/start
**Purpose.** Starts (or restarts) a claim on a shadow profile and sends an OTP to verify ownership; guardian-mediated for minors.

**Auth/role gating.** None (pre-authentication flow, same as `claim/search`).

**Procedure.** Requires `playerId` and `phone` (400 otherwise). Applies a send-side rate limit via `rateLimit('claim-otp-send', phone, 5, 3600)` — 5 sends/hour keyed by phone (not claim id, since no claim may exist yet) — returning 429 on excess, explicitly to prevent bypassing the verify-side `MAX_ATTEMPTS` cap by simply requesting a fresh OTP. Looks up the `PlayerProfile`; 404 if not found, 409 if `claim_status === 'claimed'`. Computes `isMinor(dob)` (age < 18); if minor, requires `guardianName`, `guardianPhone`, `guardianRelation` (400 otherwise) — the DPDP Act guardian-consent gate. Upserts a `PlayerClaim` keyed on `player_id` with `method: 'guardian_otp' | 'phone_otp'`, `consent_status: 'pending'`. Supersedes any previously active OTP for the claim by marking it `consumed_at` (audit trail preserved, not deleted) before creating a fresh `PhoneOtp` row (hashed code via `hashOtp`, `purpose`, `expires_at`). Returns `{ claimId, isMinor, otpSentTo }` — the raw code is **never** returned in the response (only logged server-side, and only outside production), since this route is reachable pre-auth and would otherwise be a full profile-takeover primitive.

**Edge cases.** Idempotent restart via `upsert`. OTP target phone is the guardian's phone for minors, not the player's own. Dev-only `console.log` of the OTP is gated on `NODE_ENV !== 'production'`.

#### POST /api/claim/verify
**Purpose.** Verifies the OTP; on success grants consent, marks the profile claimed, creates the player's `User` account, and signs them in via a session cookie.

**Auth/role gating.** None (this route itself performs authentication — it *creates* the session).

**Procedure.** Requires `claimId` and `code` (400). Finds the most recent unconsumed `PhoneOtp` for the claim (404 if none). 410 if expired (`isOtpExpired`); 429 if `attempts >= MAX_ATTEMPTS`. On wrong code, increments `attempts` and returns 401. On correct code, runs a `$transaction`: (1) `updateMany` on the OTP row scoped by `{ id, consumed_at: null }` — only the first caller to reach this wins the race, a second concurrent call sees `count === 0` and the transaction returns `null`, yielding a 409 "already used" — this is the explicit fix for a TOCTOU double-verify race; (2) creates a `User` (`role: 'player'`, `linked_player_id`, synthesized email `<phone-digits>@claimed.athlasx.local`); (3) updates `PlayerClaim` to `verified_at`, `consent_status: 'granted'`, `claiming_user_id`; (4) updates `PlayerProfile` to `claim_status: 'claimed'`, `consent_status: 'granted'`, `user_id`. Returns `{ verified: true, playerId }` with a `Set-Cookie` session token via `encodeSessionToken`/`applySessionCookie`.

**Edge cases.** Transactional consume-then-grant prevents double-claiming. Every step logs a structured OTP event (`generated`, `verify_attempt`, `expired`, `verify_failed` with `failureReason`, `verify_success`, `consumed`) via `logOtpEvent`.

#### POST /api/claim/withdraw
**Purpose.** Lets a player withdraw previously granted data-sharing consent, which must immediately stop them being surfaced to selectors.

**Auth/role gating.** `requireAuth` (401 if unauthenticated). Self-service only: after loading the claim, the route derives the caller's own `linked_player_id` from `User` and 403s with `"Forbidden — not your claim"` if it doesn't match `claim.player_id`. Comment notes this used to have **no** auth check at all — anyone who knew/guessed a `claimId` could silently strip another player's visibility (a griefing/DoS vector) — now fixed by binding to the caller's own session-derived identity, never a client-supplied id.

**Procedure.** Requires `claimId` (400). 404 if claim not found. Updates `PlayerClaim.consent_status → 'withdrawn'` (+`consent_withdrawn_at`) and `PlayerProfile.consent_status → 'withdrawn'`. Returns `{ withdrawn: true }`.

**Edge cases.** Downstream read paths (dashboard, candidate-pool, tracking, squads, my-record) are all expected to filter on `consent_status !== 'withdrawn'` — this route is the single write path that flips that flag.

---

### Data Ingest & Identity Exceptions (ingest/*, identity-exceptions/*)

#### GET, POST /api/ingest
**Purpose.** Lists ingest jobs and submits raw association data (via one of several source adapters) for confidence-scored review before it can be written into real Match/Performance rows.

**Auth/role gating.** `requireRole(req, ['association', 'athlasx_ops'])` on both methods.

**Procedure — GET.** Scopes to `resolveAssociationScope`; if scoped, queries `IngestJob` where `association_id` is in scope **or** `null` (4 legacy seed rows predate the `association_id` column and are shown to everyone — accepted as fixture data, not a live leak). Also returns `associationId`: the first association the caller may submit against (from `AssociationStaff`, or any association for `athlasx_ops`), so the ingest page never needs an unscoped client-side pick.

**Procedure — POST.** Body requires `associationId`, `sourceKey`, `payload` (400 otherwise, plus 400 on invalid JSON). Narrows via `resolveRequestedAssociationScope`; 403 if the caller isn't scoped to the requested association. Resolves the adapter via `resolveIngestSource(sourceKey)` (400 `Unknown sourceKey` on failure) — one of 4 source adapters (`src/lib/ingest/registry.ts`). Calls `source.normalize(payload)` to get `{ payload: normalized, confidence }`. Creates an `IngestJob` row (`status: 'pending_review'`, `raw_payload: normalized`) — **nothing downstream (Tournament/Match/Performance) is created at this stage**; that only happens on approval via `[id]/decide`.

**Edge cases.** Confidence scoring happens entirely inside the source adapter at submit time, not decide time.

#### POST /api/ingest/[id]/decide
**Purpose.** Approves or rejects a pending ingest job; approval is the real write path that materializes Tournament/Match/Performance rows and triggers identity resolution and academy-name capture.

**Auth/role gating.** `requireRole(req, ['association', 'athlasx_ops'])`. If the job has an `association_id`, additionally checks `resolveRequestedAssociationScope` and 403s if out of scope.

**Procedure.** Body requires `decision === 'approved' | 'rejected'` (400 otherwise). 404 if job not found; 409 if `job.status !== 'pending_review'`.
- **Rejected**: updates `IngestJob` to `status: 'rejected'`, `reviewed_by`, `reviewed_at`; returns `{ job }`.
- **Approved**: 422 if `job.association_id` or `job.raw_payload` is missing. Everything else runs inside one `$transaction` (20s timeout, explicitly raised from the 5s default to cover several sequential round trips of per-row `resolveIdentity` + `enqueueAcademyCapture` over network latency):
  1. Find-or-create `Tournament`, idempotent on `association_id + name + season`.
  2. Create `Match` (`association_approval_status: 'approved'`, carries `source`/`confidence`/`ingest_method` from the job).
  3. For each performance row in the payload, calls `resolveIdentity({ associationId, nameRaw, dobRaw, districtRaw }, tx)` — every row is resolved to a real player, never guessed. If `outcome === 'AMBIGUOUS'`, updates the matching `IdentityException` with `match_id` and a JSON `performance_snapshot`, and **skips creating a Performance row** (no Performance without a resolved player id). Otherwise creates a `Performance` row linked to `match_id`/`player_id` with batting/bowling stat fields and `confidence_score: job.confidence`.
  4. Deduplicates raw academy-name strings across all performance rows and calls `enqueueAcademyCapture(rawName, source, tx)` for each, creating `AcademyMatchCandidate` rows (feeds `academy-matching/*`).
  5. Updates the `IngestJob` to `status: 'approved'`, `reviewed_by`, `reviewed_at`.
  Returns `{ job, tournamentId, matchId, performancesCreated, identityResolved, identityAmbiguous, academyCandidatesCreated }`.

**Edge cases.** Whole approval is one transaction — a partial write (Match with no Performances, or Performances without identity resolution having run) can never persist. Explicit transaction timeout override documented as intentional, not a symptom of a bug.

#### GET /api/identity-exceptions
**Purpose.** Lists open ambiguous-identity cases raised during ingest approval, for association staff to resolve.

**Auth/role gating.** `requireRole(req, ['association', 'athlasx_ops'])`.

**Procedure.** Scopes via `resolveAssociationScope`; queries `IdentityException` where `status: 'OPEN'` (plus `association_id: { in: scope }` if scoped). Returns `{ exceptions }` ordered newest first.

#### POST /api/identity-exceptions/[id]/confirm
**Purpose.** Resolves an OPEN exception by confirming it belongs to one of its own suggested candidate players.

**Auth/role gating.** `requireRole(req, ['association', 'athlasx_ops'])`, then scope-checked against `exception.association_id` via `resolveAssociationScope` (403 if out of scope).

**Procedure.** 404 if exception not found; 409 if `status !== 'OPEN'`. Body's `playerId` **must** be one of `exception.candidate_player_ids` (400 otherwise) — never an arbitrary id. Inside a `$transaction`: calls `attachSkippedPerformance(tx, exception, targetPlayerId)` (writes the previously-skipped `Performance` row onto that player from the exception's stored snapshot) and updates the exception to `status: 'CONFIRMED'`, `resolved_by_user_id`, `resolved_at`. Catches `AttachSnapshotMissingError` → 422. Returns `{ status: 'CONFIRMED', playerId }`.

**Edge cases.** Never auto-merged — always requires an explicit human-confirmed target id.

#### POST /api/identity-exceptions/[id]/merge
**Purpose.** Same resolution mechanism as `confirm`, semantically distinguished as merging the ambiguous row onto an explicit surviving candidate.

**Auth/role gating.** Identical pattern to `confirm`.

**Procedure.** Identical to `confirm` except the resulting `IdentityException.status` is set to `'MERGED'` instead of `'CONFIRMED'`. Comment notes it does not move or rewrite either player's existing Performance history — only the new snapshot row is written.

#### POST /api/identity-exceptions/[id]/split
**Purpose.** Resolves an exception where the ingested name is judged to be a genuinely new person, not any listed candidate — creates a brand-new unclaimed shadow `PlayerProfile` for them.

**Auth/role gating.** Same `requireRole` + `resolveAssociationScope` pattern as `confirm`/`merge`.

**Procedure.** 404/409 checks identical to `confirm`. Inside a `$transaction`: creates a new `PlayerProfile` from the exception's raw fields (`raw_name`, `raw_dob` defaulting to epoch, `raw_district` defaulting to empty string, `association_id`, `claim_status: 'unclaimed'`, `consent_status: 'not_required'`, `profile_source: 'ingest'`), calls `attachSkippedPerformance(tx, exception, created.id)`, and updates the exception to `status: 'SPLIT'`. Catches `AttachSnapshotMissingError` → 422. Returns `{ status: 'SPLIT', playerId }`.

---

### Grading & Selection (grading/*, candidate-pool)

#### GET /api/grading/session
**Purpose.** Returns the most recent selection session the caller may see, with its full roster of association players (for the grading screen), and whether the caller is the session's chair.

**Auth/role gating.** `requireRole(req, ['selection_panel', 'association', 'athlasx_ops'])`. Selection-panel callers have no `AssociationStaff` row of their own — a distinct identity concept — so the route scopes them separately via a `SelectorProfile.association_id` lookup, in addition to `resolveAssociationScope` for staff/ops. Queries `SelectionSession` where `association_id` is in the combined `[...staffAssociationIds, ...selectorAssociationIds]` **or** `chair_id === caller`, unless unrestricted (`athlasx_ops`).

**Procedure.** Includes the session's association's players (`consent_status !== 'withdrawn'`, ordered by creation), and attaches each player's verified performances via `verifiedPerformancesByPlayer`. Returns `{ session: { id, chair_id, convergence_unlocked_at, players: [...] }, is_chair }`. Returns `{ session: null }` if none found.

**Edge cases.** Comment explains this route used to leak an "acting-as" impersonation pool of every `selection_panel` user; `is_chair` and identity now derive strictly from the caller's own verified session.

#### GET /api/grading/[sessionId]/mine
**Purpose.** Returns only the calling selector's own submitted grades for a session — the read-side half of blind grading.

**Auth/role gating.** `requireRole(req, ['selection_panel'])`.

**Procedure.** `selectorId` is the caller's own id (never a query param — comment flags this as previously accepting a caller-supplied selector id, the same identity-spoofing class fixed across the other grading routes). Queries `Grade` where `selection_session_id` and `selector_id` match, selecting `player_id, overall_grade, notes, submitted_at`.

**Edge cases.** No cross-selector leakage is possible even in principle since the query is always scoped to the caller's own `selector_id`.

#### POST /api/grading/[sessionId]/grade
**Purpose.** Submits or updates one selector's grade (1–10) for one player in a session — the actual blind-grading enforcement point.

**Auth/role gating.** `requireRole(req, ['selection_panel'])`. Comment: `requireAuth` alone previously let *any* authenticated user (player, coach, staff) POST a grade — a live-proved privilege escalation into blind selection grading.

**Procedure.** Body requires `playerId` and `grade` (400); `grade` must be 1–10 (400 otherwise). 404 if session not found; 409 if `session.convergence_unlocked_at` is already set (grading is closed once convergence unlocks). `selector_id` is always `auth.user.id`, never from the body. Upserts `Grade` on the unique `(selection_session_id, selector_id, player_id)` constraint. Returns `{ id, submitted_at }`.

**Edge cases.** The unique constraint plus server-derived `selector_id` is what makes it structurally impossible for a selector to write another selector's row.

#### GET /api/grading/[sessionId]/convergence
**Purpose.** Aggregates every selector's grade per player into a `ConvergenceView` (average, distribution, consensus label) — but only once the chair has unlocked it.

**Auth/role gating.** `requireRole(req, ['selection_panel'])`. 404 if session not found. Access check: allowed if `resolveAssociationScope` covers `session.association_id` (staff/ops), **or** caller is `session.chair_id`, **or** caller has an existing `Grade` row in this session (proves real panel participation) — otherwise 403. This 3-way check exists because selection-panel selectors have no `AssociationStaff` row, so pure staff-membership scoping would lock out legitimate chairs/selectors, while allowing any authenticated caller to guess a `sessionId` would leak grades cross-association.

**Procedure.** 403 with `"Convergence has not been unlocked by the chair yet"` if `!session.convergence_unlocked_at` — this is the server-side half of the blind-grading guarantee (write-side enforced in `grade/route.ts`). Groups all `Grade` rows by `player_id`; computes `average`, a grade-value `distribution`, `spread = max - min`, and `consensus`: `'unanimous'` (spread ≤1), `'split'` (≤3), else `'contested'`. Joins `PlayerProfile` for name/district. Returns `{ views, alreadySelected }` where `alreadySelected` lists `player_id`s already present in `Selection` for this session.

#### POST /api/grading/[sessionId]/lock-squad
**Purpose.** Finalizes the squad: creates one immutable `Selection` row per chosen player and locks the session, ending grading/convergence.

**Auth/role gating.** `requireRole(req, ['selection_panel'])`, then `session.chair_id !== chairId` → 403 `"Only the committee chair can lock the squad"`. `chairId` is always `auth.user.id`.

**Procedure.** Body requires a non-empty `playerIds` array (400). 404 if session not found. 409 if `!session.convergence_unlocked_at` (must unlock first) or if `session.squad_locked_at` is already set (already locked). In one `$transaction`: creates a `Selection` row per player (`rationale: 'Selected via committee convergence'`, `decided_at`, `decided_by: [chairId]`) and updates the session to `status: 'locked'`, `squad_locked_at`. Returns `{ locked: true, count }`.

#### POST /api/grading/[sessionId]/unlock
**Purpose.** Chair-only action that opens the convergence view to the panel, transitioning the session out of blind grading.

**Auth/role gating.** `requireRole(req, ['selection_panel'])`, then a strict `session.chair_id === chairId` check (403 otherwise) — `chairId` derived from the session, never the body (comment: this previously let an unauthenticated caller who merely knew the chair's id unlock convergence, exposing every selector's grade).

**Procedure.** 404 if session not found; 409 if already unlocked. Updates `SelectionSession.convergence_unlocked_at = now()`, `status: 'converging'`. Returns `{ convergence_unlocked_at }`.

#### GET /api/candidate-pool
**Purpose.** Computes and ranks AthlasX scores for every eligible player in the caller's association's most recent selection session, for selectors/staff to review as a leaderboard.

**Auth/role gating.** `requireAuth` only (no specific role restriction beyond authentication).

**Procedure.** Scopes via `resolveAssociationScope`; if scoped to zero associations, returns `{ candidates: [], totalSelectors: 0 }` immediately. Finds the most recent `SelectionSession` within scope (`association_id: { in: scope }` or unrestricted), including the association's players filtered `consent_status !== 'withdrawn'` (comment: this filter is applied at the query itself, not patched after, so no future caller can reintroduce a consent leak). If no session, returns empty. Computes `totalSelectors` (`User` count with `role: 'selection_panel'`), grade counts per player (`Grade.groupBy`), trend-alert flags (`TrendAlert`), and verified performances (`verifiedPerformancesByPlayer`). For each player: maps `playing_role` via `dbRoleMap`, calls `calculateAthlasXScore(...)`, computes `age`, `provenance` label (`getProvenanceLabel`), and assembles a candidate object with `athlasx_score`, `batting_0_to_10`/`bowling_0_to_10` (only if >0), `match_count`, `flag`, `graded_by`/`total_selectors`. Sorts descending by `athlasx_score`, then attaches a computed `percentile` per candidate. Returns `{ candidates, totalSelectors }`.

**Edge cases.** Comment: previously pulled the most-recently-created `SelectionSession` in the *whole* database regardless of caller's association — now properly scoped, since a `SelectionSession` belongs to exactly one association and visibility_tier's cross-association opt-in adds nothing further on top of that.

---

### Squads & Coaching (squads/*, coach/*)

#### GET, POST /api/squads
**Purpose.** Lists squads visible to the caller, and creates a new squad with an initial roster.

**Auth/role gating.** `requireAuth` on both (no role restriction beyond authentication, though POST is documented as intended for association staff/ops).

**Procedure — GET.** Scopes via `resolveAssociationScope`; queries `Squad` where `association_id` is in scope **or** the caller has a `SquadCoach` row for it (so a coach sees squads they're assigned to even if they aren't association staff). Includes counts of players/coaches.

**Procedure — POST.** Body requires `associationId`, `name`, `season` (400 otherwise); optional `trialCycleId`, `playerIds`. Narrows via `resolveRequestedAssociationScope` (403 if out of scope). In one `$transaction`: creates the `Squad`, then bulk-creates `SquadPlayer` rows via `createMany` with `skipDuplicates: true` if `playerIds` given. Returns `{ squad }`.

#### GET /api/squads/[id]
**Purpose.** Returns full squad detail: roster (with player profile fields) and assigned coaches.

**Auth/role gating.** `requireAuth`, then `canAccessSquad(user, params.id)` (403 if false) — allows `athlasx_ops`, association staff scoped to the squad's association, or a coach with a `SquadCoach` row for this specific squad.

**Procedure.** 404 if squad not found. Filters out players with `consent_status === 'withdrawn'` from the roster before returning. Returns `{ squad: { id, name, season, status, players, coaches } }`, with `coaches` mapped to `{ userId, email, isLead }`.

#### POST /api/squads/[id]/coaches
**Purpose.** Assigns a coach to a squad.

**Auth/role gating.** `requireAuth`, then explicit `resolveAssociationScope` check against `squad.association_id` (403 if out of scope) — deliberately **not** `canAccessSquad`, since a coach must not be able to self-assign to a squad (that would make `canAccessSquad`'s own `SquadCoach`-membership check trivially bypassable). Association-staff/ops only in effect.

**Procedure.** 404 if squad not found. Body requires `userId` (400); the target `User` must exist and have `role === 'coach'` (400 otherwise). Upserts `SquadCoach` on `(squad_id, user_id)` with `is_lead`. Returns `{ assignment }`.

#### GET, POST /api/squads/[id]/advisory-notes
**Purpose.** Reads/writes coach advisory notes (fitness/behaviour ratings + free-text) about a squad's players — explicitly advisory-only, with no bearing on AthlasX scoring.

**Auth/role gating.** `requireAuth` + `canAccessSquad` on both methods.

**Procedure — GET.** Returns `CoachAdvisoryNote` rows for the squad, newest first, joined to `player` (`id, full_name`) and `coach` (`id, email`).

**Procedure — POST.** Body requires `playerId` (400) and at least one of `fitnessRating`, `behaviourRating`, `note` (400 otherwise). Validates `playerId` belongs to the squad via a `SquadPlayer` membership lookup (400 if not a member). Creates a `CoachAdvisoryNote` with `coach_user_id: auth.user.id`. Returns `{ note }`.

**Notable security detail.** Comment stresses `CoachAdvisoryNote` has no relationship whatsoever to `Grade`/`Selection` — nothing written here can ever reach `calculateAthlasXScore`, keeping advisory input strictly separate from blind grading/selection scoring.

#### GET, POST /api/squads/[id]/sessions
**Purpose.** Lists a squad's training sessions and creates new ones.

**Auth/role gating.** `requireAuth` + `canAccessSquad` on both.

**Procedure — GET.** Returns `TrainingSession` rows for the squad with an attendance count, newest-first.

**Procedure — POST.** Body requires `sessionDate` (400); optional `notes`. Creates `TrainingSession` with `created_by: auth.user.id`. Returns `{ session }`.

#### GET, POST /api/squads/[id]/sessions/[sessionId]/attendance
**Purpose.** Bulk-marks and reads attendance for one training session.

**Auth/role gating.** `requireAuth` + `canAccessSquad(user, params.id)` on both.

**Procedure — POST.** 404 if the session doesn't exist or doesn't belong to this squad (`session.squad_id !== params.id`). Body requires a non-empty `records: [{ playerId, present }]` array (400). Runs a `$transaction` of `SessionAttendance` upserts keyed on `(training_session_id, player_id)`. Returns `{ marked: records.length }`.

**Procedure — GET.** Returns all `SessionAttendance` rows for the session joined to player `{ id, full_name }`.

#### GET /api/coach/squad
**Purpose.** A coach's (or staff member's) view of one squad's roster with computed AthlasX scores, latest weekly tracking data, and flags — the coach dashboard's main data source.

**Auth/role gating.** `requireAuth`. If `?squadId=` is supplied, validated via `canAccessSquad` (403 if not); otherwise defaults to the caller's own most-recent `SquadCoach` membership (only resolves for an actual assigned coach — staff without a `squadId` get `{ squad: [] }`).

**Procedure.** Loads `SquadPlayer` → `player`, filters out `consent_status === 'withdrawn'`. For each player, joins the latest `PlayerWeek` row (by `week_start desc`) and verified performances (`verifiedPerformancesByPlayer`), computes `calculateAthlasXScore`, `age`, and returns `flag`, `athlasx_score`, `fitness_rating`, `behaviour_rating`, `coach_note` (the last three sourced from `PlayerWeek`, a separate legacy display concept from the newer advisory-notes feature). Returns `{ squadId, squad }`.

**Edge cases.** Comment notes `coachFitnessRating`/`coachBehaviourRating` are deprecated no-ops inside `calculateAthlasXScore` (a documented prior defect) — coach ratings no longer influence the score at all, only shown as separate display fields.

#### POST /api/coach/[playerId]/evaluate
**Purpose.** Records a coach's supervised weekly fitness/behaviour rating and short note for a player.

**Auth/role gating.** `requireAuth` only (no role restriction beyond authentication in this file, though intended for coaches).

**Procedure.** Body fields `fitness`/`behaviour` (1–5, 400 if out of range) and `note` (string, ≤200 chars, 400 otherwise) are all optional but validated if present. Computes `mondayOfCurrentWeek()` and upserts the current week's `PlayerWeek` row on `(player_id, week_start)` — never overwrites history, only the current week. Returns `{ saved: true, id }`.

**Notable detail.** Comment: ratings here are always coach-entered via a form the coach is viewing, never derived from player self-report — "supervised evaluation only."

---

### Trial Cycles & Dossiers (trial-cycles/*)

#### GET, POST /api/trial-cycles
**Purpose.** Lists open/upcoming trial cycles for browsing, and lets association staff create a new cycle with venues.

**Auth/role gating. GET** is deliberately **not** auth-gated — prospective registrants need to browse cycles before having any account (same reasoning as claim/*), and the response carries no PII, only cycle/venue metadata. **POST** requires `requireAuth`.

**Procedure — GET.** Returns all `TrialCycle` rows with `venues`, a `_count` of registrations, and `dossiers_ready` — a real count of registrations whose `Dossier` exists (dossiers are lazy-generated on first view, so this reflects "viewed at least once," not "all pre-generated"; there is no background pre-generation job).

**Procedure — POST.** Body requires `associationId`, `ageCategory`, `dobStart`, `dobEnd`, `regOpens`, `regCloses` (400 otherwise); `feeAmount` defaults to 0; `venues` optional. Narrows via `resolveRequestedAssociationScope` (403 if out of scope). Creates `TrialCycle` with nested `venues.create` from the supplied array, `status: 'registration_open'`. Returns `{ cycle }`.

#### POST /api/trial-cycles/[id]/register
**Purpose.** Player self-registration into a trial cycle at a chosen venue, with document/footage upload.

**Auth/role gating.** `requireAuth` — registering requires a known identity, resolved as the caller's own claimed player profile (`User.linked_player_id`), never a client-supplied `playerId`.

**Procedure.** Body requires `venueId` (400); optional `dobProof`, `residencyProof`, `footageBatting`, `footageBowling`, `footageKeeping`. 400 if caller has no `linked_player_id` ("claim a profile first"). 404 if cycle not found; 409 if `cycle.status !== 'registration_open'`; 400 if `venueId` doesn't belong to this cycle. If a `Registration` already exists for `(trial_cycle_id, player_id)`, returns it directly with `alreadyRegistered: true` (idempotent, no duplicate). Otherwise uploads any supplied files via `saveTrialUpload` (throws `UploadValidationError` → 400 on bad input) and, inside a `$transaction`, appends footage URLs onto `PlayerProfile.footage_urls` (Prisma `push`) and creates the `Registration` (`fee_status: 'pending'` always — no payment gateway exists in the codebase; `documents_uploaded`, `footage_attached` flags). Returns `{ registration }`.

**Edge cases.** Fee status can never programmatically become `'paid'` — acknowledgment-only until a real payment gateway is integrated.

#### GET /api/trial-cycles/[id]/registrations
**Purpose.** Selection-panel-facing list of registrants for a trial cycle, optionally filtered per venue.

**Auth/role gating.** `requireAuth`, then `resolveAssociationScope` checked against the cycle's own `association_id` (403 if out of scope) — comment notes this check was previously entirely missing, letting any authenticated staff view any other association's private registrant list by guessing/enumerating a `cycleId`.

**Procedure.** 404 if cycle not found. Optional `?venueId=` query param filters further. Returns `Registration` rows joined to `player` (`id, full_name, playing_role, district`), `venue` (`id, name`), and `dossier` (`id, has_match_history`).

**Notable security detail.** Deliberately **not** filtered by `visibility_tier` — comment explains a registrant is always visible to the association whose cycle they registered for, regardless of their home profile's visibility tier, since registering is an affirmative action directed at that association (same reasoning as `claim/search`'s exemption).

#### GET /api/trial-cycles/[id]/registrations/[registrationId]/dossier
**Purpose.** Returns (lazily generating on first view) a scouting dossier for one registrant, for selection-panel review.

**Auth/role gating.** `requireAuth` only.

**Procedure.** Calls `getOrGenerateDossier(registrationId)` (`src/lib/dossier.ts`) — 404 if the registration doesn't exist, otherwise generates and caches the `Dossier` on first call (immutable thereafter — no regenerate action in v1). Returns `{ dossier }`.

---

### Academy Matching (academy-matching/*)

#### GET /api/academy-matching
**Purpose.** Lists academy-name candidates awaiting human confirmation — raw academy strings captured during ingest that the fuzzy matcher couldn't confidently resolve, or has tentatively suggested a match for.

**Auth/role gating.** `requireAuth` only.

**Procedure.** Queries `AcademyMatchCandidate` where `status` is `'unmatched'` or `'suggested'`, including the `suggested_academy` (`id, name, district`). Returns `{ candidates }`, newest first.

#### GET /api/academy-matching/production
**Purpose.** Returns aggregated "academy production" analytics (which academies are producing the most/best players), delegated entirely to a helper.

**Auth/role gating.** `requireAuth` only.

**Procedure.** Calls `getAcademyProduction()` (`src/lib/academy-production.ts`) and returns `{ rows }` — all computation logic lives in that helper, not in the route.

#### POST /api/academy-matching/[id]/confirm
**Purpose.** Confirms that a raw ingested academy-name string refers to a specific known `Academy` (either the fuzzy matcher's suggestion or a reviewer-picked alternative), and records the raw string as a known name variant going forward.

**Auth/role gating.** `requireAuth` only.

**Procedure.** 404 if candidate not found. `targetAcademyId` is `body.academyId` if given, else falls back to `candidate.suggested_academy_id`; 400 if neither is available. In one `$transaction`: updates the `AcademyMatchCandidate` to `status: 'confirmed'`, `suggested_academy_id: targetAcademyId`, `reviewed_at`; and pushes `candidate.raw_string` onto the target `Academy.name_variants`. Returns `{ confirmed: true, academyId }`.

**Notable detail.** Comment: never auto-merged — a human always confirms before `name_variants` grows, preventing silent fuzzy-match drift.

#### POST /api/academy-matching/[id]/reject
**Purpose.** Rejects a suggested/unmatched academy candidate as not corresponding to any real academy (or not the suggested one).

**Auth/role gating.** `requireAuth` only.

**Procedure.** 404 if not found. Updates `status: 'rejected'`, `reviewed_at`. Returns `{ rejected: true }`. Same terse pattern as `confirm`, without the `name_variants` write.

---

### Academy Operations — Batches, Attendance, Join Requests (academy/*)

All routes in this group are gated `requireRole(req, ['academy_admin'])` and immediately resolve `getOwnedAcademy(auth.user.id)` (real `Academy.admin_user_id` ownership link — never a client-supplied academy id, mirroring the `resolveAssociationScope`/`canAccessSquad` discipline elsewhere), returning `400 { error: "Set up your academy first" }` if the caller has no owned academy. Business logic is implemented in shared helpers under `src/lib/academy/*` rather than inline in the routes, ported from an earlier branch (`origin/v1-features-sparsh`) onto this codebase's `requireRole` auth convention.

#### GET, POST /api/academy/batches
**Purpose.** Lists an academy's active batches (with roster counts) and creates new batches.

**Procedure — GET.** Queries `AcademyBatch` where `academy_id` matches and `batch_status: 'ACTIVE'`, newest first; joins per-batch player counts via `playerCountsByBatch`. Returns `{ batches }` mapped through `mapBatchRow`.

**Procedure — POST.** Requires `name` (trimmed, non-empty, 400 otherwise) and validates JSON parses (400 on invalid JSON). Optional `age_group` validated via `parseAgeGroup` (400 if invalid), `schedule` validated via `parseSchedule` (400 with the parser's own error message if invalid) and converted to `schedule_days`/`schedule_time` DB fields. `max_players`, if given, must be a positive integer (400 otherwise). Creates `AcademyBatch` with `batch_status: mapBatchStatusToDb('active')`, `created_by_user_id`. Returns `201 { batch }`.

#### GET, POST /api/academy/batches/[batchId]/players
**Purpose.** Reads a batch's roster and adds a player to it.

**Procedure — GET.** Delegates to `listPlayersInBatch(academy.id, batchId)`; returns 404 with the helper's error if not found/owned, else `{ players }`.

**Procedure — POST.** Body requires `player_id` (coerced/trimmed to string). Delegates to `assignPlayerToBatch(academy.id, batchId, playerId)`, surfacing the helper's own status code and error on failure. Returns `{ added }` on success.

#### DELETE /api/academy/batches/[batchId]/players/[playerId]
**Purpose.** Removes a player from a batch.

**Procedure.** Delegates entirely to `removePlayerFromBatch(academy.id, batchId, playerId)`; returns the helper's status/error on failure, else `{ ok: true }`.

#### GET, POST /api/academy/attendance-flags/[playerId]
**Purpose.** Surfaces (and lets staff act on) a follow-up flag for a player with consecutive training absences.

**Procedure — GET.** Accepts `?consecutive_absences=` and `?threshold=` query params (default threshold `DEFAULT_ABSENCE_THRESHOLD`); the route comment notes `consecutive_absences` **must be supplied by the caller** — the batch-scoped session/attendance computation this originally fed from (on the source branch) was not ported here, so this route does not itself compute absence counts from `SessionAttendance`. Calls `loadAttendanceFollowUpForPlayer(academy.id, playerId, consecutive, threshold)` and returns its result directly.

**Procedure — POST.** Body's `action` must be one of `'dismiss' | 'snooze' | 'unsnooze'` (400 otherwise); optional `duration_days`. Delegates to `applyAttendanceFlagAction(academy.id, playerId, action, duration_days)`, returning 400 with the helper's error on failure, else the helper's result directly.

#### GET /api/academy/join-requests
**Purpose.** Lists an academy's pending join requests (players/guardians requesting to join the academy).

**Procedure.** Delegates to `listPendingJoinRequests(academy.id)`, returns `{ requests }`.

#### POST /api/academy/join-requests/[requestId]/approve
**Purpose.** Approves a pending join request, assigning the requesting player into a specific batch.

**Procedure.** Body requires `batch_id` (trimmed, non-empty, 400 otherwise). Delegates to `approveJoinRequest(academy.id, requestId, batchId, auth.user.id)`, surfacing the helper's status/error on failure; returns `{ player_id }` on success.

#### POST /api/academy/join-requests/[requestId]/reject
**Purpose.** Rejects a pending join request.

**Procedure.** Delegates to `rejectJoinRequest(academy.id, requestId, auth.user.id)`; returns the helper's status/error on failure, else `{ ok: true }`.

---

### Player Records & Tracking (my-record, tracking/*, player/onboard, dashboard, associations)

#### GET /api/my-record
**Purpose.** A player's own performance record view: computed AthlasX score, career summary stats, monthly trend, and recent match list.

**Auth/role gating.** `requireAuth` only. Resolves the player strictly via the caller's own `User.linked_player_id` — comment: this replaced a placeholder that arbitrarily returned "whichever profile happened to be claimed first," a real cross-user data leak.

**Procedure.** Returns `{ player: null }` if the caller has no linked player, or if the profile doesn't exist, or if `consent_status === 'withdrawn'`. Loads verified match history via `verifiedMatchHistoryForPlayer`, computes `calculateAthlasXScore` + `getScoreTier`, aggregates batting summary stats (`totalRuns`, `average`, `strikeRate`, `fifties`, `best`), buckets a monthly runs/strike-rate trend from match dates, and returns the last 10 matches. Response shape: `{ player, score, summary, trend, matches }`.

**Notable edge case.** Comment explicitly flags the `consent_status === 'withdrawn'` gate as applied *uniformly* per an audit finding, but questions whether hiding a player's own data from *themselves* after they withdrew consent is the intended UX — flagged as a genuine open product question rather than silently resolved.

#### GET /api/tracking
**Purpose.** Lists all players with active trend alerts (e.g. form drop) for coach/staff review, with a full weekly performance trend per player.

**Auth/role gating.** `requireAuth` only, but the underlying `PlayerProfile` visibility is scoped: since `TrendAlert` has no `association_id` of its own, the route resolves `resolveAssociationScope` and applies `visibilityWhere(scope)` when loading players — comment notes this previously joined `TrendAlert` straight to `PlayerProfile` with **no** visibility check at all, letting any authenticated caller see every association's flagged players.

**Procedure.** Loads all `TrendAlert` rows, collects distinct `player_id`s, then loads `PlayerProfile` filtered by `id IN (...)`, `consent_status !== 'withdrawn'`, **and** `visibilityWhere(scope)` combined via `AND` — filtering the id set itself, not just display fields, so a filtered-out player never appears anywhere in the response. Joins each player's `PlayerWeek` history for a trend array (`runs`, `wickets`, `score` per week) plus `score_delta` between first and latest week. Returns `{ players: tracked }`.

#### POST /api/tracking/[playerId]/note
**Purpose.** Lets a coach attach a short advisory note to a player's most recent tracking week.

**Auth/role gating.** `requireAuth` only.

**Procedure.** Body's `note` must be a string ≤200 characters (400 otherwise) — enforced server-side since selectors read this value as-is, not just a UI limit. Finds the most recent `PlayerWeek` for the player (404 if none exists — a week must already exist from tracking computation before a note can attach). Updates `coach_note`, `coach_note_at`. Returns `{ saved: true }`.

#### POST /api/player/onboard
**Purpose.** Full self-registration wizard for a new player: creates their `User` + `PlayerProfile` account directly (distinct from the OTP-verified `claim/*` flow) and signs them in.

**Auth/role gating.** None (this route performs account creation/authentication itself).

**Procedure.** Parses and type-checks the body defensively (400 on invalid/non-object JSON). **Explicitly rejects the request (400) if the body contains any key from a hardcoded `MATCH_STAT_KEYS` set** (e.g. `runs`, `wickets`, `average`, `strike_rate`, `performances`, etc.) — with the message "Match statistics are not accepted. Scores come from ingested scorecards only," preventing a player from self-reporting stats that would otherwise feed the scoring pipeline. Requires `email`, `password`, `fullName`, valid `dob`, `district`, `state`, and a `playingRole` mapped through a fixed enum table (`PLAYING_ROLE`) — 400 if any is missing/invalid. Computes `isUnder18(dob)`; if minor, requires `guardianPhone` (400 otherwise) — though the comment notes this wizard only *stores* the guardian phone and signs the player in directly; it does not perform guardian OTP verification (that's `claim/*`'s job) — `consent_status` is set to `'pending'` for minors, `'granted'` for adults. Hashes the password (`hashPassword`) and, in one `$transaction`, creates a `User` with a nested `player_profile.create` (`profile_source: 'self_registered'`, `claim_status: 'claimed'`), mapping optional `battingStyle`/`bowlingStyle`/`selectedFormats` through fixed enum tables and folding free-text fields (`bio`, `cricheroes_handle`, `yearsExperience`) into a single `bio` string via `foldBio`; then updates the new `User.linked_player_id` to point at the created profile. On `P2002` unique-constraint violation (duplicate email), returns 409. On success, signs the player in via `encodeSessionToken`/`applySessionCookie` and returns `{ playerId }`.

**Notable detail.** The `MATCH_STAT_KEYS` rejection is a deliberate business-rule/security control: self-reported stats must never enter the same fields that ingest-derived, verified performances populate.

#### GET /api/dashboard
**Purpose.** Aggregate KPI/pipeline dashboard for association staff, selection-panel, coach, and ops users — registration counts, ingest pipeline status, grading progress, score distribution, active flags, recent activity feed.

**Auth/role gating.** `requireRole(req, ['association', 'selection_panel', 'coach', 'athlasx_ops'])`.

**Procedure.** Resolves the caller's `association` via `resolveAssociationScope` (unrestricted → first `Association` row overall; scoped → first association within scope, or `null` if scope is empty) — comment stresses this replaced an "arbitrary first row in the table" placeholder. Loads that association's non-withdrawn players. Computes: `registrations` (global `Registration` count), `pendingIngest`/`totalIngestJobs` (`IngestJob` counts), `formDropAlerts`/`trackedCount` (`TrendAlert` counts), `trialCycles` count, the most recent `SelectionSession` and its grading completion label/`gradingDone` flag (`gradeCount / (players × totalSelectors)`), `claimedCount`. Builds a registration-trend running total by day, a score-distribution histogram (via `calculateAthlasXScore`, bucketed into 5 bands, **only counting players with `verifiedMatchCount > 0`** — a player with no verified history is honestly excluded rather than fabricated into a band), an `activeFlags` list from recent `TrendAlert`s (excluding withdrawn-consent players), and a merged `activity` feed from recent ingest jobs, alerts, and trial cycles, sorted by time and human-relative-formatted (`timeAgo`). Returns `{ kpis, pipeline, registrationTrend, scoreDist, activeFlags, activity }`.

**Notable edge case — explicitly flagged as unfixed, not silently left.** A large block of counts (`registrations`, `pendingIngest`, `formDropAlerts`, `trialCycles`, `totalIngestJobs`, `session`, `claimedCount`, and the derived alerts/activity feeds) are **global across every association**, not filtered to the caller's own association/scope — the comment states this auth-hardening pass only fixed unauthenticated access (the route is no longer servable to an anonymous caller); a real `association_staff` user today still sees cross-association aggregate numbers in these fields. Only the `players` list itself (used for `scoreDist`) is properly association-scoped.

#### GET /api/associations
**Purpose.** Simple lookup list of all associations (id/name/state), used to populate selectors/dropdowns elsewhere in the app.

**Auth/role gating.** `requireAuth` only — no association-scoping applied.

**Procedure.** Returns `{ associations }` — all rows via `db.association.findMany({ select: { id, name, state } })`, unfiltered. No pagination, no scope restriction (this is a directory listing of associations themselves, not player/roster data, so no cross-association visibility concern applies).
## 7. Pages, Layouts & Components Reference

> Scope note: `find src/app -name 'page.tsx' -o -name 'layout.tsx'` and `find src/components -type f` were run against the live repo before writing this doc. The current file set matches the originally supplied list exactly — no `academy/` page group exists under `src/app/(dashboard)/` yet, and no new files exist under `src/components/`. However, a backend API surface for academy administration already exists (`src/app/api/academy/**`, gated by `requireRole(req, ["academy_admin"])`, plus `src/lib/academy/scope.ts`), and `academy_admin` is used as a role string in those routes — but `academy_admin` is **not** part of the `UserRole` union in `src/types/index.ts`, is not in `NAV_SECTIONS` (`src/lib/chrome.ts`), and has no corresponding page or sidebar entry. This looks like a partially-ported feature: the API/data layer for academy admins exists, the frontend does not yet. Flagged here so it isn't mistaken for an oversight during review.

---

### App Shell & Layouts

#### / — src/app/layout.tsx
**Purpose.** Root HTML document for the whole app (both public and authenticated routes). Sets global metadata (`title: 'AthlasX'`, description) and mounts the global stylesheet (`./globals.css`).

**Data flow.** Server component. Calls `getServerSession(authOptions)` (NextAuth, from `@/lib/auth`) once per request and passes the resulting `session` into `<Providers session={session}>`, which wraps `children`. This is what makes `useSession()` available to every client component in the tree without an extra client-side fetch on first paint.

**Key interactions.** None directly — this is pure composition. All auth/session plumbing is delegated to `Providers`.

#### (dashboard) layout — src/app/(dashboard)/layout.tsx
**Purpose.** Authenticated app shell for every route inside the `(dashboard)` route group (dashboard, trial-cycles, ingest, academy-matching, selection, grading, convergence, tracking, coach, profile, record, notifications, settings).

**Data flow.** Server component, no data fetching of its own. Renders `<DashboardSidebar />` (fixed left rail, `lg:pl-60` offset on `<main>`) and `{children}` inside a `min-h-screen bg-[#050505]` wrapper. All auth/role gating happens inside `DashboardSidebar` (which reads `useSession()`) and inside each page's own API calls — this layout itself does not redirect unauthenticated users.

**Key interactions.** None — purely structural (sidebar + content area).

---

### Public/Pre-auth Pages

#### / — src/app/page.tsx
**Purpose.** Public landing/marketing entry point. Used by anonymous visitors and as the post-login redirect target check.

**Data flow.** Server component (`RootPage`). Calls `getServerSession(authOptions)`; if `session?.user?.id` exists it `redirect('/dashboard')` immediately. Otherwise renders `<HeroLanding />` (a marketing component, not a redirect to sign-in). A code comment explicitly notes this replaced an earlier behavior where signed-out visitors were redirected straight to the sign-in form with no public content.

**Key interactions.** No forms. The only interactive elements are anchor links to `/api/auth/signin?callbackUrl=/dashboard` (NextAuth's built-in sign-in page), rendered inside `HeroLanding`.

#### /claim — src/app/claim/page.tsx
**Purpose.** "W2 — Player claim flow" per the in-file comment. Lets a player who already has a *shadow profile* (created from ingested association data — CricHeroes sync, OCR, manual upload — before they ever had an account) find that profile and take ownership of it via phone OTP. Used by role `player` (pre-account, since claiming a profile is how many players get an account at all). Under-18 players cannot self-verify — the OTP is sent to a guardian's phone instead, framed as a DPDP Act (India's data-protection law) consent requirement.

**Data flow.** Client component (`'use client'`) with a linear step state machine: `type Step = 'search' | 'select' | 'details' | 'otp' | 'done'`. Sequence of API calls:
1. `POST /api/claim/search` with `{ fullName, district, dob }` → returns `candidates: Candidate[]`. Empty result shows an inline error and stays on `search`; non-empty moves to `select`.
2. Selecting a candidate computes `isMinor` client-side via `minorFromDob(dob)` (age = now − dob in ms, /365.25 days, `< 18`) and moves to `details`.
3. `POST /api/claim/start` with `{ playerId, phone, guardianName?, guardianPhone?, guardianRelation? }` (guardian fields only sent when `isMinor`) → returns `{ claimId, otpSentTo, devOtp }`. `devOtp` is shown directly in the UI as a "Dev mode — no SMS gateway connected" notice — a deliberate placeholder until `SMS_GATEWAY_API_KEY` is configured server-side.
4. `POST /api/claim/verify` with `{ claimId, code }` → on success moves to `done`, shows a `sonner` toast ("Profile claimed. Consent recorded."), and offers a link to `/dashboard`.

**Key interactions/validation.** "Search" button disabled until `fullName` and `district` are filled. OTP input is client-sanitized to digits only, capped at 6 chars (`code.replace(/\D/g, '').slice(0, 6)`), and "Verify & Claim" is disabled until exactly 6 digits are entered. For minors, `handleStartClaim` is blocked client-side unless `guardianName`, `guardianPhone`, and `guardianRelation` are all present. Uses the shared `Button`/`Input`/`Label` UI primitives.

#### /player/onboarding — src/app/player/onboarding/page.tsx
**Purpose.** Self-registration flow for a brand-new player account (as opposed to claiming an existing shadow profile via `/claim`). Role: `player`. A header comment states the design intent explicitly: it collects identity, playing role, and footage links, but deliberately does **not** collect self-reported stats (those only ever come from ingested scorecard data) or fitness/behaviour ratings (coach-supervised only).

**Data flow.** Client component, 4-step wizard (`TOTAL_STEPS = 4`) driven by a single `form` state object covering Identity → Playing Profile → Footage & Bio → Review. On final step, `POST /api/player/onboard` with the entire `form` object as JSON. On success: `toast.success(...)`, then `router.push('/dashboard')`. On failure: `toast.error(...)` with the server's `error` message or a generic fallback.

**Key interactions/validation.**
- `isUnder18(dob)` (same age formula as `/claim`) drives an animated conditional field: a **Guardian phone** input appears (with a DPDP Act consent notice) only when the player is a minor.
- `canProceed()` gates the "Continue"/"Create Profile" button per step: step 1 requires `fullName, dob, district, state, email, password` (plus `guardianPhone` if minor); step 2 requires `playingRole`; steps 3–4 have no required fields (footage/bio are optional, bio capped at 400 chars with a live counter).
- Step 2 uses button-group selectors (not native `<select>`) for playing role, batting style, bowling style, and a multi-select toggle (`toggleFormat`) for preferred formats (T20/ODI/Test/T10).
- Step 4 (Review) renders a read-only summary table of the form and a "What happens next" checklist that includes a guardian-OTP line item only for minors.
- Progress bar width is `(step / TOTAL_STEPS) * 100`, animated with framer-motion.

---

### Dashboard Pages

#### /dashboard — (dashboard)/dashboard/page.tsx
**Purpose.** "Association Overview" — the landing screen after login for association/ops roles (`association`, `athlasx_ops`, per `NAV_SECTIONS`). Season-level KPIs, the W3 registration→dossier pipeline status, registration trend, score distribution, active tracking flags, and a recent-activity feed.

**Data flow.** Client component. Single fetch on mount: `GET /api/dashboard` → `DashboardData` shape: `{ kpis: {registrations, dossiersReady, pendingIngest, formDropAlerts}, pipeline: [{label, href, done, count}], registrationTrend: [{day, count}], scoreDist: [{band, count}], activeFlags: [{name, flag, detail}], activity: [{text, type, time}] }`. No further requests; all widgets render from this one payload.

**Key interactions.** No forms/mutations. Purely a read-only aggregate view with client-side chart rendering via `recharts` (`AreaChart` for registration trend, `BarChart` for score distribution — both driven straight off server-computed bucketed data). `Link` buttons route to `/trial-cycles` and `/tracking`. `AnimatedCounter` (shared component) animates KPI numbers from 0 to their server value on load.

#### /trial-cycles — (dashboard)/trial-cycles/page.tsx
**Purpose.** Association-facing management of trial cycles: registration windows, venues, fee, and the W3 pipeline (ingest → identity resolution → cycle published → dossiers generated → camp check-in). Role: `association` / `athlasx_ops`.

**Data flow.** Client component. On mount, fetches in parallel: `GET /api/trial-cycles` (→ `cycles: Cycle[]`) and `GET /api/associations` (→ picks `associations[0].id` as the acting `associationId` — i.e. the UI assumes a single association scope per session rather than doing its own auth-derived lookup). Cycle cards derive `daysLeft` client-side from `registration_closes`.

**Key interactions/procedures.**
- "New Trial Cycle" button opens `CreateCycleModal`, a 3-step wizard (`STEPS = 3`): Step 1 = age category + DOB window + registration window + fee; Step 2 = one-or-more venues (dynamic add via "+ Add another venue"); Step 3 = read-only confirmation summary with an explicit warning that publishing opens registration to players.
- Step 1 gates "Next" via `canProceedStep1` (all 5 fields non-empty).
- Final step submits `POST /api/trial-cycles` with `{ associationId, ageCategory, dobStart, dobEnd, regOpens, regCloses, feeAmount: Number(...), venues: [...non-empty rows] }`. On success the new cycle (with `registrations: 0, dossiers_ready: 0` prepended client-side) is unshifted into local state and the modal closes; on failure the server's `error` is shown inline in the modal.
- Each `CycleCard` shows dossier-readiness as a progress bar (`dossiers_ready / registrations`) only when `status === 'registration_open'`, with a note that dossiers "generate automatically when registration closes."

#### /trial-cycles/[id]/register — (dashboard)/trial-cycles/[id]/register/page.tsx + RegisterClient.tsx
**Purpose.** Player-facing registration form for a specific trial cycle (route param `id` = cycle id). Role: `player`.

**Data flow.** `page.tsx` is a thin async server component that awaits the `params` promise (`{ id }`) and renders `<RegisterClient cycleId={id} />` — all logic lives in the client component. `RegisterClient` fetches `GET /api/trial-cycles` on mount and finds the matching cycle client-side (`d.cycles?.find(c => c.id === cycleId)`) rather than hitting a dedicated single-cycle endpoint.

**Key interactions/procedures.**
- Venue is chosen via a `<select>` populated from `cycle.venues`.
- A fee-acknowledgement checkbox is required (`feeAcknowledged`) — the copy is explicit that **no online payment is collected**; the fee is paid in cash at the venue, and registration is saved regardless of payment.
- Optional file uploads: DOB proof, residency proof (JPEG/PNG/PDF), and a "batting clip" (currently constrained to the same image/PDF accept list — described in-UI as an "image/PDF placeholder", i.e. video upload isn't wired yet). Files are converted to data-URIs client-side via `toDataUri()` (`FileReader.readAsDataURL`) before submission — so uploads travel as base64 strings in the JSON body, not multipart.
- Submit validates `venueId` and `feeAcknowledged` client-side, then `POST /api/trial-cycles/[cycleId]/register` with `{ venueId, dobProof?, residencyProof?, footageBatting? }` (each proof field only included if a file was chosen). On success shows a confirmation screen with the fee amount; on failure shows the server's `error`.

#### /trial-cycles/[id]/dossiers — (dashboard)/trial-cycles/[id]/dossiers/page.tsx + DossiersClient.tsx
**Purpose.** Selection/association-facing pre-camp dossier viewer for a trial cycle's registrants. Role: `selection_panel` / `association`.

**Data flow.** `page.tsx` again just unwraps `params` and delegates to `<DossiersClient cycleId={id} />`. `DossiersClient` fetches `GET /api/trial-cycles/[cycleId]/registrations` → `registrations: RegistrationRow[]` (each with nested `player`, `venue`, and an optional `dossier` stub `{id, has_match_history}`). Selecting a row in the left list mounts a nested `DossierDetail` component that fetches `GET /api/trial-cycles/[cycleId]/registrations/[registrationId]/dossier` → full `DossierData` (`has_match_history`, `percentile_vs_cohort`, `contents_snapshot: {batting, bowling, total, match_count, cohort_size, recent_form[]}`).

**Key interactions.** Two-pane master/detail UI (list left, detail right), no mutations. `DossierDetail` explicitly branches on `has_match_history`: if false, shows a "Thin dossier" notice instead of stats. Percentile is shown only if `percentile_vs_cohort !== null`; otherwise a message explains the cohort is below the reliability floor, with `cohort_size` shown for transparency.

#### /ingest — (dashboard)/ingest/page.tsx
**Purpose.** "W1 — Import match data." Central data-ingestion console for associations: connect/sync sources, upload files, and review/approve or reject queued ingest jobs before their rows enter the system. Role: `association` / `athlasx_ops`.

**Data flow.** Client component. `refreshJobs()` calls `GET /api/ingest` → `{ jobs: IngestJob[], associationId }`; `associationId` is cached in state and used to scope subsequent submissions. Uses `mapCsvToIngestPayload` (`@/lib/ingest/csv-to-payload`) to convert an uploaded CSV's text into the same payload shape the API expects, and `INGEST_CSV_HEADERS` to generate a downloadable CSV template (built client-side as a `Blob`/object URL, no network round trip). `CRICHEROES_SYNC_FIXTURE` (`@/lib/ingest/fixtures/cricheroes-sync`) is a hardcoded, documented fixture used for a "Sync now" button — the CricHeroes card is explicitly labeled "Offline — documented fixture", i.e. there is no live CricHeroes API call.

**Key interactions/procedures.**
- Three source cards: **CricHeroes** ("Sync now" → `postPayload('api_sync', CRICHEROES_SYNC_FIXTURE)`), **Scorecard PDFs** (display-only progress bar, not wired to an actual upload — "84% confidence" is a static illustrative value), **Excel/CSV** (hidden file input → `handleFile`).
- A generic drag-and-drop `UploadZone` accepts `.json`/`.csv`; `.csv` files go through `mapCsvToIngestPayload` → `postPayload('excel_mapper', ...)`, `.json` files are `JSON.parse`d directly → `postPayload('structured_parser', ...)`. Any other extension sets an inline error ("JSON or CSV only — no PDF/OCR product in this slice").
- `postPayload(sourceKey, payload)` → `POST /api/ingest` with `{ associationId, sourceKey, payload }`; blocked client-side if `associationId` is still null. On success, `refreshJobs()` re-pulls the list; on failure the server's `error` (or "Submit failed") is shown.
- Clicking "Review" on a `pending_review` job opens a slide-over `JobPanel` showing tournament name, match/row/conflict counts, a synthetic "confidence breakdown" (name matching / date consistency / score integrity, all derived from the single `job.confidence` value with small offsets — not independently measured), and Approve/Reject buttons that call `POST /api/ingest/[jobId]/decide` with `{ decision: 'approved'|'rejected' }`. A note in the panel states the provenance fields (`source, ingest_method, confidence_score, association_approval_status`) travel permanently with the resulting `Performance` record.

#### /academy-matching — (dashboard)/academy-matching/page.tsx
**Purpose.** "W8 — Academy affiliation reconciliation," per the in-file comment. Ingested academy names arrive as free-text strings (never a stable ID); this page is where a human confirms or rejects the fuzzy-matcher's (`src/lib/string-similarity.ts`) suggested links against the canonical Academy registry — explicitly "never auto-merged." Role: `association` / `athlasx_ops`.

**Data flow.** Client component with two tabs, each independently loaded:
- **Reconciliation Queue** (`tab === 'queue'`): `load()` calls `GET /api/academy-matching` → `candidates: Candidate[]` (`raw_string`, `source`, `similarity_score`, `status: 'unmatched'|'suggested'`, `suggested_academy`).
- **Production Ranking** (`tab === 'production'`): separate effect calls `GET /api/academy-matching/production` → `rows: ProductionRow[]` (academy, district, affiliated player count, players advanced to district+).

**Key interactions/procedures.** For each queued candidate: "Confirm" (only shown when a `suggested_academy` exists) → `POST /api/academy-matching/[id]/confirm` with `{ academyId }`, then reloads the queue. "Reject" → `POST /api/academy-matching/[id]/reject` (no body), then reloads. Both set a `busyId` to disable the row's buttons mid-request. Candidates without a confident match show an amber "No confident match found" notice instead of a Confirm button.

#### /selection — (dashboard)/selection/page.tsx
**Purpose.** "Candidate Pool" — the full list of trial candidates for selectors to search/filter and jump into grading from. Role: `selection_panel` / `athlasx_ops`.

**Data flow.** Client component. Single fetch: `GET /api/candidate-pool` → `candidates: Candidate[]` (id, name, age, district, `playing_role`, `athlasx_score`, optional batting/bowling 0–10, `match_count`, `percentile`, `flag`, `graded_by`, `total_selectors`). All filtering (search text, role) happens client-side over the already-fetched array — no server-side query params.

**Key interactions.** Text search matches against `name` or `district` (case-insensitive substring). Role filter is a button group (`All`, `Batsman`, `Bowler`, `All-rounder`, `Wicket-keeper Batsman`). Summary tiles (`Total registered`, `With match history`, `Fully graded`, `Not yet started`) are all derived client-side from the same `candidates` array. Each row shows a `GradeProgress` badge (`graded_by`/`total_selectors`) and links conceptually toward grading (row is clickable/hoverable but the actual navigation target — presumably `/grading`— is implied by cursor styling rather than an explicit `<Link>` in this file). No mutations on this page.

#### /grading — (dashboard)/grading/page.tsx
**Purpose.** "Blind Grading" — where an individual selector enters their independent 1–10 grade per candidate, based on a "Quick View" (batting/bowling scorecard-derived stats only — fielding/keeping deliberately excluded because scorecards only record successful attempts). This is the core of the blind-selection design principle called out repeatedly across the app: no selector can see another's grade until the chair unlocks convergence, and the page's own comment states this boundary is **server-enforced**, not decided by the page. Role: `selection_panel`, with an extra chair capability.

**Data flow.** Client component.
- `GET /api/grading/session` → `{ session: { id, convergence_unlocked_at, players: DbPlayer[] }, is_chair }`. `players` (raw `DbPlayer[]` with nested `performances: VerifiedPerformanceRow[]`) is transformed client-side by `buildQvPool()`, which calls `calculateAthlasXScore()` (`@/lib/athlasx-score`) per player (using `dbRoleMap` from `@/lib/mock-performance-seed` to normalize the raw `playing_role` string) to derive `batting_0_to_10`, `bowling_0_to_10`, `match_count`, `tqi_weighted`, and `top_level` (highest tournament level in that player's verified performances, via local `topLevelOf()`). So the score math itself is shared library logic, not duplicated per-page.
- `GET /api/grading/[sessionId]/mine` → the current selector's own previously-submitted grades, keyed into local `grades: Record<playerId, number>`.

**Key interactions/procedures.**
- Selecting a player from the list opens a right-hand panel: `QuickViewCard` (read-only batting/bowling bars + a `getProvenanceLabel()` string) plus `GradePanel`.
- `GradePanel`: number-grid grade picker (1–10) + optional notes (300 char cap), disabled once `locked` (i.e. `convergence_unlocked_at` is set) with a "Grading is closed" message. Submitting calls `POST /api/grading/[sessionId]/grade` with `{ playerId, grade, notes }`; on success updates local `grades` state so the row shows "Grade: N" immediately.
- If `is_chair` and not yet locked, an "Unlock convergence" button calls `POST /api/grading/[sessionId]/unlock` (no body) and stores the returned `convergence_unlocked_at`, which flips every grade panel to read-only across the page.
- Empty-session state explicitly tells the developer/operator to "Run prisma/seed.ts against the database to create one" — evidence this page assumes a specific seeded `SelectionSession` exists.

#### /convergence — (dashboard)/convergence/page.tsx
**Purpose.** Post-unlock aggregate view of all selectors' grades per candidate — shows the full grade spread, a consensus classification (unanimous/split/contested), and is where the final squad gets locked. Role: `selection_panel` (chair for the lock action, though the lock button itself isn't separately gated by `is_chair` in this file — it's gated only by `selected.size > 0`).

**Data flow.** Client component. On mount: `GET /api/grading/session` → checks `data.session.convergence_unlocked_at`; if unset, renders a "Locked — waiting for chair" state without further fetches. If set, calls `GET /api/grading/[sessionId]/convergence` → `{ views: ConvergenceRow[], alreadySelected: string[] }` (`ConvergenceRow`: `player_id, name, district, grades[], average, consensus`). A non-OK response here surfaces the server's `error` inline.

**Key interactions/procedures.**
- Sort control (`avg_desc` / `avg_asc` / `contested`-first) is purely client-side over the fetched `rows`.
- `consensus` buckets (`unanimous`/`split`/`contested`) are tallied and surfaced as three stat tiles; a contested-count banner appears when `contested > 0`, prompting the sort-by-contested view before locking.
- Each row has a checkbox (disabled once already in `alreadySelected`) to mark a player for the final squad; `selected` is a `Set<string>` of player ids.
- "Lock Final Squad" → `POST /api/grading/[sessionId]/lock-squad` with `{ playerIds: Array.from(selected) }`. On success, those ids are merged into `alreadySelected` and `selected` is cleared (rows become permanently checked/disabled — copy states "Once locked, selections are immutable"). On failure, shows the server error.
- `GradeDistribution` renders a small 1–10 histogram per row from the raw `grades[]` array (client-side bucketing, not server-aggregated).

#### /tracking — (dashboard)/tracking/page.tsx
**Purpose.** "W5 · In-season performance monitoring" — weekly form tracking across the season, surfacing form-drop / on-form / below-threshold flags with a selector-facing "deep view." Role: `coach` / `selection_panel` (per `NAV_SECTIONS`, this is under the "Season" section shown to `coach` and `athlasx_ops`, but the in-page comment on `DeepView` calls it the "Selector Deep View (W5)" — so both coach and selector-facing consumption is implied).

**Data flow.** Client component. Single fetch: `GET /api/tracking` → `players: TrackedPlayer[]` (id, name, district, `playing_role`, `flag: FlagType`, `athlasx_score`, `score_delta`, optional `consecutive_declines`, `coach_note`, `skill_dimension`, and a `trend: WeekEntry[]` array for sparkline/detail rendering).

**Key interactions.** A dedicated banner row lists every `form_drop`-flagged player with a one-click "Deep view" button. A flag filter (`all` / `form_drop` / `on_form` / `none`) filters the main list client-side. Clicking "View"/"Deep view" on any row opens the `DeepView` slide-over: flag panel, an inline SVG `Sparkline` of the score trend (color flips red/green based on whether the last point exceeds the first), a per-week breakdown grid, and the read-only coach note — explicitly captioned "advisory only" and stated not to affect the AthlasX score, with raw coach evaluations noted as coach-only access (i.e. this page is a *consumer* of coach notes, not where they're written — that's `/coach`). No mutations happen on this page.

#### /coach — (dashboard)/coach/page.tsx
**Purpose.** "W7 · Supervised evaluations + squad notes" — where a coach records fitness/behaviour ratings and an advisory note per squad player. Explicitly "coach-supervised only... never from player self-report," and raw ratings are stated to be coach-only (selectors only ever see the advisory note + flag, consistent with `/tracking`'s `DeepView`). Role: `coach`.

**Data flow.** Client component. `GET /api/coach/squad` → `squad: CoachPlayer[]` (id, name, age, district, optional `fitness_rating`/`behaviour_rating`/`coach_note`, `flag`, `athlasx_score`).

**Key interactions/procedures.** Clicking a squad row expands an inline `EvalForm`: two 1–5 rating rows (Fitness, Behaviour) via button grids, and a 200-char-capped note textarea. "Save Evaluation" calls `handleSave` → `POST /api/coach/[playerId]/evaluate` with `{ fitness, behaviour, note }`; on success the local `squad` array is patched in place (`prev.map(...)`) so the row's Fit/Beh badges update immediately, and the button shows a 2-second "Saved to server" confirmation state. A header counter shows how many squad members still lack `fitness_rating` ("N need evaluation").

#### /profile — (dashboard)/profile/page.tsx
**Purpose.** Minimal "My Profile" screen showing the signed-in user's identity. Role: any authenticated user, but positioned under the "Player" nav section in `NAV_SECTIONS` (shown to `player`/`athlasx_ops`).

**Data flow.** Client component. No API calls — reads `useSession()` directly and passes `session?.user` through `chromeIdentity()` (`@/lib/chrome`) to get `{ email, roleLabel }` for display. Purely session-derived, no server round trip beyond the session itself.

**Key interactions.** None — read-only display of email + role label with initials-style avatar.

#### /record — (dashboard)/record/page.tsx
**Purpose.** "My Record" — a player's own verified-match dashboard: AthlasX score breakdown, summary stats, runs/strike-rate trend charts, and a match-by-match log. Role: `player`.

**Data flow.** Client component. Single fetch: `GET /api/my-record` → response is only accepted if `d.player` is truthy (`setData(d.player ? d : null)`), so an unclaimed/no-profile player sees the "No claimed player profile found" empty state pointing them to `/claim`. Shape: `{ player: {id, full_name, playing_role}, score: {total, tier, batting, bowling, fitness, fitnessAssessed}, summary: {matches, runs, average, strikeRate, fifties, best}, trend: [{label, runs, sr}], matches: [{id, opponent, tournament, date, level, runs?, balls?, sr?}] }`.

**Key interactions.** Read-only. Charts via `recharts` (`AreaChart` for runs trend, `BarChart` for strike-rate trend). Fitness score shows "0" with a "Not assessed" caption when `fitnessAssessed` is false, distinguishing an actual coach-supervised zero from "not yet done." Match level badges are color-coded (`local`/`district`/`state`/`national`). Footer note reiterates that only association-approved data enters the score.

#### /notifications — (dashboard)/notifications/page.tsx
**Purpose.** Simple notifications/activity feed (flags, ingest jobs, cycle updates). Role: shown to all roles (in the "Account" `NAV_SECTIONS` entry).

**Data flow.** Client component, but currently **fully static** — the `notifications` array is a hardcoded local constant (3 hand-written entries), not fetched from any API. This is a placeholder/stub relative to the sidebar's "3" badge convention seen elsewhere.

**Key interactions.** None — display only.

#### /settings — (dashboard)/settings/page.tsx
**Purpose.** Placeholder for association/account settings. Role: shown to all roles.

**Data flow.** Client component with no data fetching and no interactive controls — it explicitly renders "Settings management is not yet implemented."

**Key interactions.** None.

---

### Shared Components

#### Providers.tsx — src/components/Providers.tsx
**Purpose.** App-wide client-side context wrapper, mounted once in the root `layout.tsx`.
**Props.** `{ children: ReactNode, session?: Session | null }`.
**Behavior/reuse.** Wraps `children` in NextAuth's `<SessionProvider session={session}>`, seeded with the server-fetched session so `useSession()` works immediately in every client component without a client-side session fetch flash. Root-level singleton, not reused elsewhere.

#### layout/DashboardSidebar.tsx — src/components/layout/DashboardSidebar.tsx
**Purpose.** Fixed left navigation rail for the entire authenticated app shell; the sole nav surface for the `(dashboard)` route group.
**Props.** None (no props — reads everything from hooks).
**Data flow / behavior.** Client component. Uses `usePathname()` for active-link highlighting, `useSession()` to get the current user's `role`, and derives the visible nav sections via `navSectionsForRole(session?.user?.role ?? '')` (`@/lib/chrome`) — this is the single source of truth for which links a role sees (see `NAV_SECTIONS` breakdown above under `/dashboard-page` discussion). Icons are mapped by href via a local `ICONS` record (falls back to `User` icon if unmapped). `chromeIdentity()` derives the displayed email/role label and 2-letter initials avatar. "Sign out" button calls NextAuth's `signOut({ callbackUrl: '/api/auth/signin' })`.
**Reuse.** Domain-specific, singleton — instantiated once by `(dashboard)/layout.tsx`, not reused elsewhere.

#### marketing/HeroLanding.tsx — src/components/marketing/HeroLanding.tsx
**Purpose.** Public landing-page hero/marketing content shown to signed-out visitors at `/`.
**Props.** None — self-contained, statically renders a hardcoded `FEATURES` array (Association Ingest, Identity Resolution, Blind Selection, In-Season Tracking) as 4 feature cards.
**Behavior/reuse.** No client state, no `'use client'` directive needed (it's static markup) — actually note it contains no hooks so it can be a server component even though it's under `components/marketing`. Its only interactivity is two anchor links to `/api/auth/signin?callbackUrl=/dashboard`. Domain-specific to the root page; not reused elsewhere.

#### shared/AnimatedCounter.tsx — src/components/shared/AnimatedCounter.tsx
**Purpose.** Small reusable number-counting animation (counts up from 0 to a target value).
**Props.** `{ to: number, duration?: number }` (duration defaults to 1 second).
**Behavior.** Client component using framer-motion's `animate()` imperative API (not the declarative `motion.div`) to drive a `useState` value from a `fromRef` (initially 0, then updated to the latest `to` after each run) up to `to`, formatting the live value with `.toLocaleString('en-IN')` (Indian digit grouping, consistent with the app's India-specific domain — DOB/date formatting elsewhere also uses `en-IN`).
**Reuse.** Generic shared UI primitive — currently used by the `/dashboard` page's `KpiCard` for the four headline KPI numbers; reusable anywhere a number needs to animate in.

#### ui/button.tsx — src/components/ui/button.tsx
**Purpose.** Base button primitive, styled via Tailwind, following the shadcn/ui-style `forwardRef` + `cn()` variant pattern.
**Props.** `ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>` plus `variant?: 'default' | 'outline' | 'ghost'` and `size?: 'default' | 'sm' | 'lg' | 'icon'`.
**Behavior/reuse.** Pure presentational primitive with no logic beyond class composition (`variantClasses`/`sizeClasses` lookup tables merged via `cn()`). Used by `/claim` and `/player/onboarding` (both pre-auth flows) for all their primary actions; the dashboard pages mostly use raw `<button>` with inline Tailwind instead of this primitive, so its reuse is currently concentrated in the pre-auth flows.

#### ui/input.tsx — src/components/ui/input.tsx
**Purpose.** Base text input primitive, same pattern as `Button`.
**Props.** `React.InputHTMLAttributes<HTMLInputElement>` (all native props pass through), defaults `type` to `'text'`.
**Behavior/reuse.** `forwardRef`, styled via `cn()`. Used throughout `/claim` and `/player/onboarding` for every text/date/tel/email/password/number field.

#### ui/label.tsx — src/components/ui/label.tsx
**Purpose.** Base `<label>` primitive.
**Props.** `React.LabelHTMLAttributes<HTMLLabelElement>`.
**Behavior/reuse.** `forwardRef`, minimal styling (`'block font-medium'` + passthrough `className`). Paired with `Input` throughout `/claim` and `/player/onboarding`.

---

### Type Definitions

#### src/types/index.ts
Central domain model for the whole app (~350 lines). Key groups:

- **Roles & enums.** `UserRole = 'player' | 'selection_panel' | 'coach' | 'association' | 'athlasx_ops'` — note this does **not** include `academy_admin`, even though that role string is actively used and enforced (`requireRole(req, ["academy_admin"])`) across `src/app/api/academy/**` route handlers; the type appears to be lagging the API surface. Cricket domain enums: `BattingStyle`, `BowlingStyle` (8 variants + `'None'`), `PlayingRole` (`Batsman`/`Bowler`/`All-rounder`/`Wicket-keeper Batsman`), `Format` (`T20`/`ODI`/`Test`/`T10`), `TournamentLevel` (`local`/`district`/`state`/`national`), `AssociationType` (`state`/`district`). Workflow enums: `IngestMethod`, `ApprovalStatus`, `ClaimStatus`, `ConsentStatus`, `GradeStatus`, `SelectionStatus`, `FlagType`.
- **Identity.** `User` (account row, `linked_player_id` xor `linked_staff_id` depending on role), `Association` (state/district hierarchy via `parent_id`, `cricheroes_association_id`, `data_sharing_signed`), `PlayerProfile` (the central player entity — note it can exist with `user_id` unset, i.e. a "shadow profile"; carries `claim_status`, `consent_status`, `guardian_phone`, playing attributes, `athlasx_score`, and `profile_source: 'ingest' | 'self_registered'` distinguishing claim-flow vs onboarding-flow origin).
- **Academy registry.** `Academy` (`name_variants[]` for fuzzy matching, `verified`, `players_at_district_plus` — the production metric shown on `/academy-matching`'s Production tab).
- **Provenance chain.** `Tournament` → `Match` → `Performance`, each carrying `source`, `ingest_method`, and (`Match`/`Performance`) `confidence`/`confidence_score` plus `association_approval_status` — this is the "provenance travels with the record" pattern referenced in the `/ingest` page's UI copy. `Performance` batting/bowling/fielding fields are all optional (a row may only have one discipline populated), with fielding explicitly noted as "successes only." `BattingStats`/`BowlingStats` are pre-aggregated per-format career stat rows.
- **Trial cycle domain.** `TrialCycle`/`TrialVenue` (mirrors the `/trial-cycles` UI's `Cycle`/`Venue` local interfaces almost exactly), `Registration` (fee/document/footage/check-in booleans — mirrors `/trial-cycles/[id]/register`), `Dossier`/`DossierContents` (`generated_at` marked immutable once issued; batting/bowling 0–10 fields, `cohort_size`, `data_sources[]` — mirrors the dossiers page's `DossierData`).
- **Selection domain.** `SelectionSession` (`chair_id`, `squad_size_target`, `convergence_unlocked_at`, `squad_locked_at`), `Grade` (comment notes it's "Blind until convergence"), `ConvergenceView` (`grades[]`, `average`, `distribution`, `consensus`), `Selection`/`OmissionRationale` (both require a `rationale` string and are `decided_at`-immutable once written — omission rationale is noted as an optional, association-controlled toggle, off by default).
- **In-season tracking.** `PlayerWeek` (weekly rollup: `rolling_4week_average`, `score_delta`, `flag_type`, `coach_note` capped at 200 chars per the comment), `TrendAlert` (`consecutive_declining_weeks`, `skill_dimension`, `notified_coach`/`notified_selector` booleans).
- **Staff profiles.** `CoachProfile` (`squad_ids[]`), `SelectorProfile`.
- **Opportunity.** Legacy/retained type for player-facing trial notifications (`roles_needed`, `deadline`, `is_active`) — kept per an explicit comment ("kept for player-facing trial notifications") though no page in this doc set directly renders it.

#### types/next-auth.d.ts
Module augmentation for `next-auth` and `next-auth/jwt`, declared via `declare module`. Extends the built-in `Session.user` with `id: string` and `role: string` (merged with `DefaultSession["user"]`), and extends the JWT payload (`next-auth/jwt`'s `JWT` interface) with optional `id?: string` and `role?: string`. This is what makes `session.user.role` and `session.user.id` type-safe everywhere in the app (e.g. `DashboardSidebar`'s `navSectionsForRole(session?.user?.role ?? '')`, `chromeIdentity()`), rather than falling back to `any`.
## 8. Key End-to-End Procedures

The reference sections above document each file in isolation. This section walks the five workflows that actually matter to the product from end to end, showing how the pieces documented separately above chain together. File names below point back to their full documentation in the sections above.

### 8.1 Player claim flow (W2)

1. **Discovery** — `POST /api/claim/search` (public, no auth). Player searches by name+district+optional DOB against `PlayerProfile` rows with `claim_status: 'unclaimed'`.
2. **Start** — `POST /api/claim/start`. Rate-limited to 5 sends/hour per phone (`src/lib/rate-limit.ts`). If the player is a minor (`isMinor`, age < 18), guardian name/phone/relation are required and the OTP targets the guardian's phone instead — the DPDP Act consent gate. A `PhoneOtp` row is created with a bcrypt hash of a CSPRNG-generated 6-digit code (`src/lib/otp.ts`); the raw code is never returned in the API response, only logged server-side outside production.
3. **Verify** — `POST /api/claim/verify`. Inside one `$transaction`: an `updateMany` scoped by `{ id, consumed_at: null }` closes a TOCTOU race so only the first concurrent verify attempt can succeed; on success it creates a `User`, marks the `PlayerClaim` verified with `consent_status: 'granted'`, and marks the `PlayerProfile` claimed — then signs the player in directly via `encodeSessionToken`/`applySessionCookie` (`src/lib/auth.ts`).
4. **Withdrawal** (any time after) — `POST /api/claim/withdraw`. Self-service only — the caller's own `linked_player_id` must match the claim being withdrawn. Flips `consent_status` to `withdrawn` on both `PlayerClaim` and `PlayerProfile`; every downstream read path (`candidate-pool`, `tracking`, `coach/squad`, `dashboard`, `my-record`, `claim/search`) is expected to filter on `consent_status !== 'withdrawn'` — proven by `tests/integration/consent-withdrawal.test.ts` across all six paths in one sweep.

Every step logs a structured, phone-masked event via `src/lib/otp-log.ts` (`generated`, `sent`, `verify_attempt`, `verify_success`, `verify_failed`, `consumed`, `expired`) — the raw code is never in a log line.

### 8.2 Ingest → identity resolution → academy capture (W1 / W2 / W8)

1. **Submit** — `POST /api/ingest`. Association staff pick a source (`api_sync`, `structured_parser`, `ocr`, `excel_mapper`) resolved via `src/lib/ingest/registry.ts`. The chosen adapter's `.normalize()` (one of the four files under `src/lib/ingest/sources/`) converts the raw payload to a `NormalizedIngestPayload` and computes a source-specific confidence score (`src/lib/ingest/confidence.ts`'s completeness math, weighted differently per source — CSV/structured formats trust schema validation, OCR trusts the OCR engine's own confidence, API sync assumes high structural trust). Nothing is written to `Match`/`Performance` yet — only an `IngestJob` row with `status: 'pending_review'`.
2. **Decide** — `POST /api/ingest/[id]/decide`. Rejection just flips status. Approval runs one `$transaction` (deliberately given a 20s timeout, up from Prisma's 5s default, because this step makes several sequential round trips):
   - Find-or-create the `Tournament`, create the `Match`.
   - For **each** performance row, call `resolveIdentity()` (`src/lib/identity-resolution.ts`): fuzzy-match the name (`src/lib/identity-normalize.ts`'s token-sorted Levenshtein similarity, threshold 0.85) against the association's existing players, then require independent DOB **and** district corroboration before accepting a single match. Three outcomes: `HIGH_CONFIDENCE` (creates the `Performance` row against the matched player), `AMBIGUOUS` (creates or updates an `IdentityException` with a JSON snapshot of the skipped row — no `Performance` row is created), `NO_MATCH` (creates a brand-new unclaimed shadow `PlayerProfile`).
   - Deduplicate every raw academy-name string across the batch and enqueue each into the academy reconciliation queue (`enqueueAcademyCapture`, `src/lib/academy-capture.ts`), reusing the exact same similarity function (`src/lib/string-similarity.ts`) that the human-facing confirm/reject UI (`academy-matching/*` routes) uses — so the queue and the UI can never disagree about what counts as a match.
3. **Resolve an exception** — a human reviewer calls one of `POST /api/identity-exceptions/[id]/{confirm,merge,split}`. All three ultimately call `attachSkippedPerformance()` (`src/lib/identity-exception-attach.ts`), which writes the `Performance` row that step 2 skipped, using the exception's stored snapshot — `confirm`/`merge` attach to an existing candidate, `split` first creates a new shadow profile.
4. **Confirm an academy match** — `POST /api/academy-matching/[id]/confirm`. Always requires an explicit human choice, even for a high-confidence (≥0.9) suggestion — the codebase's comments are explicit that a score above the auto-attach threshold is fast-tracked to "suggested," never auto-merged.

### 8.3 Blind grading and selection (W4)

1. A `SelectionSession` exists in `open`/`grading` status for a trial cycle (created via the seed script or an unshown creation path — no route in this reference creates one directly, implying it's seeded/admin-provisioned in this version).
2. Selectors submit grades — `POST /api/grading/[sessionId]/grade` — 1–10, upserted on the unique `(session, selector, player)` constraint. `selector_id` is always the caller's own session-derived id, never accepted from the request body (a previously-fixed identity-spoofing bug).
3. Each selector can only ever read their own grades (`GET /api/grading/[sessionId]/mine`, hard-scoped to `selector_id = caller`) — this is the actual mechanism of "blind": there is no code path that lets a selector's own grades reach another selector before convergence.
4. The chair calls `POST /api/grading/[sessionId]/unlock`. Only after this does `GET /api/grading/[sessionId]/convergence` return anything — before unlock, it 403s explicitly, which is the server-side half of the blind guarantee (client UI state alone was a previously-fixed vulnerability here too).
5. Convergence aggregates every grade per player into an average, distribution, and a consensus label (`unanimous`/`split`/`contested`, by spread).
6. The chair calls `POST /api/grading/[sessionId]/lock-squad` with the final player list. This is a one-way operation — it creates immutable `Selection` rows and flips the session to `locked`; grading and convergence cannot reopen.

### 8.4 Dossier generation (W3)

Triggered lazily the first time anyone requests `GET /api/trial-cycles/[id]/registrations/[registrationId]/dossier`. `getOrGenerateDossier()` (`src/lib/dossier.ts`) checks for an existing `Dossier` row first (dossiers are immutable once generated — there is no regenerate action). If none exists: pulls the player's verified performance history, runs the same `calculateAthlasXScore()` the rest of the app uses (`src/lib/athlasx-score.ts`), and computes a cohort percentile against every other registrant in the same trial cycle — but only if at least 5 cohort members have scoreable history, otherwise returns `percentile: null` rather than a misleadingly precise number from a thin sample. A player with zero verified history gets an honest `has_match_history: false` dossier, never a fabricated score.

### 8.5 Academy join-request → batch assignment

Ported from `origin/v1-features-sparsh` onto this codebase's Prisma models and `requireRole` auth convention.

1. A candidate's join request lands as a pending `AcademyJoinRequest` (creation route not present in the current API surface — likely a public form intended for a future route, or created via the academy's own admin tooling not yet built out on this branch).
2. `academy_admin` calls `POST /api/academy/join-requests/[id]/approve` with a target `batch_id`. Inside `approveJoinRequest()` (`src/lib/academy/join-requests.ts`): reuses the request's linked player if one exists, otherwise creates a brand-new `PlayerProfile` (`profile_source: 'academy_join_request'`), then upserts an active `AcademyBatchMembership` for that player in the chosen batch. A request can only be approved once — a second attempt 404s.
3. Attendance follow-ups are a separate, decoupled concern: `GET /api/academy/attendance-flags/[playerId]` expects the caller to already know the player's consecutive-absence count (the route does not compute it — see Known Gaps, this is a scope limitation carried over from the port) and returns a classified status (`clear`/`open`/`snoozed`/`dismissed`) via `loadAttendanceFollowUpForPlayer()` (`src/lib/academy/attendance-flags.ts`), which self-heals stale snooze/dismiss state on read.

---
## 9. Testing Strategy & Test Suite

Test suite: 24 files under `tests/` (22 `.test.ts`/`.spec.ts` files with cases, plus 3 helper modules with no test cases of their own). Counted via `it(`/`test(` occurrences per file.

### Unit tests (`tests/unit/`)

| File | Cases | Covers |
|---|---|---|
| `athlasx-score.test.ts` | 29 (10 `describe` blocks) | The AthlasX score engine (`src/lib/athlasx-score.ts`) — called out in its header comment as "the only substantive business logic in the codebase." Pins down: TQI (tournament quality index) multipliers (state 1.0/district 0.75/local 0.5, national treated as state); batting average computed over dismissals not innings, with no divide-by-zero for a never-dismissed batter; TQI applied once so it doesn't double-count into strike rate; bowling economy scoring with no `Infinity`/NaN edge cases; that coach ratings (`coachFitnessRating`/`coachBehaviourRating`) are **provably inert** — supplying them changes nothing, including component-level breakdowns (this is the fix for "DEFECT 1", cross-referenced in `known-defects/`); role-based blending (Batsman scores off batting only, Bowler off bowling only, All-rounder blends both, Wicket-keeper Batsman scores off batting only — keeping is deliberately never scored); that fielding/keeping never appear in the score breakdown at all; bounds (0–100 total, 0–10 per-dimension) hold even for absurd/empty input; `getScoreTier`/`getProvenanceLabel` helper behavior. Every expected numeric value is stated to be derived from documented benchmarks (district par batting avg 35/SR 140, bowling economy 6.5/avg 28), not copied from a code run. |
| `otp.test.ts` | 16 (5 `describe`) | OTP primitives (`src/lib/otp.ts`) guarding the W2 claim/guardian-consent flow. Header comment flags these as "legal exposure, not just bugs." Covers: 6-digit generation with no weak/constant cycling; `hashOtp`/`verifyOtpCode` are bcrypt-based (replacing an earlier unsalted SHA-256 scheme) — async, salted (two hashes of the same code differ), never store plaintext; correct/incorrect code verification; phone masking (last-4-digits, and full masking for ≤4-digit numbers); expiry within ≤15 minutes; attempt-limiting caps at a small number. |
| `string-similarity.test.ts` | 13 (2 `describe`) | Academy name fuzzy-matching (`src/lib/string-similarity.ts`) for W8 reconciliation. Covers: identical/case-insensitive/punctuation-insensitive scoring, symmetry, [0,1] bounds, empty-string and empty-variant-list handling, abbreviation and branch-suffix variants scoring above unrelated names, unrelated names scoring below the 0.55 suggestion threshold, and picking the best-scoring known name variant. The doc's stated design bias — prefer false negatives (unmatched stub) over false positives (bad merge, harder to unwind) — is directly tested here and is also the subject of a known-defect test (see below). |
| `chrome.test.ts` | 9 (3 `describe`) | Dashboard "chrome" policy (`src/lib/chrome.ts`) — nav-item visibility and identity display per role. Guards a previous defect where the shell showed every nav section to everyone and a hardcoded "Hritvik Garg / AthlasX Ops" identity regardless of who was signed in. Covers per-role nav filtering (player/selector/association staff/coach/`athlasx_ops` sees-everything), anonymous visits routing to NextAuth's built-in sign-in, and that the profile chrome shows the real session email/role. |
| `ingest-cricheroes-fixture.test.ts` | 1 | A documented CricHeroes JSON fixture posted through the real `api_sync` adapter, normalizing into a pending-review-ready payload — no third-party network call. |
| `ingest-csv.test.ts` | 1 | Maps a documented CSV format into the `excel_mapper` adapter's `NormalizedIngestPayload` shape — no spreadsheet library involved, just documented headers in/out. |

### Integration tests (`tests/integration/`)

All run against a real Postgres schema (`athlasx_test`, provisioned by `scripts/setup-test-db.mjs`) via `vi.mock('@/lib/db', ...)` redirecting the app's db import to `tests/helpers/test-db.ts`'s client, and call Next.js route handlers directly (not over HTTP).

| File | Cases | Covers |
|---|---|---|
| `auth-session.test.ts` | 3 (2 `describe`) | Real `CredentialsProvider` sign-in issuing a genuine NextAuth session cookie for a seeded staff user; rejects wrong password. |
| `claim-flow.test.ts` | 24 (4 `describe`) | The full W2 claim pipeline end to end: searching an unclaimed profile by name+district (case-insensitive, never returns an already-claimed profile or a guardian phone in search results); starting a claim as an adult vs. as a minor (DPDP guardian gate — refuses without guardian details, targets the guardian's phone, leaves the profile unclaimed pending guardian verification); OTP verification (correct code grants consent and claims the profile; wrong code counts an attempt and locks out at the limit; expired/replayed/wrong-claim codes are all rejected); and that a successful claim creates exactly one `User` linked to the profile, issues a working session cookie, and that a replayed consumed OTP does not create a second `User`. |
| `consent-withdrawal.test.ts` | 1 (large combined test) | Proves consent withdrawal is honoured across all 6 named read paths (candidate-pool, tracking, coach/squad, dashboard, my-record, claim/search) in one assertion sweep — visible before withdrawal, excluded from all 6 after. Explicitly built with real signed session JWTs (not stubs) so the assertion exercises the consent filter rather than an auth 401. |
| `fake-performance-sweep.test.ts` | 7 (4 `describe`) | "T-FAKEDATA sweep" — proves 4 routes (`my-record`, `dashboard`, `candidate-pool`, `coach/squad`) that used to synthesize fake score/match data via a deterministic `seedPerformances()` generator now source only real, association-**approved** `Performance` rows, and show an honest zero/empty state (never fabricated numbers) for a player with no real history. |
| `grading-blind.test.ts` | 31 (7 `describe`) — the largest integration suite | The W4 blind-grading boundary, called "the single most valuable design choice" in the product spec. Covers: submitting/validating grades (1–10 range, idempotent upsert per session/selector/player, rejecting anonymous callers); the blind boundary itself — no selector can see another's grade before the chair unlocks convergence, `/mine` returns only the caller's own grade and never leaks a peer's; unlocking convergence (chair-only, one-way, closes further grading); role-based auth on every grading write path (`T-GRADE-AUTH`: players, coaches, and association staff are all blocked from posting grades or unlocking/locking); and — a second, security-hardening pass — that caller-supplied identity in the request body (e.g. naming oneself "the chair") cannot override the identity derived from the real signed session. |
| `grading-quickview.test.ts` | 3 | The `/api/grading/session` Quick View (a T3a fix) now builds from real, association-approved `Performance` rows joined to `Match`→`Tournament` level, excluding pending ones, rather than the old fake mock generator. |
| `identity-exception-attach.test.ts` | 5 (3 `describe`) | Confirm/split/merge on an `IdentityException` must actually **write** the `Performance` row that ingest-approve skipped (not just flip a status flag): confirming attaches it to a chosen candidate; splitting creates a brand-new shadow profile from the raw identity and writes the performance there; merging writes onto an explicit surviving candidate while leaving both players' other history alone. Also covers auth (unauthenticated caller rejected) and cross-association scoping (staff of another association rejected). |
| `ingest-approval.test.ts` | 2 | Approving a real `IngestJob` creates `Tournament`/`Match`/`Performance` rows and, in the same transaction, triggers both W2 identity resolution (real `player_id` or a real `IdentityException`) and W8 academy capture (`AcademyMatchCandidate`) — not merely flipping a status flag on an otherwise-empty bookkeeping row. Also proves an ambiguous row is routed to `IdentityException` rather than guessed. |
| `ingest-submit.test.ts` | 7 | Association staff submitting through `POST /api/ingest` creates a `pending_review` job visible to staff GET; rejects anonymous/player callers and associations the caller isn't scoped to; rejects unknown `sourceKey`s; covers both CSV→`excel_mapper` and CricHeroes-fixture→`api_sync` submission paths. |
| `onboard.test.ts` | 5 | Self-registered player onboarding: one POST creates both a `User` and a `self_registered` `PlayerProfile`, issues a session cookie, and `my-record` returns that profile immediately; explicitly **rejects self-reported match statistics** at onboarding; refuses an under-18 signup without a guardian phone; rejects duplicate-email signups. |
| `role-gates.test.ts` | 9 (2 `describe`) | Proves that "logged in" is not the same as "authorized" — real player JWTs are 403'd off staff-only routes (`dashboard`, `ingest`, grading), and squad-write routes require a real `AssociationStaff`/`SquadCoach` membership row, not just a role string on the token (a coach with membership on a *different* squad cannot assign coaches to this one). |
| `squad-access.test.ts` | 6 (5 `describe`) | The W7 Squad model end to end: staff creates a squad with an initial roster and assigns a coach; a random unrelated user is refused squad-detail access; the default (no `squadId` param) coach view resolves to *that* coach's own squad, never another's; advisory notes are structurally squad-scoped and never touch `Grade`/`Selection`; training sessions + attendance round-trip; squad listing is scoped to what the caller can see. |
| `visibility-tier.test.ts` | 8 (6 `describe`) | Cross-association data-scoping fixes: several routes (`candidate-pool`, `coach/squad`, `grading/session`, `grading/convergence`, `tracking`, `trial-cycles/[id]/registrations`) previously either grabbed the most-recently-created session in the **entire database** or trusted a caller-supplied ID with no ownership check. Two associations (A, B) and a staff user scoped only to A are used throughout; every assertion proves a negative (A cannot see B's data) paired with a positive control (A can see A's own data) so the test isn't vacuously passing. Also confirms `visibility_tier` actually gates cross-association player exposure in tracking. |
| `integration/academy/batches-and-join-requests.test.ts` | 10 (3 `describe`) | The ported academy-batch subsystem: an `academy_admin` creates a batch (rejecting mismatched per-day schedule times), adds/removes a player from the roster; join requests can be approved into a batch (creating a real `PlayerProfile` + `AcademyBatchMembership` — verified against the DB, not just the response) or rejected, and double-approval 404s; attendance-flag dismiss/snooze/unsnooze round-trips and rejects invalid snooze durations; non-`academy_admin` callers and admins with no academy yet are handled with clean 403/400s rather than crashes. |
| `integration/academy/helpers.test.ts` | 17 (2 `describe`) | Pure-function coverage (no DB) for academy batch-schedule and attendance-flag helper logic, ported verbatim from `origin/v1-features-sparsh`'s pre-existing vitest-style tests with imports repointed at `src/lib/academy/*`. Covers schedule parsing/validation (uniform per-day times required, invalid weekday/end-before-start rejected), schedule encode/decode round-trip and compact label formatting, batch-status db↔API mapping, age-group validation, and the attendance-flag state classification (clear/open/snoozed/dismissed) plus snooze-duration bounds and until-date computation. |

### Security tests (`tests/security/auth-and-consent.test.ts`)

12 cases across 4 `describe` blocks (S1–S4), explicitly labeled in the file header as "an executable specification of the security findings from the implementation audit" and originally written to be **expected to fail** against the code as first audited, turning green as each finding is remediated. Run in isolation via `npm run test:security`.

- **S1** — no route should serve data to an anonymous caller: `candidate-pool`, `tracking`, `dashboard` must all 401 with no session.
- **S2** — caller-supplied identity must not be trusted: a grade submitted "as" the chair, or convergence unlocked by naming the chair in the POST body, must be rejected — this is what made the blind-grading guarantee bypassable (the enforcement was real, but the identity it enforced against wasn't).
- **S3** — `claim/start` must never return the OTP (`devOtp`) in its own response body, for either an adult or a minor's guardian flow — combined with S1 this was a complete profile-takeover primitive.
- **S4** — consent withdrawal must actually stop a player being surfaced on `candidate-pool` and `tracking` (not just flip a database flag), whether withdrawn via a direct DB update or through the real `claim/withdraw` route; withdrawal is self-service only (a caller can't withdraw someone else's claim by guessing a `claimId` — 403) and requires auth (401 anonymous).

Notably, the test bodies as currently written (real signed JWTs via `tests/helpers/auth.ts`, explicit comments like "now auth-gated", "previously had NO auth check at all") indicate these findings have since been **remediated** — the file's own header claim that these tests are "expected to fail" appears to be stale documentation left over from when the suite was authored against the unpatched code, not the current state of the app. `.github/workflows/ci.yml`'s `test:ci` script runs this suite (and `known-defects`) as part of the required CI job, which would only pass if S1–S4 are in fact fixed.

### Known-defects tests (`tests/known-defects/engine-and-matching.test.ts`)

5 cases across 3 `describe` blocks, run in isolation via `npx vitest run tests/known-defects`. Header instructs: "Do not 'fix' these by weakening the assertion" — this file is meant to encode open findings and turn green only when the underlying defect is actually closed.

- **DEFECT 1** (marked FIXED in-file) — the product spec originally claimed coach ratings would be accepted "only when source = coach/supervisor" with self-reported values rejected at the engine level. The actual remediation went further: coach ratings were structurally removed from the score engine entirely (`AthlasXScoreInput.coachFitnessRating`/`coachBehaviourRating` are now inert no-ops), and the real advisory signal lives in `CoachAdvisoryNote`, which has zero relationship to scoring. The test proves the score is byte-identical whether or not ratings are supplied.
- **DEFECT 2** (open) — `src/lib/athlasx-score.ts`'s own code comment claims "6.5 eco → 10, 10.5 eco → 0" but the implemented formula `((10 - economy) / 4) * 10` yields 8.75 at 6.5 economy — a third source (a separate completion document) states yet another formula. The test asserts the comment's claimed value and is expected to fail until the formula/comment/doc are reconciled.
- **DEFECT 3** (open, "mitigated today") — normalized-Levenshtein string similarity (`src/lib/string-similarity.ts`) has no notion of which token in an academy name carries identity ("Sharma") vs. boilerplate ("Cricket Academy"), so a true abbreviation and a genuinely different academy can score similarly. Currently mitigated only because `prisma/seed.ts` merely *suggests* matches ≥0.55 for human confirmation; the test notes this becomes a live data-integrity bug the moment an auto-confirm threshold is introduced, which the product spec's W8 notes explicitly contemplate.

### E2E tests (`tests/e2e/workflows.spec.ts`, Playwright)

9 `test()` cases across 5 `test.describe()` blocks. Header: runs against a real production build reading the real `athlasx` schema; explicitly **read-only** (no test submits a form that writes). Covers:
- Every one of the "nine pivot workflow" pages (`/dashboard`, `/ingest`, `/trial-cycles`, `/selection`, `/grading`, `/convergence`, `/tracking`, `/coach`, `/record`) returns 200, renders its expected `<h1>` heading, and throws no client-side JS errors.
- The sidebar nav's links all resolve to non-broken (<400) responses.
- The W4 Player Quick View: opens on selecting a grading-page row; shows batting/bowling but **never** a numeric fielding or keeping rating (those dimensions are deliberately unscored); states that exclusion policy on-screen ("not rated"); shows match provenance ("verified matches") so a number is checkable; tells the selector their own grade stays hidden until convergence.
- The `/claim` page loads for an unauthenticated visitor.
- A `describe` block literally named `'SECURITY (expected to fail): the app requires no login'` asserting `/dashboard` and `GET /api/candidate-pool` should 401 anonymously — mirroring the S1 finding also covered in the Vitest security suite, but at the E2E/build level.

### Test helpers (`tests/helpers/`)

- **`test-db.ts`** — the integration-test database harness. Exports `testDb` (a `PrismaClient` generated from a derived `schema.test.prisma`, pinned to the `athlasx_test` Postgres schema — the live `athlasx` schema is never opened by a test). `withRetry()` retries a DB call up to 4 times with backoff (Neon serverless Postgres autosuspends when idle, so the first connection after a pause can time out once). `assertIsTestSchema()` is a hard guard that throws if `athlasx_test` doesn't exist or is empty, refusing to run against the live schema. `resetDb()` truncates every known table (with `RESTART IDENTITY CASCADE`) between suites — **note the gap on the newer academy-batch tables** flagged above. `seedFixtures()` builds "a minimal but realistic slice of the domain": one association, one adult player, one under-18 shadow player (`consent_status: pending`, the DPDP-sensitive case), a chair and a second selector (both also wired up as real `AssociationStaff` members so association-scoped routes see them as legitimate staff, not just a role string), an association-staff user, a trial cycle, and a `grading`-status selection session.
- **`auth.ts`** — `sessionCookieFor()`, `getAsUser()`, `postAsUser()`: builds a `NextRequest` carrying a *real* NextAuth JWT session cookie (via `next-auth/jwt#encode` with the same `NEXTAUTH_SECRET` the app's `require-auth.ts` verifies against), so integration tests exercise genuine session verification rather than a stub — a request built without this helper still 401s exactly as it would in production.
- **`load-env.ts`** — a Vitest `setupFiles` entry that manually loads `.env.local` the way Next.js does (Prisma's own CLI reads `.env`, not `.env.local`, and this repo only has the latter), so `DATABASE_URL` etc. are present before any test file runs.

## 10. Tooling & Configuration

### `package.json`

- **Framework**: `next` 14.2.35 (App Router), `react`/`react-dom` 18.3.1, TypeScript 5.5.3.
- **ORM / DB**: `@prisma/client` + `prisma` 6.19.3, `@neondatabase/serverless` (Neon serverless Postgres driver).
- **Auth**: `next-auth` 4.24.7, `bcryptjs` (password/OTP hashing), `jose` (JWT), `uuid` pinned via an `overrides` entry (`"uuid": "^11.1.1"`).
- **Rate limiting**: `@upstash/ratelimit` + `@upstash/redis`.
- **Forms/validation**: `react-hook-form`, `@hookform/resolvers`, `zod` 4.x.
- **UI**: `radix-ui`, `lucide-react` (icons), `framer-motion` + `gsap`/`@gsap/react` (animation), `three`/`@types/three` (3D), `lottie-react`, `recharts` (charts), `sonner` (toasts), `class-variance-authority`, `clsx`, `tailwind-merge`.
- **Other**: `file-type` (magic-byte upload validation — matches the CSP comment about never trusting client-declared file types), `undici` (HTTP client).
- **Testing**: `vitest` 4.1.10 + `@vitest/coverage-v8`, `@playwright/test` 1.62.1, `tsx` (TS script runner used by the seed script), `dotenv`.
- **Lint**: `eslint` 8.57.0 + `eslint-config-next`.

**Scripts**:
| Script | Purpose |
|---|---|
| `dev` / `build` / `start` / `lint` | Standard Next.js lifecycle. |
| `audit:js` | `npm audit`. |
| `test` | `vitest run` (all test files). |
| `test:watch` | `vitest` in watch mode. |
| `test:unit` | `vitest run tests/unit`. |
| `test:integration` | `vitest run tests/integration`. |
| `test:security` | `vitest run tests/security` — the S1–S4 suite. |
| `test:ci` | `vitest run tests/unit tests/integration tests/security tests/known-defects` — the exact set CI runs (excludes e2e). |
| `test:coverage` | `vitest run --coverage`. |
| `postinstall` | `prisma generate` — runs automatically after every `npm install`. |
| `test:e2e` | `playwright test`. |
| `test:setup-db` | `node scripts/setup-test-db.mjs` — provisions the `athlasx_test` schema. |
| `test:teardown-db` | `node scripts/setup-test-db.mjs --drop` — drops it. |

### `next.config.mjs`

Defines a hand-verified (not boilerplate) Content-Security-Policy plus a standard security-header set (`Strict-Transport-Security` with preload, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` disabling camera/mic/geolocation). Worth flagging:
- `script-src`/`style-src` both need `'unsafe-inline'` — justified in a long inline comment: React Server Components' streaming injects nonce-less inline `<script>` tags (`self.__next_f.push(...)`), and `style={{...}}` props / a `<style dangerouslySetInnerHTML>` in `app/page.tsx` need `'unsafe-inline'` for styles. A real fix would need per-request nonces wired through `middleware.ts`, called out as separate future work.
- `'unsafe-eval'` is appended to `script-src` **only when `NODE_ENV !== 'production'`** — required by Next.js Fast Refresh's HMR runtime, which calls `eval()`; without it every page's client bundle throws before hydration in dev. The comment stresses this must never ship in production.
- `img-src` allows `data:`, `blob:`, and specifically `img.youtube.com`/`i.ytimg.com` (also declared in `images.remotePatterns`) — the only external image sources in the app; `blob:` covers local file-preview UI via `URL.createObjectURL`.
- `connect-src 'self'` only — every client fetch targets a same-origin `/api/...` path; the one external call (Razorpay) is server-side in `app/api/admin/launch-checklist/route.ts` and not subject to browser CSP.
- `frame-src 'none'`, `object-src 'none'`, `frame-ancestors 'none'` — no iframes/embeds anywhere in the app.
- Two `headers()` rewrite rules set `Content-Disposition: inline` only on `/uploads/:userId/avatar/*` and `/uploads/:userId/academy-assets/*` — image-only upload subfolders whose files are magic-byte validated (never SVG/HTML) so inline display can't execute a script; other upload subfolders (coach-certs, fitness, guardian, matches) intentionally get no such override since they can contain PDFs.

### `tailwind.config.ts`

Minimal — content globs only `./src/**/*.{js,ts,jsx,tsx,mdx}`, no theme extension, no plugins.

### `vitest.config.mts`

- `environment: 'node'`, `globals: true`.
- **`fileParallelism: false` and `maxWorkers: 1`** — deliberate: integration tests share one Postgres schema (`athlasx_test`) and would race each other if run concurrently.
- `setupFiles: ['tests/helpers/load-env.ts']` (loads `.env.local`).
- `include: ['tests/**/*.test.ts']` — this pattern excludes `tests/e2e/workflows.spec.ts` (a `.spec.ts`, and Playwright-only) from the Vitest run.
- `testTimeout: 30_000`, `hookTimeout: 120_000` (generous, likely for Neon cold-start).
- Coverage via `@vitest/coverage-v8`, scoped to `src/lib/**/*.ts` and `src/app/api/**/*.ts`, explicitly excluding `src/lib/db.ts`.
- Path alias `@` → `src/`.

### `playwright.config.ts`

Runs against a real production build on `http://127.0.0.1:3210` (`npx next start -p 3210`), started as Playwright's own `webServer` (reused in local dev via `reuseExistingServer: !process.env.CI`). `fullyParallel: false`, `workers: 1`, `retries: 1` — comment notes Neon's autosuspend can make the first request of a run slow. Single `chromium` project. `trace: 'retain-on-failure'`. Header comment reiterates the app has no login/auth to drive through in E2E, so tests are read-only by design.

### `tsconfig.json`

Standard Next.js TS config: `target: ES2022`, `strict: true`, `moduleResolution: "bundler"`, `noEmit: true`, `jsx: "preserve"`, Next's own `plugins: [{ name: "next" }]`, path alias `@/*` → `./src/*` (matching Vitest's alias). Includes `.next/types/**/*.ts` and `types/**/*.d.ts`.

### `vercel.json`

Single setting: `{"regions": ["bom1"]}` — pins deployment to Vercel's Mumbai region, consistent with the app's Indian-cricket-association domain.

### `.github/workflows/ci.yml`

Four parallel jobs on push/PR to `main`, with `concurrency`+`cancel-in-progress` per branch/ref so stale runs don't pile up. All use Node 24 with npm caching.
- **typecheck**: `npx tsc --noEmit`.
- **lint**: `npm run lint`.
- **build**: `npm run build`, with `NEXTAUTH_SECRET`/`NEXTAUTH_URL`/`DATABASE_URL`/`DATABASE_DIRECT_URL` injected from repo secrets.
- **test**: runs `npm run test:setup-db` (provisioning `athlasx_test` against the *same shared* Neon database secrets used locally — a workflow comment explicitly accepts the risk of two concurrent CI runs racing against that one shared schema as "a known, accepted risk at this repo's current PR cadence, not something this workflow solves") then `npm run test:ci` (unit + integration + security + known-defects; e2e is not run in CI).

### `scripts/` (only one file currently present: `scripts/setup-test-db.mjs`)

Provisions the isolated `athlasx_test` Postgres schema integration tests run against. Rationale documented in-file: since every model is pinned to the `athlasx` schema via `@@schema`, a mere connection-string/env change can't redirect Prisma writes elsewhere — so the script instead:
1. Reads `prisma/schema.prisma`, string-replaces every `@@schema("athlasx")` → `@@schema("athlasx_test")` and the datasource's `schemas = ["athlasx"]` → `["athlasx_test"]`, and appends an `output` path to the `generator client` block pointing at `node_modules/.prisma-test/client` (so this generated client can never shadow the app's real one).
2. Writes the result to a generated, do-not-edit `prisma/schema.test.prisma` with a banner comment, after sanity-checking it has at least one `athlasx_test`-pinned model and zero remaining `athlasx` references (throws otherwise).
3. Runs `prisma generate --schema prisma/schema.test.prisma` then `prisma db push --schema ... --skip-generate --accept-data-loss` against that derived schema.
4. Supports `--drop` to `DROP SCHEMA athlasx_test CASCADE` and delete the generated file for teardown.
5. Uses a **relative** schema path (`prisma/schema.test.prisma`) rather than absolute, with a comment explaining why: the repo can live under a directory containing a space, and `execFileSync` with `shell: true` on Windows doesn't quote arguments — a portability fix for Windows-hosted dev machines (relevant here, since this session's own repo lives under a Windows-mounted path).
6. `tests/helpers/test-db.ts` is annotated as "Generated by scripts/setup-test-db.mjs" for the schema file it depends on, though `test-db.ts` itself is a checked-in file, not generated — only `schema.test.prisma` and the `.prisma-test` client output are generated artifacts.

### `.mailmap`

One entry: maps `Harryj05 <harshitjain382005@gmail.com>` as the canonical identity for commits authored under `<harshitjain382005@mail.com>` — consolidates two email addresses used by the same contributor in `git log`/`git shortlog` output.

### `.gitattributes`

One line: `* text=auto eol=lf` — normalizes all text files to LF line endings regardless of the committing platform (relevant since this repo is developed from a Windows-mounted path).
## 11. Known Gaps, Risks & Findings

Pulled together from what the four reference sections above surfaced individually — collected here because each one is easy to miss reading a single file in isolation, but matters when you look at the system as a whole.

**`academy_admin` is a second-class role.** It's enforced across every `src/app/api/academy/**` route (`requireRole(req, ["academy_admin"])`) and stored on `User.role`, but it is missing from the `UserRole` type union in `src/types/index.ts`, absent from `NAV_SECTIONS` in `src/lib/chrome.ts`, and there is no `src/app/(dashboard)/academy/**` page group at all. The backend for academy administration exists; the frontend to use it does not. An academy admin who signs in today has no dashboard section that routes anywhere.

**The dashboard KPI route leaks cross-association aggregate counts.** `GET /api/dashboard`'s own code comment says so directly: the auth-hardening pass fixed unauthenticated access, but `registrations`, `pendingIngest`, `formDropAlerts`, `trialCycles`, `totalIngestJobs`, the most recent `SelectionSession`, and `claimedCount` are computed globally across every association, not scoped to the caller's own. Only the `players` list feeding the score-distribution chart is properly scoped. A signed-in association-staff user today sees other associations' aggregate numbers on their own dashboard.

**Test fixture cleanup doesn't cover the ported academy tables.** `tests/helpers/test-db.ts`'s `resetDb()` truncates the older `academies`/`academy_match_candidates` tables between suites but not `academy_batches`, `academy_batch_memberships`, `academy_join_requests`, or `academy_attendance_flags` — an oversight from when that subsystem was ported in. The academy integration tests currently pass by relying on fresh `beforeEach` fixtures rather than a genuinely clean table, which is fragile if a future test in that file doesn't follow the same discipline.

**`src/lib/athlasx-score.ts`'s bowling-economy formula doesn't match its own comment**, per the open `DEFECT 2` test in `tests/known-defects/engine-and-matching.test.ts`: the comment claims "6.5 economy → 10 points," the actual formula (`(10 - economy) / 4 * 10`) yields 8.75 at economy 6.5, and a separate internal spec document states a third value. The test is intentionally left failing until someone reconciles all three.

**Academy-name fuzzy matching (`DEFECT 3`, open) has a known false-positive risk that's currently masked, not fixed.** `src/lib/string-similarity.ts` can't fully distinguish a true abbreviation ("Sharma Cricket Acad.") from a genuinely different academy that happens to share boilerplate words ("Cricket Academy"). It's safe today only because nothing auto-confirms above the suggestion threshold — a human always approves. The product spec's own W8 notes contemplate an auto-confirm threshold in the future, at which point this becomes a live data-integrity bug, not a theoretical one.

**A stale comment references a route that doesn't exist.** `next.config.mjs`'s CSP documentation says "the one external fetch (Razorpay) is in `app/api/admin/launch-checklist/route.ts`" — that route doesn't exist anywhere in the current `src/app/api` tree, there's no Razorpay dependency in `package.json`, and no reference to it anywhere else in the codebase. Either dead documentation from an earlier iteration, or a route that was planned and never built. Worth a five-minute look before anyone trusts that comment for a CSP audit.

**`franchise_scout` visibility tier is a valid enum value with no feature behind it.** `src/lib/feature-flags.ts`'s `FRANCHISE_SCOUT_ENABLED` is hardcoded `false`, enforced independently in three places (UI never offers it, POST routes reject it, `canViewPlayerProfile` re-checks the flag even against a row that somehow already has the tier set) — genuinely well-defended dead code, but dead code nonetheless. No scout role, no franchise-org qualification logic exists anywhere.

**Two pages are stubs.** `/notifications` renders a hardcoded 3-item array, not a real feed. `/settings` explicitly renders "Settings management is not yet implemented."

**`CoachProfile.squad_ids` is a confirmed-dead schema field** — a repo-wide grep found no route or component that reads or writes it; the real squad-coach relationship is the `SquadCoach` join table. Left in place per an explicit schema comment rather than removed.

**No payment gateway exists anywhere in the codebase.** Trial registration `fee_status` can only ever be `pending` or manually set — there is no code path that transitions it to `paid`. The `/trial-cycles/[id]/register` page is explicit in its own copy that the fee is paid in cash at the venue.

**In-memory rate limiting has no cross-instance guarantee.** `src/lib/rate-limit.ts` is a documented stopgap — a `Map` scoped to one Node process. On Vercel's serverless model, this means the 5-sends/hour OTP limit is actually "5 per warm instance," not truly 5 per phone number globally. `@upstash/ratelimit`/`@upstash/redis` are already installed as dependencies, suggesting a real fix was planned but not finished.

**`my-record`'s consent-withdrawal behavior is flagged in its own code comment as an open product question, not a resolved one** — the route hides a player's own data from themselves once they withdraw consent, applied uniformly per an audit finding, but the comment explicitly asks whether that's actually the right UX. Worth a product decision, not just an engineering one.

None of the above are things this document is asking you to fix — they're the honest state of the system as read from the code today, surfaced so a decision to act on any of them is made deliberately rather than discovered by accident later.

---

## Appendix: relationship to prior branch-consolidation work

This document describes the codebase as it exists on `main` after the branch consolidation covered earlier in this conversation (`Old_SportX_Files_Initial/`, the unwired `Backend/AI/` FastAPI service, and `infra/`'s broken Docker Compose setup have all since been removed; the academy batch/attendance/join-request subsystem from `v1-features-sparsh` has been ported in). If you're picking this document up without that context, the short version: everything documented above is what's actually live and reachable today — there is no second, parallel implementation of any of it sitting on another branch.
