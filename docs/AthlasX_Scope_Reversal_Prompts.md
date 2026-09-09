# AthlasX — Migration, Academy Flag Flip, and Scope-Reversal Investigations

Covers: (1) the pending player_phase1_high.sql migration, shown before
applied, per standing sequencing rule; (2) flipping ACADEMY_SELF_SERVE_ENABLED
on, since Academy is already fully built per the handoff spec; (3) and (4)
investigate before building for the two reversed decisions (Association
self-serve, Scout) — don't build from scratch if something already exists.

No Scout build prompt yet — that's blocked on the minor-data-visibility
answer noted separately, and on INV-1's findings.

## Prompt MIG-1 — Show the migration, don't apply it yet

```
Print the full contents of prisma/manual_migrations/player_phase1_high.sql
here in your response. Also run a schema diff (prisma migrate diff or
equivalent) comparing it against the live DB's actual current schema, and
show that too, so I can see exactly what changes relative to what's live
right now — not just what the file says in isolation.

Do not run this against DATABASE_DIRECT_URL or DATABASE_URL yet. Stop
after printing both and wait for an explicit "apply it" instruction in a
follow-up message. Once you get that explicit go-ahead, apply it via
DATABASE_DIRECT_URL (never the pooler URL for a schema change), then
confirm with a live SELECT that the gender column exists on both User and
PlayerProfile, then re-test /api/player/onboard end-to-end with a real
test account to confirm the 500 is gone.
```

## Prompt ACA-1 — Turn on Academy self-serve

```
Set ACADEMY_SELF_SERVE_ENABLED to true (in .env.local for local testing;
confirm with me before touching any shared/production env config). Then:
1. Confirm the Academy option now appears as a live signup path on /auth
   and routes to /academy/onboarding.
2. Confirm the Academy nav section appears in DashboardSidebar for an
   academy_admin session and the five existing Academy pages
   (overview/players/add-players/join-requests/batches) are reachable.
3. Run tsc + build to confirm nothing was relying on the flag being off.
4. Create one real academy_admin test account through the actual signup
   flow (not a DB insert) and walk all five pages, reporting anything
   that breaks now that it's reachable outside of direct-URL testing.

Don't apply the responsive/accessibility fixes from HP-4 as part of this
prompt — that's separate work. This prompt is just: turn it on, confirm
it works end to end.
```

## Prompt INV-1 — What already exists behind FRANCHISE_SCOUT_ENABLED

```
Before building anything new for Scout: grep the codebase for
FRANCHISE_SCOUT_ENABLED and every file/route/component it gates. Report,
without changing anything yet:
1. What pages, API routes, schema fields, or role enums already exist for
   a scout/franchise-scout concept, even if unfinished or unreachable.
2. What data a scout account would see per the existing (unfinished) code
   — specifically whether it already has any guardian-consent or
   minor-visibility restriction built in, or whether it currently has
   unrestricted access to player profiles.
3. Whether this matches "franchise scout" (a scout employed by/affiliated
   with a specific franchise/team) or something closer to an independent
   scout — the pivot doc's non-goals section specifically excludes an
   independent-scout marketplace, so this distinction matters for whether
   reactivating this code is even the same feature being asked for now.
4. Git blame/log on when this flag and its gated code were added, and
   whether there's a commit message or doc reference explaining the
   original intent.

This is a report-back prompt. Do not enable the flag, do not build UI,
do not modify the schema. I need to know what's actually there before
deciding whether to finish this code or design a new Scout feature from
scratch.
```

## Prompt INV-2 — Find the removed Association self-serve wizard in git history

```
Decision A-1 (search git log/commit messages for "association" and
"onboarding" around when /onboarding/association was converted to a
static notice page) removed a self-serve Association onboarding wizard.
Find that commit, show me what the wizard collected (form fields, steps,
what API endpoint it posted to, what it created in the DB) before it was
removed, and whether the backend/API it posted to still exists or was
also removed.

Report back only. Don't restore or rebuild anything yet — once I see
what existed before, that's a real starting point instead of a
from-scratch build, and I still need to decide what changes (if any)
relative to what was originally there before A-1 removed it.
```
