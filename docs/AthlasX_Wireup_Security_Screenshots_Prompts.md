# AthlasX — Route Wire-up, Security Pass, Screenshot Documentation, Field Inventory

## 0. Scope corrections (binding on every prompt below)

- No Scout signup, no Scout dashboard, no Scout anything reachable from the UI. It doesn't exist in this system's role model and isn't in scope.
- Association gets no signup wizard. Clicking Association on /auth routes to the existing Ops-mediated notice page, not a form.
- Academy stays behind `ACADEMY_SELF_SERVE_ENABLED`. If you want it reachable from the real auth flow for this documentation pass, that's a separate explicit call to flip the flag — say so and I'll fold it into W-2.
- DB connectivity is still unconfirmed (no recent errors in Supabase's logs, but no recent successful test either). W-5's schema/field work is write-and-report; it doesn't claim persistence works until W-3 confirms a live connection.

## Prompts

### Prompt W-1 — Rename onboarding routes

```
Rename the onboarding routes for consistency:
/onboarding -> /player/onboarding
/onboarding/coach -> /coach/onboarding
/onboarding/academy -> /academy/onboarding
Leave /onboarding/association where it is — it's a static notice page, not
a wizard, and isn't part of this rename.

Add redirects from the old paths to the new ones (don't just 404 anyone
with the old URL bookmarked or linked from existing docs/emails). Update
every internal link/reference to the old paths (nav, auth page, tests,
docs). Run tsc + build after to confirm nothing broke.
```

### Prompt W-2 — Wire the auth role-picker to the correct destination per role

```
On /auth, confirm each role option routes correctly:
- Player -> /player/onboarding
- Coach -> /coach/onboarding
- Academy -> /academy/onboarding IF ACADEMY_SELF_SERVE_ENABLED is true,
  otherwise this option should not appear as a live signup path at all
  (confirm current behavior, don't change the flag)
- Association -> the existing Ops-mediated notice page, never a wizard
- No Scout option exists on this page — confirm, don't add one

Report back exactly what the auth page currently shows for each role
before changing anything, since I want to know the actual current state,
not just the intended one.
```

### Prompt W-3 — Run it locally and confirm DB connectivity

```
Start the app with npm run dev. Run a real connectivity check (SELECT 1)
against both DATABASE_URL and DATABASE_DIRECT_URL and report the exact
result for each, separately. Do not proceed to W-5's persistence wiring
if either fails — report the failure and stop there.
```

### Prompt W-4 — Security pass across every page and route

```
Audit every route (all onboarding pages, all dashboards, all API routes)
for these specifically, and report findings before fixing anything:

1. Every role-gated page checks the session role SERVER-SIDE (in the
   route handler or a server component), not just by hiding a nav link
   client-side. List any page that only gates client-side.
2. Every OTP/auth-adjacent endpoint (phone OTP, password reset, login)
   is covered by the existing rate-limit.ts — list any that aren't.
3. Session cookies are httpOnly, secure (in production), and sameSite —
   confirm the NextAuth config, don't assume defaults are fine.
4. No API route trusts a client-supplied role or user ID without
   re-checking it against the actual session server-side.
5. File upload endpoints (logo, certificates, footage) validate file
   type/size server-side, not just via the <input accept> attribute.
6. No secrets (DB URL, API keys) are reachable from any client bundle —
   grep for process.env usage outside server-only files.

Report as a table: page/route, issue, severity. Fix only after I've seen
the list — some of these may already be handled and I'd rather confirm
than have you touch working auth code speculatively.
```

### Prompt W-5 — Onboarding field status + HIGH/MED gap-filling

```
Using docs/AthlasX_Master_Data_Points_Integration_Plan.md and the earlier
Phase 1 prompts (docs/AthlasX_Master_Data_Points_Phase1_Prompts.md),
report current status per field for Player, Coach, and Academy onboarding
(skip Association — no onboarding wizard exists there): which HIGH fields
are persisted, which are still UI-only/discarded, which don't exist in
the form at all. Do the same for MED fields.

For any HIGH field not yet wired, wire it now (schema via write-only
migration per the earlier sequencing decision, then API + form wiring).
For MED fields, wire them only if doing so doesn't require new UI beyond
what W-3 confirms already renders correctly — flag anything that needs
new form fields instead of just persistence wiring, don't build new UI
in this pass.

Do not apply any migration to the live DB in this prompt — write and
report only, same as before. Applying happens as a separate, explicit
step once W-3's connectivity check is clean AND I've reviewed the diff.
```

### Prompt W-6 — Screenshot documentation: onboarding

```
Using Playwright against the local dev server, walk Player, Coach, and
Academy onboarding (Academy only if ACADEMY_SELF_SERVE_ENABLED is true —
otherwise note it as "not currently reachable, flag off" instead of
forcing it open). For each step: screenshot the page as it appears BEFORE
clicking continue/next, then click continue/next with realistic test
data, and screenshot the next step. Save every screenshot to
docs/screenshots/onboarding/<role>/<step-number>.png.

Do not attempt Association or Scout — neither has an onboarding flow to
document, per section 0 above.

Produce docs/AthlasX_Onboarding_Screenshots.md: one section per role, each
screenshot embedded with a one-line caption of what step/state it shows
and any validation errors or unexpected states you hit along the way.
```

### Prompt W-7 — Screenshot documentation + text-field inventory: dashboards

```
Same Playwright approach, for the dashboards that actually exist and are
reachable: Player (/record, /profile), Coach (/coach), Association
(/association). Skip Academy dashboard screenshots unless the flag is on
for this pass — same caveat as W-6. Skip Scout entirely — it doesn't
exist.

For each dashboard, screenshot every distinct view/tab it has, save to
docs/screenshots/dashboards/<role>/, and produce
docs/AthlasX_Dashboard_Field_Inventory.md listing every text field, label,
button, and data point visible on each screen — this is the master field
list I need before finalizing a design-tool prompt, so be exhaustive, not
just the obvious form inputs (include stat labels, table column headers,
empty-state copy).
```

## The "one master design prompt"

You asked for this last, once fields are finalized — and that's the right order: I can't responsibly write a single design-tool prompt covering every dashboard's fields before W-7's inventory exists, since large parts of Association just got built and Academy is still incomplete. Once W-7's `AthlasX_Dashboard_Field_Inventory.md` comes back, send it to me and I'll write that consolidated prompt against the real field list — not a guessed one. Doing it now would mean generating dashboard mockups around fields that may not match what actually got built.
