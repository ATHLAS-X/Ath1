# AthlasX — Auth Security Fix Prompts

Run order: SEC-1 and SEC-2 first (no schema impact). SEC-3 next (external
dependency, no schema impact). SEC-4 and SEC-5 each need their own
migration reviewed and explicitly approved before applying — same gate as
the pending gender-column/academy_admin changes, don't bundle approvals.
SEC-5 (MFA) is the largest item in this batch; do it last and treat it as
its own checkpoint. SEC-6 is report-only.

## SEC-1 — CSRF on signup + timing-attack normalization on sign-in

```
Two independent hardening fixes on the credentials auth path:

1. CSRF on /api/auth/signup: this hand-rolled route currently relies only
   on sameSite:lax cookies, unlike NextAuth's own /api/auth/[...nextauth]
   which has built-in CSRF handling. Add a same-origin check before
   creating any account: verify the Origin header (fall back to Referer
   if Origin is absent) matches the app's own origin; reject with 403 if
   not. Don't build a separate CSRF token system if a same-origin check
   gives equivalent protection for this route's actual usage (no
   cross-origin form posts expected here).

2. Timing-attack normalization in authenticateWithPassword: it currently
   returns null before calling bcrypt.compare when the user doesn't
   exist, which is measurably faster than a wrong-password attempt (which
   does run bcrypt). Fix: always run bcrypt.compare against a fixed dummy
   hash when the user isn't found, before returning null, so both paths
   take comparable time. Generate that dummy hash once at module load
   (bcrypt.hashSync of a fixed value), not per request.

Write a regression test for each: a cross-origin POST to
/api/auth/signup gets rejected; response time for "no such user" vs
"wrong password" stays within a reasonable tolerance of each other
(assert they're close, e.g. within 20%, not an exact millisecond value —
avoid a flaky test).
```

## SEC-2 — Rate-limit hardening + failed-login alerting

```
Two additions to the existing rate-limiting:

1. Add a secondary IP-based rate-limit bucket alongside the existing
   per-email one on login (rateLimit('login-password', ...)). Key it by
   request IP — check how IP is already obtained elsewhere in this app
   (middleware/next.config.mjs) given how it's deployed behind any proxy,
   don't invent a new extraction method. Block if either the email bucket
   or the IP bucket is exceeded.

2. Add a log-based alert hook for repeated failed logins on one account
   (e.g. 5 failures in a window) — a structured log line something could
   eventually notify from, not a new notification channel in this pass.
   Do not build actual account lockout — explicitly out of scope here,
   this is throttling + visibility only.

Write tests: an IP failing logins across many different emails still
gets blocked once its own bucket is exceeded; the alert log line fires at
the failure threshold.
```

## SEC-3 — Breached-password check via HIBP k-anonymity API

```
Extend the hardcoded 19-entry common-password list with a real breach
check against Have I Been Pwned's k-anonymity range API (only a
5-character SHA-1 prefix leaves the server, never the plaintext password
— confirm this in the implementation, it's the entire privacy point of
that API). After the existing strength checks pass on signup, check
against this API; reject with the existing "too common" message if
found.

This adds an external network dependency to signup. Fail open: if the
API is unreachable or times out (short timeout, ~2s), fall back to the
existing hardcoded list rather than blocking signup on a third-party
outage. Keep the hardcoded list as the fallback, don't remove it.

Write a test mocking the HIBP call: one case where a password is flagged
as breached (rejected), one where the API times out (falls back to the
hardcoded list, an uncommon password still succeeds).
```

## SEC-4 — Password reset flow (new feature, needs a schema change)

```
No password-reset flow exists today. Build a token-based one:

1. New model for reset tokens: single-use, short TTL (~30 min), tied to a
   user id, stored as a hash of the token (not the token itself — same
   principle as password storage). Draft this as a migration, print it,
   do NOT apply it. Wait for an explicit go-ahead in a separate message
   before touching the live DB — same gate as every other schema change
   this engagement.
2. "Forgot password?" on /auth currently shows a toast saying this isn't
   wired up — replace with: user enters email, a reset token generates
   and would be emailed if the account exists. Respond identically
   whether or not the account exists (same principle as login's generic
   error).
3. Check first whether any email-sending infrastructure already exists
   in this codebase (nodemailer/Resend/SendGrid/etc.) before assuming
   there's nothing to reuse. Stub the actual send behind a clearly-named
   interface (e.g. sendPasswordResetEmail) that logs the reset link in
   development, so the flow is fully testable before a real email
   provider gets wired in as a separate step.
4. A reset link consumes its token exactly once, expires after the TTL,
   and lets the user set a new password subject to the same
   strength/breach checks as signup.

Write tests: token generated and consumed exactly once; expired token
rejected; reused token rejected; "forgot password" response is identical
for an existing vs non-existing email.
```

## SEC-5 — MFA/TOTP for privileged roles (largest item — do this last)

```
Largest item in this batch — new schema fields, new enrollment UI, a new
verification step in login, a recovery-code mechanism. Treat this as its
own checkpoint, not something to run in the same pass as SEC-1 through
SEC-4.

Add TOTP-based second-factor auth for athlasx_ops, association, and
academy_admin roles specifically — not player or coach, per the original
reasoning (the higher-privilege, non-player roles are worth the added
friction). Scope:
1. New fields: encrypted TOTP secret (not plaintext), a set of hashed
   single-use recovery codes, an enrollment-status flag. Draft as its own
   migration, print it, do not apply — same gate as everything else.
2. Enrollment: on first login after this ships (or from a settings page),
   a privileged-role user sets up TOTP (QR code + manual entry secret),
   confirms with one code, is shown recovery codes exactly once.
3. Login: after password auth succeeds for a privileged role with MFA
   enrolled, require a TOTP code before issuing the session. Player/coach
   logins are unaffected.
4. Recovery: a used recovery code allows one login and should prompt
   re-enrollment afterward.

Write tests: enrollment completes and a valid code authenticates; an
invalid/expired code is rejected; a recovery code works once then is
invalidated; player/coach login is unaffected (explicit regression
check, not assumed).
```

## SEC-6 — Verification-only items (report; fix only if something's actually wrong)

```
Three items to confirm, not build. Report back; fix only if you find a
real problem, don't change anything speculatively:

1. Grep the app for any client-supplied callbackUrl/next/redirect-style
   query param used near auth or anywhere else in the app. Confirm
   nothing accepts an unvalidated client-supplied URL for a post-auth
   redirect. Report every redirect-target source that isn't fully
   server-controlled.
2. Confirm verification-gate.ts (and any other role-gated route) checks
   the user's role against the database at request time, not just the
   JWT's stale role claim. Spot-check what happens when a role changes
   mid-session (e.g. a scout gets approved, a role gets revoked). Report
   exactly which routes trust the JWT claim directly vs re-check the DB.
3. Confirm the global CSP in next.config.mjs isn't relaxed further for
   /auth specifically, and that no inline <script> beyond Next's own
   hydration exists on that page.

Report as a table: item, current behavior, actual problem y/n.
```
