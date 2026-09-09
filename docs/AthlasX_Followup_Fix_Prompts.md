# AthlasX — Follow-up Fix Prompts (from the "Not Resolved" report)

Resolved without a prompt: item 3 (Association OTP architecture) is fully
closed — you confirmed production is a single long-running Node server,
so the globalThis singleton fix is sufficient, no further work. Item 5
(Academy table) is a doc correction, not a build task — see DOC-1.

Not prompted, still open, needs your call before anything gets built:
item 4 (Coach OTP resend UX — you said you'd design this yourself), item
7 (mockup-parity gaps needing new fields on 3 APIs — tell me: add the
fields, or simplify the design to match what the APIs actually return),
item 8 (Scout tile / dead Association click — likely moot once the Scout
build and Association rebuild land; not worth fixing twice).

## Prompt DB-1 — Draft and print both pending schema changes, apply neither yet

```
Two live-DB schema gaps, handle together as one review (minimize live-DB
touches):

1. player_phase1_high.sql already exists (adds gender to User and
   PlayerProfile) — print its full contents again, plus a fresh schema
   diff against the live DB's current actual state (not the last diff,
   a new one, since time has passed and other changes may have landed).

2. The live UserRole enum is missing academy_admin entirely — no
   migration exists for this yet. Draft one (a proper migration file
   under prisma/manual_migrations/, matching the naming/format
   convention of the existing player_phase1_high.sql), and print its
   full contents. This is very likely why Master Prompt 3's step 4
   (creating a real academy_admin account through actual signup) never
   fully succeeded — the enum value it needs doesn't exist live.

Print both migrations and both diffs. Do NOT apply either to the live DB.
Stop and wait for one explicit "apply both" instruction as a separate
follow-up message. When that arrives, apply them in the same session via
DATABASE_DIRECT_URL (never the pooler URL), in this order: enum change
first, then the gender columns (the enum change has no dependency on the
other, but sequencing it first means if something goes wrong, the
gender-column change — the one already reviewed once before — isn't the
one left half-applied). After both apply, confirm live: SELECT to verify
academy_admin exists in the enum, SELECT to verify gender exists on User
and PlayerProfile, then re-attempt Master Prompt 3 step 4 (real
academy_admin signup) and Master Prompt 1 step 2/3 (player onboarding
completion) end-to-end to confirm both are actually unblocked now, not
just schema-correct.
```

## Prompt DOC-1 — Correct the Academy section of the design-handoff spec

```
docs/AthlasX_Dashboard_Design_Handoff_Spec.md's Academy section describes
an 8-column Players table. The live /academy/players page actually uses
a list+detail layout instead, and that's staying — no table rebuild.
Read the actual current /academy/players page source directly, and
rewrite that section's Layout and Components table to describe the real
list+detail implementation accurately: what's in the list view, what
expands/opens in the detail view, which of the originally-specified
fields (Age, Batch, Batting, Playing Style, Role, Guardian Phone,
State/District, MINOR badge) appear where. Keep the rest of that item's
gap-reporting (guardian-phone visibility on mobile, the "—" ambiguity
between not-yet-provided and not-applicable, the CSV per-row result
reporting) — those still apply to whatever layout actually exists, just
correct the layout description itself.
```

## Prompt DR2-CONT — Finish the responsive audit (the two gaps left)

```
The 3-viewport (375/768/1280px) responsive audit is incomplete in two
specific spots:
1. /profile has never been screenshot-tested at any viewport — do that
   now, all three widths.
2. /record was screenshotted once, before the HP-1 accessibility/
   error-state changes (chart data tables, distinct error state, match
   row truncation fix) landed. Re-screenshot it at all three widths to
   confirm those changes didn't introduce any new overflow/clipping.

Report pass/fail same format as the earlier DR-2/HP-6 passes. Don't
re-touch /coach or /association — those are already confirmed at all
three viewports.
```

## Prompt TEST-1 — Audit remaining academy-gated tests for the same flag-dependency risk

```
batches-and-join-requests.test.ts needed a feature-flag mock because it
depended on ACADEMY_SELF_SERVE_ENABLED's live state. Check every other
test file that touches Academy functionality (grep for
ACADEMY_SELF_SERVE_ENABLED and for imports of academy routes/components
across the test directory) for the same dependency. Apply the same
mocking pattern to any file that has it. Report which files were checked,
which needed the fix, and confirm the full test suite still passes after.
```
