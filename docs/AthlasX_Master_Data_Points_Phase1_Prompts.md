# AthlasX Master Data Points — Phase 1 Decisions & Prompts

Source: `docs/AthlasX_Master_Data_Points_Integration_Plan.md`. Answers to
the 5 open questions, then the Claude Code prompts to execute Phase 1
(HIGH fields only) against them. Nothing has been applied to the DB —
write-only migrations, per the standing rule.

## Decisions on the 5 open questions

**1. Batch/Group field — dual-mode, not a pure decision between the two options.** Add both `batch_id String?` (FK to the existing `AcademyBatch.id` — that model is already in the schema and already has committed migrations, e.g. `8ad5f52`) and `batch_label String?` (free text). App logic: if the player's academy has `AcademyBatch` rows, require `batch_id`; otherwise require `batch_label`. **Flag:** this reuses the `AcademyBatch` table as a foreign-key target, but does not turn on the batch-management UI, which is still sitting behind `ACADEMY_SELF_SERVE_ENABLED=false` and was never cleared through that decision gate. Referencing an existing table for a nullable FK is schema-safe either way; building new batch-CRUD screens is not part of this phase and shouldn't sneak in here.

**2. Personal Phone (15+) — `User.phone`, not a new `PlayerProfile` column.** [Likely] This matches the existing convention (Academy's contact info already lives on `User`, not `Academy`) and the pivot doc's own shadow-profile-then-claim model: an admin-imported, unclaimed player has no `User` row yet, so the field is simply absent until the player claims their profile — it isn't supposed to exist earlier than that.

**3. CSV template — yes, drop District, match the doc's 8 columns exactly:** `Name, DOB, Gender, Role, Batting style, State, Batch, Guardian (if minor)`. Batch in the CSV is always the free-text `batch_label` from decision 1 — a bulk-import admin should never need to know an internal batch ID.

**4. Enum consolidation — split down the middle, not all-or-nothing.** Don't consolidate the range enums (`FeeRange`, `IntakeRange`, `PlayerCountRange`, capacity bands) — they look similar but their buckets mean different things (players vs. rupees vs. seats), and sharing one enum risks a value meaning one thing in one field and something else in another. Do consolidate the small generic ones that really are identical everywhere they appear — one shared `TriState` (yes/no/not_sure) instead of one per field, one shared `Frequency` if it recurs. Net: ~18-19 enums instead of 22, not a big cut, but the cut that's actually safe.

**5. Migration sequencing — write and review now, do not apply.** Writing a migration file doesn't touch the live DB; only `prisma migrate deploy`/`db push` does. This unblocks review immediately instead of waiting on the password fix, and nothing here changes the "no schema changes without explicit go-ahead" rule — that gate is on *applying*, not *drafting*.

**DB status, for the record:** I couldn't independently confirm the P1000 is fixed or still broken. Supabase's own logs show no new auth failures since `2026-09-06T18:38:21Z`, but that's as consistent with "nobody's tried connecting since" as with "it's fixed." My own attempt to test it via `prisma db execute` failed on something unrelated — a 403 fetching Prisma's own schema-engine binary checksum, which looks like a network/proxy restriction on your machine, not a database credential problem. So: still unverified. Prompt P1-F below re-tests this before anything gets applied.

## Prompts

### Prompt P1-A — Academy Phase 1 schema (write-only, do not apply)

```
Add these columns/enums to the Academy model in prisma/schema.prisma:
city (String?), year_established (Int?), academy_type (new enum
AcademyType: private, government, sports_club, school_attached, ngo,
trust), contact_name (String?), contact_designation (String?),
bcci_affiliated (Boolean @default(false)), bcci_affiliation_id (String?),
state_assoc_affiliated (Boolean @default(false)), state_assoc_names
(String[]), head_coach_name (String?), active_player_count_range (new
enum PlayerCountRange: under_50, 50_100, 100_250, 250_plus).

Also add the shared TriState enum (yes, no, not_sure) now even though it's
not used until Phase 3 — it's a Phase 1 schema-file change either way and
saves a second migration file later. Do not add any other Phase 2/3
columns yet.

Run `npx prisma migrate dev --create-only --name academy_phase1_high` to
generate the migration file WITHOUT applying it (--create-only). Show me
the generated SQL and the schema diff. Do not run migrate deploy, db push,
or anything that touches the live database.
```

### Prompt P1-B — Wire the 9 already-collected Academy fields to persistence

```
POST /api/academy/onboard currently discards these fields that
src/app/academy/onboarding/page.tsx already collects in React state:
year_established, academy_type, contact_name, contact_designation,
bcci_affiliated, bcci_affiliation_id, state_assoc_affiliated,
state_assoc_names, head_coach_name, active_player_count_range. Wire them
through to the Academy row on creation — validate each against the new
enum/type from Prompt P1-A, same validation style already used for the
existing fields in that route.

Add one genuinely new form field: City, in Step 2's identity block,
alongside the existing District/State fields. Persist it the same way.

Do not change any other step, do not touch Phase 2/3 fields, do not run
any migration commands — schema is handled by P1-A.
```

### Prompt P1-C — Player Phase 1 schema (write-only, do not apply)

```
Add these columns/enums to PlayerProfile in prisma/schema.prisma: gender
(new enum Gender: male, female, other — no default value, must be
explicitly set, never default to male), city (String?), guardian_name
(String?), enrollment_date (DateTime? @db.Date), batch_id (String?, FK to
AcademyBatch.id, nullable), batch_label (String?), highest_level_represented
(new enum CompetitiveLevel: club_only, school_team, zonal, district_team,
state_trial, state_team, ipl_trial, national), cricheroes_handle (String?).

Do not add a phone column to PlayerProfile — personal phone for 15+
players goes on User.phone, which already exists; confirm that column
already supports this without changes.

Run `npx prisma migrate dev --create-only --name player_phase1_high` to
generate the migration WITHOUT applying it. Show me the SQL and diff.
Do not run migrate deploy or db push.
```

### Prompt P1-D — Wire Player Phase 1 fields into the wizard + API

```
In the self-serve player onboarding wizard (src/app/player/onboarding/page.tsx)
and its API route:

1. cricheroes_handle is already collected in form state but discarded by
   the API — wire it through, no new UI needed.
2. Add new required fields to the appropriate existing step: Gender
   (select, no pre-selected value), City, Guardian Name, Enrollment Date,
   Highest Level Represented (select).
3. Add Batch as a dual-mode field: if the player's selected academy has
   AcademyBatch rows (query them), show a dropdown of real batches and
   save to batch_id; if it has none, show a free-text field and save to
   batch_label. Do not add any batch-creation UI here — only consume
   existing AcademyBatch rows if present.
4. Extend the existing guardian-gating logic (the same pattern already
   used for guardian_phone when DOB confirms a minor) to also require
   guardian_name in that case.
5. Drop the standalone yearsExperience field from the form — it's
   superseded by playing_since_year, which is Phase 2, not Phase 1; for
   now just stop collecting yearsExperience rather than adding its
   Phase 2 replacement.

Do not touch Phase 2/3 fields. Do not run migration commands — schema is
handled by P1-C.
```

### Prompt P1-E — CSV template fix

```
Replace the admin bulk-import CSV template and its parser/validator with
exactly these 8 columns, in this order: Name, DOB, Gender, Role, Batting
style, State, Batch, Guardian (if minor). Remove District from both the
template and the parser — district should be inherited from the
importing academy's own district/state, not re-specified per row. Batch
in the CSV always maps to batch_label (free text) — never require a
batch_id in the CSV. Guardian is required only when DOB indicates a
minor, same rule as everywhere else. Update the downloadable template
file and any docs/help text that reference the old 5-column format.
```

### Prompt P1-F — Verification (run last)

```
Run `npx tsc --noEmit`, `npm run build`, and the test suite. Then attempt
a real DB connectivity check: `npx prisma db execute --url "$DATABASE_URL"
--file <(echo "SELECT 1;")`. Report the exact output — if it's a P1000
password error, say so exactly; if it's a network/proxy error like a
schema-engine checksum fetch failing, say so exactly; if it succeeds, say
so. Do not apply either Phase 1 migration (academy_phase1_high,
player_phase1_high) regardless of what this check shows — that needs a
separate explicit go-ahead from me once connectivity is confirmed clean.
Confirm via `git status` that the migration folders exist as new
uncommitted files and nothing else changed.
```
