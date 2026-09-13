# AthlasX — Onboarding Follow-up Fix Prompts

Covers the "still open" items from the onboarding test-case report, plus
two items I'm adding based on what that report surfaced: an independent
audit of Scout's minor-visibility restriction (it shipped without the
review I'd asked for), and hardening the association verification_status
column default at the schema level. AUDIT-1 should run before anything
else here — it's checking whether a safety-relevant claim is actually
true, not building something new.

## AUDIT-1 — Independently verify Scout's minor-visibility restriction

```
Scout onboarding is live (SCOUT_SELF_SERVE_ENABLED=true) with a design
that restricts scout visibility to adult players only, enforced in
player-visibility.ts via isAdult(dob), independent of
FRANCHISE_SCOUT_ENABLED. Before treating this as settled, verify it
independently rather than re-describing what the code appears to do:

1. Create one adult and one minor player profile (real test accounts,
   not fixtures that skip the actual code path). Log in as an approved
   scout. Attempt to reach the minor's data through every route/API a
   scout account can call — not just the one screen where the disclosure
   copy appears — including any search, list, or export endpoint. Confirm
   the minor is excluded everywhere, not just filtered from one view.
2. Check the boundary case: a player who turns 18 during an active trial
   cycle or between two scout page loads — confirm isAdult(dob) is
   computed fresh per request, not cached or computed once at profile
   creation.
3. Check whether any association- or academy-mediated path (a squad
   list, a trial-cycle roster, a coach's shared note) could expose a
   minor's identity or contact info to a scout account indirectly, even
   if the direct scout-facing endpoints correctly filter them out.
4. Confirm FRANCHISE_SCOUT_ENABLED's original (separate, older) gated
   code isn't a second, inconsistent scout-visibility path that could be
   reached some other way.

Report findings as: check performed, result, and explicit pass/fail —
this is a safety-relevant audit, not a status update. If anything in
items 1-4 shows a minor's data reachable through a scout account by any
path, stop and report it as a priority-one finding rather than folding
it into a routine report.
```

## FIX-1 — Resolve the player/coach dual account-creation paths

```
Player and Coach are the only two of five onboarding flows with two
independent, unreconciled account-creation paths: /auth's role picker
pre-creates a bare account + session before routing to the wizard, and
the wizard also collects email/password and creates its own account at
final submit. Academy, Scout, and Association don't have this problem —
their wizards are the sole account-creation path, /auth just routes to
them.

Recommended fix (confirm before proceeding, this changes /auth's
behavior): remove the bare-account pre-creation for Player and Coach on
/auth, so all five onboarding flows work the same way — /auth routes to
the wizard, the wizard is the only place an account gets created. This
is a consistency fix, not new functionality.

If you want a different resolution instead (e.g., keep the pre-creation
and make the wizards detect an existing session via useSession() and skip
their own email/password collection), stop and tell me rather than
picking a direction — this is a real behavior change to /auth either way.

Once resolved, update the P9/C9 tests written in the onboarding test
suite to assert the single, correct path instead of just reporting the
finding.
```

## FIX-2 — Stale JWT role claim on privilege change

```
A DB-level role change doesn't take effect until the session naturally
expires (up to 30 days) or the user re-authenticates — confirmed via
audit, not yet fixed. Fix: for privileged-role sessions specifically
(athlasx_ops, association, academy_admin, scout — not player/coach, to
avoid adding a DB check to every request across the whole app), re-check
the role against the database on each request via the same pattern
verification-gate.ts already uses elsewhere, and invalidate/refresh the
session if the DB role no longer matches the JWT claim.

Don't reduce the JWT maxAge as the fix — that degrades the session
experience for everyone to solve a problem that only affects five roles.
Scope the DB re-check narrowly to those roles.

Write a test: change a privileged user's role directly in the DB mid-
session, confirm their next request either gets the updated permissions
or is forced to re-authenticate — not left running on the stale claim.
```

## FIX-3 — Confirm CSRF on NextAuth's own credentials route

```
Lower priority — NextAuth's /api/auth/[...nextauth] should already have
built-in CSRF handling, separate from the hand-rolled signup/reset routes
that needed an explicit same-origin check. Confirm this is actually
active for the credentials provider specifically (some NextAuth
configurations can inadvertently disable or bypass it) rather than
assuming it's fine because it's framework-provided. Report confirmed or
report what's missing — don't change anything unless something's
actually off.
```

## FIX-4 — Small dead-UI batch (not security-critical, safe to fix now)

```
Three small, independent UI bugs, safe to fix without further review:

1. Login double-click fires 2 requests — add a re-entrancy guard
   (disable the button / ignore a second submit while one is in flight),
   same pattern likely already used elsewhere in the codebase for this.
2. <Toaster/> is never mounted, so the "Google sign-in isn't connected
   yet" toast (and any other toast in the app) is silently dead — mount
   it at the appropriate layout root.
3. The landing page's "Signup" link doesn't pre-select the Sign Up tab
   on /auth — pass through whatever query param or route state /auth
   already uses to determine initial tab/mode.

Write a quick regression test for each (or extend the existing landing/
auth tests) confirming the fix. These are independent of each other and
of everything else in this batch — fix all three in one pass, no
sequencing concerns.
```

## FIX-5 — Harden association verification_status at the schema level

```
The self-serve association route explicitly sets verification_status to
'pending' on insert, but the column's own database-level default is
'approved' — confirmed by direct-insert testing in the AS5 test case.
Any future insert path that forgets to override this default would
silently create a pre-approved association. Fix at the schema level:
change the column's default to 'pending' (or make it NOT NULL with no
default, forcing every insert path to be explicit) so this can't
silently happen again regardless of which code path creates the row.

Draft this as its own migration, print it, do NOT apply — same gate as
every other schema change this engagement. Confirm what currently reads
or depends on the 'approved' default anywhere else in the codebase
before proposing the new default, so this doesn't break an existing
assumption elsewhere. Wait for an explicit go-ahead before touching the
live DB.
```
