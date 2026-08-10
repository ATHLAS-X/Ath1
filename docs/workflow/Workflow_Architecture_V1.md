# AthlasX V1 — Workflow Architecture

> Programmatic workflows, database state machines, and API surface for the four
> core role pipelines: **Academy Admin / Coach**, **Scout**, **Tournament Organizer**,
> and **AthlasX Admin**.
>
> Grounded in the **live Neon schema** (`lib/schema.sql`) — which is what actually
> runs — not the additive Prisma target (`prisma/schema.prisma`). The two diverge;
> where the live schema wins, it is called out. Key live-schema facts that shape
> everything below:
>
> - `player_profiles.verification_level` is an **INTEGER 1–4**, not an enum.
>   `1 = Self Registered`, `2 = Identity Verified`, `3 = Performance Verified`, `4 = Scout Verified`.
> - `player_profiles.profile_status` is a **string**: `Draft → Pending → Active`.
> - `player_profiles.visibility` is a **string**: `Private | Scout Visible | Public`.
> - Scout tables (`scout_shortlist`, `scout_notes`, `scout_trial_invites`, `scout_views`)
>   are keyed by **`user_id`** (`scout_user_id`, `player_user_id`) — *not* profile ids.
> - A draft player profile can have **`user_id = NULL`** until claimed.

---

## 0. The role × phase matrix (mirrors `Workflow Architecture.html`)

Every entity moves left→right through six phases. A cell is **active** (the role
acts) or **passive** (the role waits / is acted upon). The green "output rail"
is the artifact each phase emits.

| Role ▽ / Phase ▷ | **1 · Ingest** | **2 · Identity** | **3 · Enrich** | **4 · Verify** | **5 · Discover** | **6 · Engage** |
|---|---|---|---|---|---|---|
| **Academy Admin** | CSV bulk upload → Draft profiles + invite codes | *(passive)* | Coach appends fitness/behaviour rows | Submit player for approval | *(passive)* | View academy roster analytics |
| **Coach** | *(passive)* | *(passive)* | Append Fitness / Behavioural rows (`can_submit=TRUE`) | Sign coach-verification | *(passive)* | *(passive)* |
| **Player** | Claim invite / self-register | OTP + Aadhaar + guardian consent → `Active` | Stats, media, fitness | Submit evidence | Toggle `Scout Visible` (gated) | Receive scout trial invites |
| **Scout** | *(passive)* | *(passive)* | *(passive)* | *(passive)* | Compound filter search | Watchlist + private notes + trial invite |
| **Tournament Org** | Create Match + scorecard | Auto-create placeholder profiles | Write `match_logs` rows | OCR confidence → review queue | *(passive)* | *(passive)* |
| **AthlasX Admin** | *(passive)* | Approve identity (`level 1→2`) | *(passive)* | Approve evidence (`level →3`), gate visibility | Approve placeholder claims | Approve / Reject / Suspend any entity |
| **Output rail** | Draft rows + tokens | `account_status=Active` | Assessment history | `verification_level↑` | Searchable index | Watchlist / trial / engagement |

---

## 1. Academy Admin — bulk roster upload, claim & activate, coach assessments

### 1.1 State machine

```
PLAYER PROFILE  (profile_status)
   ┌─────────┐  CSV insert (user_id NULL)   ┌─────────┐
   │  (none) │ ───────────────────────────▶ │  Draft  │
   └─────────┘                              └────┬────┘
                                                 │ player opens /claim/<token>
                                                 │ + OTP verified + consent
                                                 ▼
                                            ┌─────────┐  admin approves   ┌────────┐
                                            │ Pending │ ────────────────▶ │ Active │
                                            └────┬────┘                   └────────┘
                                                 │ admin rejects
                                                 ▼
                                            ┌──────────┐
                                            │ Rejected │ (editable → resubmit → Pending)
                                            └──────────┘

INVITE  (player_invites.status)
   Pending ──send──▶ Sent ──player claims──▶ Claimed
                       └────TTL elapsed─────▶ Expired

USER ACCOUNT  (users.account_status)
   pending ──OTP verified + (consent if minor)──▶ active ──admin──▶ suspended
```

**Activation invariant (enforced server-side, not by the client):**

```
activate(profile):
    require otp_verified == true
    age = years_between(date_of_birth, today)
    if age < 18:
        require guardian_consent.parent_phone_verified == true
        require guardian_consent.disclaimer_signed     == true
        set    player_consents.minor_flag = true        # forced, not trusted from client
    set users.account_status      = 'active'
    set player_profiles.profile_status = 'Pending'   # awaits academy/admin approval
    set player_invites.status     = 'Claimed', claimed_by_user_id = user.id, claimed_at = now()
    set player_profiles.user_id   = user.id, claimed_at = now()
```

### 1.2 Database transitions per step

| Action | Table(s) written | Transition |
|---|---|---|
| CSV row → draft | `player_profiles` INSERT (`user_id=NULL`, `profile_status='Draft'`, `visibility='Private'`, `verification_level=1`, `source_channel='Academy'`, `created_by_user_id=admin`) | `(none)→Draft` |
| Invite emitted | `player_invites` INSERT (`token`, `status='Sent'`, `sent_at=now()`) | `Pending→Sent` |
| Claim opened | read-only validate token, not expired, `status='Sent'` | — |
| OTP verify | `phone_otps.consumed_at=now()`; `users.phone_verified_at` | account `pending` |
| Guardian (minor) | `guardian_consent` UPSERT (`parent_phone_verified`, `disclaimer_signed`) | gate |
| Activate | `users.account_status='active'`; `player_profiles{user_id, profile_status='Pending', claimed_at}`; `player_invites.status='Claimed'` | `Draft→Pending`, `Sent→Claimed` |
| Coach assessment | `fitness_data` / `fitness_assessments` + `behavioral_assessment` INSERT | append-only history |

### 1.3 API surface

```
POST /api/academy/players/bulk          # CSV → Draft profiles + invites   (academy_admin)
     body: { csv: string, dry_run?: boolean }
     resp: { success, summary:{total,created,skipped,errors}, results:[...] }

POST /api/academy/invites/[id]/resend   # re-send a Sent/Expired invite     (academy_admin)

GET  /api/claim/[token]                  # validate + hydrate draft for claim (public)
POST /api/claim/[token]                  # bind account + activate            (authenticated claimer)
     body: { otp_code, accept_terms, guardian?:{ parent_phone, parent_otp, disclaimer_signed } }

POST /api/auth/otp/send                  # { phone }                         (public)
POST /api/auth/otp/verify                # { phone, code }                   (public)

POST /api/coach/fitness                  # append YoYo / 30m / 2km row       (coach, gated)
     body: { player_user_id, yoyo_level, sprint_time, run_2km_time,
             height_cm, weight_kg, resting_hr_bpm, notes }
POST /api/coach/behaviour                # append behavioural eval           (coach, gated)
```

### 1.4 Coach role gate — `can_submit_fitness_assessments`

The live schema has no boolean column; the equivalent gate is
`coach_registry.coach_status = 'APPROVED'` **and** the coach's academy owns the
player. Treat the boolean as a *derived* permission:

```ts
// lib/permissions.ts
export async function canSubmitFitness(coachUserId: string, playerUserId: string) {
  const rows = await sql`
    SELECT 1
    FROM coach_registry cr
    JOIN academies a            ON a.user_id = cr.user_id          -- coach runs/affiliated to academy
    JOIN player_profiles pp     ON pp.academy_id = a.id
    JOIN users pu               ON pu.id = pp.user_id
    WHERE cr.user_id = ${coachUserId}
      AND cr.coach_status = 'APPROVED'
      AND pu.id = ${playerUserId}
    LIMIT 1`;
  return rows.length > 0;          // ← this IS can_submit_fitness_assessments = true
}
```

Fitness rows are **append-only history** — never UPDATE in place; each session is
a new row, and `player_profiles.latest_yoyo_score` (cache) is refreshed on insert.

---

## 2. Scout — multi-layered talent-pipeline filtering

### 2.1 Schema relationships (live)

```
users(scout) ──1:1── scout_profiles
   │
   ├── scout_shortlist (scout_user_id, player_user_id)  UNIQUE   ← "Watchlist"
   ├── scout_notes     (scout_user_id, player_user_id)  UNIQUE   ← private 1:1 note
   └── scout_trial_invites (scout_user_id, player_user_id)
users(player) ──1:1── player_profiles ──1:many── fitness_data
```

> **Note on the spec ask:** the prompt asks for Watchlist `priority` (Low/Med/High)
> and `category` (Shortlist) plus 1–10 readiness metrics on notes. The live tables
> don't have those columns yet. Add them additively (below) — they don't exist in
> `lib/schema.sql` today, so this is a required migration, not a query change.

```sql
ALTER TABLE scout_shortlist ADD COLUMN IF NOT EXISTS priority VARCHAR(10) DEFAULT 'Medium'; -- Low|Medium|High
ALTER TABLE scout_shortlist ADD COLUMN IF NOT EXISTS category VARCHAR(40) DEFAULT 'Shortlist';
ALTER TABLE scout_notes     ADD COLUMN IF NOT EXISTS readiness  SMALLINT;  -- 1..10
ALTER TABLE scout_notes     ADD COLUMN IF NOT EXISTS potential  SMALLINT;  -- 1..10
ALTER TABLE scout_notes ADD CONSTRAINT scout_notes_readiness_ck CHECK (readiness BETWEEN 1 AND 10);
ALTER TABLE scout_notes ADD CONSTRAINT scout_notes_potential_ck CHECK (potential BETWEEN 1 AND 10);
```

### 2.2 The compound filter query

Visibility + verification + role + latest YoYo, only over discoverable players:

```sql
SELECT
  u.id              AS player_user_id,
  pp.first_name, pp.last_name,
  pp.playing_role, pp.state, pp.city,
  pp.verification_level,
  pp.latest_yoyo_score,
  (sl.id IS NOT NULL) AS on_my_watchlist
FROM player_profiles pp
JOIN users u ON u.id = pp.user_id
LEFT JOIN scout_shortlist sl
       ON sl.player_user_id = u.id AND sl.scout_user_id = $scout_user_id
WHERE pp.visibility          = 'Scout Visible'    -- (or 'Public')
  AND pp.verification_level >= 3                  -- Performance Verified+
  AND pp.playing_role        = 'All-Rounder'
  AND pp.latest_yoyo_score   >= 15.0
  AND u.account_status       = 'active'
ORDER BY pp.verification_level DESC, pp.latest_yoyo_score DESC
LIMIT 50 OFFSET $offset;
```

Supporting index (composite, partial — only discoverable rows):

```sql
CREATE INDEX IF NOT EXISTS pp_scout_search_idx
  ON player_profiles (playing_role, verification_level, latest_yoyo_score DESC)
  WHERE visibility IN ('Scout Visible','Public');
```

If `latest_yoyo_score` isn't denormalised, derive it with a lateral join instead:

```sql
LEFT JOIN LATERAL (
  SELECT yoyo_level FROM fitness_data f
  WHERE f.user_id = u.id ORDER BY f.created_at DESC LIMIT 1
) yo ON TRUE
WHERE ... AND yo.yoyo_level >= 15.0
```

### 2.3 Save to watchlist + private notes (RLS)

```sql
-- Add to watchlist (idempotent on the UNIQUE pair)
INSERT INTO scout_shortlist (scout_user_id, player_user_id, priority, category)
VALUES ($scout, $player, $priority, $category)
ON CONFLICT (scout_user_id, player_user_id)
DO UPDATE SET priority = EXCLUDED.priority, category = EXCLUDED.category;
```

**Row-Level Security** — notes are *only ever* readable by their author. Enforce
in the DB so a query bug can't leak them:

```sql
ALTER TABLE scout_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE scout_notes FORCE ROW LEVEL SECURITY;
CREATE POLICY scout_notes_owner ON scout_notes
  USING       (scout_user_id = current_setting('app.user_id')::uuid)
  WITH CHECK  (scout_user_id = current_setting('app.user_id')::uuid);
-- App sets per-request:  SET LOCAL app.user_id = '<session user id>';
```

In application code (no Postgres RLS on serverless pooled connections), the
equivalent gate is a hard `WHERE scout_user_id = session.user.id` on **every**
read/write, plus a server check that the caller's role is `scout`.

### 2.4 API surface

```
GET  /api/scout/search?role=All-Rounder&min_verification=3&min_yoyo=15&visibility=Scout+Visible
POST /api/scout/watchlist        { player_user_id, priority, category }
DELETE /api/scout/watchlist/[player_user_id]
GET    /api/scout/notes/[player_user_id]                 # author-only
PUT    /api/scout/notes/[player_user_id]  { body, readiness, potential }
POST   /api/scout/trial-invite   { player_user_id, message }
```

---

## 3. Tournament Organizer — match ingestion & placeholder reconciliation

### 3.1 Pipeline (transactional)

```
processScorecard(matchId, scorecard):
  BEGIN
    INSERT match_logs(...) for the match           -- ocr_status='PENDING'
    for each player_line in scorecard:
        existing = SELECT user_id FROM player_profiles
                   WHERE <fuzzy match: name + dob/team>  AND user_id IS NOT NULL
        if existing:
            target_user = existing.user_id
        else:
            # create UN-CLAIMED placeholder
            INSERT player_profiles(user_id NULL, first/last, source_channel='Tournament',
                                   profile_status='Draft', visibility='Private', verification_level=1)
            target_profile = new.id
        INSERT performance_stats / match_logs row keyed to target
    COMMIT
  on error: ROLLBACK (no half-written scorecards)
```

OCR confidence routes the match: `ocr_confidence >= 0.85 → auto-accept`, else
`ocr_status='REVIEW'` into the admin queue (`match_logs.reviewed_by`).

### 3.2 Reconciliation / claim flow

```
Independent player registers ──▶ searches placeholder profiles by name/tournament
        │
        ▼
POST /api/player/claim-request  { placeholder_profile_id, evidence }
        │  creates verifications(type='IDENTITY', status='Pending', submitted_by=player)
        ▼
Admin reviews ──approve──▶ MERGE: placeholder.user_id = player.id,
                                  re-key match_logs/performance_stats to player,
                                  source_channel stays 'Tournament', verification_level=max(...)
              └─reject──▶ verifications.status='Rejected', placeholder untouched
```

Merge must be a single transaction re-pointing all child rows, then deleting/locking
the orphan placeholder so a player can't claim it twice (`profile_status='Claimed'`).

### 3.3 API surface

```
POST /api/tournament/matches            { tournament_id, teams, format, match_date }
POST /api/tournament/matches/[id]/scorecard   { rows:[...], scorecard_url }
GET  /api/player/unclaimed?name=&tournament=   # search placeholders
POST /api/player/claim-request          { placeholder_profile_id, evidence_url }
POST /api/admin/claim-requests/[id]/approve | /reject
```

---

## 4. AthlasX Admin — verification, visibility gating, account control

### 4.1 Verification level promotion

```
verification_level:  1 Self ──▶ 2 Identity ──▶ 3 Performance ──▶ 4 Scout
```

```
POST /api/admin/verifications/[id]/approve
  payload: { evidence_reviewed: true, target_level: 3, note }
  rules:
    require evidence_url IS NOT NULL                 -- can't promote without evidence
    require target_level == current_level + 1        -- no skipping levels
    require reviewer.role == 'athlasx_admin'
  effect:
    verifications.status='Approved', reviewed_by, reviewed_at
    player_profiles.verification_level = target_level
```

### 4.2 Hard visibility middleware (the trust gate)

This is the single most important rule — a profile **cannot** become discoverable
without the right consents. Throw, don't silently coerce:

```ts
// middleware: assertVisibilityChange
export function assertCanGoVisible(profile, consent, guardian) {
  const goingPublic = ['Scout Visible', 'Public'].includes(profile.next_visibility);
  if (!goingPublic) return;                       // Private is always allowed

  if (!consent.profile_visibility_ok)
    throw new ForbiddenError('profile_visibility_consent is false');

  const isMinor = ageYears(profile.date_of_birth) < 18;
  if (isMinor && !guardian?.parent_phone_verified)
    throw new ForbiddenError('minor requires parent_contact_consent');

  // only reached when all gates pass
}
```

State transition is rejected at the API boundary — the player UI may *offer* the
toggle, but the server is the authority.

### 4.3 Account status control (any entity)

```
account_status:   pending ──▶ active ──▶ suspended ──(reinstate)──▶ active

POST /api/admin/users/[id]/status   { action: 'Approve'|'Reject'|'Suspend'|'Reinstate', reason }
  Approve   → account_status='active'   (+ profile_status='Active' if applicable)
  Reject    → account_status='pending', profile_status='Rejected'  (editable)
  Suspend   → account_status='suspended' (blocks login + hides from discovery)
  Reinstate → account_status='active'
  guards: reviewer.role=='athlasx_admin'; log to admin_notifications / fraud_flags
```

### 4.4 Validation rule engine (declarative)

```ts
const RULES = {
  'profile.go_visible': [
    r => r.consent.profile_visibility_ok            || 'visibility consent missing',
    r => !r.isMinor || r.guardian.parent_phone_verified || 'guardian consent missing',
  ],
  'verification.promote': [
    r => !!r.verification.evidence_url              || 'evidence required',
    r => r.target_level === r.current_level + 1     || 'cannot skip levels',
  ],
  'player.activate': [
    r => r.otp_verified                             || 'otp not verified',
    r => !r.isMinor || r.guardian.disclaimer_signed || 'guardian disclaimer unsigned',
  ],
};
function enforce(action, ctx) {
  for (const rule of RULES[action]) {
    const res = rule(ctx);
    if (res !== true) throw new ForbiddenError(`${action}: ${res}`);
  }
}
```

---

## 5. Cross-cutting authorization

| Endpoint group | Allowed role(s) | Extra gate |
|---|---|---|
| `/api/academy/*` | `academy_admin` | owns the `academies` row |
| `/api/coach/*` | `coach` | `coach_status='APPROVED'` + owns player via academy |
| `/api/scout/*` | `scout` | `scout_user_id == session.id` on every row |
| `/api/tournament/*` | `tournament_organizer` | owns the match |
| `/api/admin/*` | `athlasx_admin` | — |
| `/api/claim/*`, `/api/auth/*` | public / claimer | token validity |

> **Role-value gotcha (from memory):** the codebase carries dual admin role values
> (`athlasx_admin` vs legacy). Gate on a normalized set, e.g.
> `['athlasx_admin','admin'].includes(role)`, not a single literal.

---

## 6. End-to-end chain (the footer of the HTML)

```
CSV upload → Draft + invite → claim + OTP + consent → Active
          → coach fitness/behaviour rows → submit → admin verify (level↑)
          → consent-gated visibility → scout compound search → watchlist + notes
          → trial invite → engagement.  Tournament scorecards fork in at "Enrich"
          as un-claimed placeholders, reconciled via admin-approved claim.
```
