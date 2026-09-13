# AthlasX — Wire Onboarding Completion to the Correct Dashboard (Master Prompt for Claude Code)

## Context (verified against the live repo before writing this — do not re-derive from scratch, just confirm and act)

`src/lib/chrome.ts` already defines the single source of truth for role → home route:

```ts
const ROLE_HOME: Record<string, string> = {
  player: '/record',
  coach: '/coach',
  association: '/association',
  athlasx_ops: '/dashboard',
  selection_panel: '/selection',
  academy_admin: '/academy',
  scout: '/scout',
}
export function rootDestination(session) {
  return ROLE_HOME[session.user.role ?? ''] ?? '/dashboard'
}
```

`src/app/page.tsx` (the root route `/`) already calls `rootDestination(session)` server-side and redirects a signed-in visitor straight to their role's home. This is correct and should not change.

Each onboarding flow's own success/completion screen has its **own separate `router.push(...)` call** with a hardcoded path, independent of `rootDestination`. That's where the drift is. Current state per role, verified by reading each file directly:

| Role | Onboarding file | Current completion redirect | Correct? |
|---|---|---|---|
| Player | `src/app/player/onboarding/page.tsx` (line ~481) | `router.push('/record')` | ✅ Correct, matches `ROLE_HOME.player` |
| Coach | `src/app/coach/onboarding/page.tsx` (line ~540) | `router.push('/coach')` | ✅ Correct, matches `ROLE_HOME.coach` |
| Academy | `src/app/academy/onboarding/page.tsx` (line ~623) | `router.push('/dashboard')` | ❌ **Bug** — should be `/academy` (`ROLE_HOME.academy_admin`). `/dashboard` is the Ops home, not the academy's. |
| Scout | `src/app/scout/onboarding/page.tsx` (line ~450) | `router.push('/')` | ✅ Routing is correct (resolves to `/scout` via `rootDestination`) — but the success screen's **copy is stale**: it says "A dedicated Scout dashboard ... is still being built." That's no longer true — `/scout` is a real, shipped dashboard now. |
| Association | `src/app/onboarding/association/page.tsx` (line ~204) | `router.push('/')` | ✅ Routing is correct (resolves to `/association`) — role is set to `'association'` at account creation, before Ops verification, so this isn't broken. See gating gap below though. |

**So there is exactly one real routing bug (Academy) and one stale-copy issue (Scout).** Everything else already routes correctly. Do not rebuild these onboarding flows — this is a targeted fix, not a redesign.

## Task 1 — Fix the Academy redirect bug

In `src/app/academy/onboarding/page.tsx`, change the "Go to Dashboard" button on the success screen from `router.push('/dashboard')` to `router.push('/')` (so it goes through `rootDestination` like every other role, rather than a second hardcoded path). Do the same for the "done ? 'Go to Dashboard'" label logic in the main footer button just above it if it also hardcodes `/dashboard` — check.

**Do not hardcode `/academy` directly either.** Use `router.push('/')` uniformly. Reasoning: `/` already centralizes role → route via `rootDestination()`. Routing through it is what prevented this exact class of bug on Scout and Association, and is what caused it on Academy. Prefer fixing the pattern, not just the symptom.

## Task 2 — Standardize all five onboarding completion redirects on the same pattern

While you're in these files: change Player's and Coach's completion redirects from their hardcoded `/record` and `/coach` to `router.push('/')` as well, for consistency, so `ROLE_HOME` in `chrome.ts` is the **only** place any of these five paths is ever written. This is a small, low-risk change (both already resolve to the same destination) that removes the entire bug class going forward — if `ROLE_HOME` ever changes, every onboarding flow updates automatically instead of silently drifting the way Academy just did.

Verify after the change that there's no visible flash of the marketing landing page before the redirect — `src/app/page.tsx` reads the session server-side and redirects before any client paint, so there shouldn't be, but confirm in a manual click-through.

## Task 3 — Fix the stale Scout success-screen copy

In `src/app/scout/onboarding/page.tsx`, the success screen currently says:

> "Your scout account is set up and your organization details are on file for review. A dedicated Scout dashboard for browsing opted-in players is still being built — this confirms your account is ready for when it ships."

with a button labeled "Back to AthlasX". Update this to reflect that the Scout dashboard is live:

- Headline can stay ("Account created.")
- Body copy: something like "Your scout account is set up and your organization details are on file for review. You can start browsing opted-in candidates now." (Adjust based on whether scout verification actually gates candidate visibility — see Task 4.)
- Button label: "Go to Scout Dashboard" or similar, still `router.push('/')`.

## Task 4 — Verify (don't assume) whether pending/unverified accounts need a gate on their own dashboard

This is a verify-then-fix-if-needed task, not a confirmed bug — investigate before changing anything.

Both Association and Scout onboarding write `verification_status: 'pending'` on account creation (confirmed in `src/app/api/associations/self-serve-onboard/route.ts` and referenced by comment in `src/app/api/scout/onboard/route.ts`), and both immediately set a session with a real role, so a brand-new, not-yet-approved account lands directly on the full `/association` or `/scout` dashboard with no indication anywhere that they're pending review.

Grep confirms neither `src/app/(dashboard)/association/page.tsx` nor the scout dashboard/API currently reads `verification_status` at all.

For each of Association and Scout:
1. Confirm what a brand-new pending account actually sees today on their dashboard — likely an empty state (no trial cycles / no candidates yet), which may be acceptable as-is if pending vs. verified doesn't otherwise change what data they can see.
2. If a pending account can already see or do something that should require verification (e.g., see other associations' data, or a scout seeing full candidate contact-adjacent details before their org is confirmed legitimate), add a lightweight pending-state banner at the top of the dashboard — reuse the existing `ax.*` token system (amber `accent` border/icon treatment, not a blocking modal) — something like "Your association/scout account is pending AthlasX Ops verification. You'll see full functionality once approved." Do not block the whole page unless a real data-exposure risk is confirmed; a banner is enough if the underlying data is already properly scoped.
3. Separately check Academy: its onboarding success copy also claims "pending verification," but no `verification_status` field was found being written in `src/app/api/academy/onboard/route.ts`. Find out where (or whether) academy verification is actually tracked, and either correct the onboarding copy if there's no real pending state, or apply the same banner treatment if there is.

## Task 5 — Manual QA (do this last, for all five roles)

For each role, run the onboarding flow to completion in dev and confirm:
- The final button/redirect lands on the role's real dashboard (`/record`, `/coach`, `/academy`, `/scout`, `/association`), not a 403, not `/dashboard` unless the role is genuinely `athlasx_ops`.
- No flash of the marketing landing page or a sign-in screen in between.
- Success-screen copy accurately describes what happens next (no more "still being built" claims for dashboards that exist).
- A pending/unverified account (Association, Scout, and Academy if applicable) sees accurate messaging about their status rather than either a false "fully live" impression or a broken/empty page with no explanation.

## Non-goals — do not do these

- Do not redesign or restyle any dashboard — that visual work is already done separately.
- Do not change `ROLE_HOME` or `rootDestination` itself — it's correct as-is.
- Do not build new approval/verification workflows for Ops — only make the existing pending state visible to the account holder if Task 4 finds a real gap.
- Do not touch `src/app/onboarding/association/page.tsx`'s non-self-serve gate (the "Sign-up isn't self-serve yet" screen for direct visitors) — that's separate, working as intended.
