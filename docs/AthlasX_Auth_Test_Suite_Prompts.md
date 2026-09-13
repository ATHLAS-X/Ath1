# AthlasX — Auth & Landing Page Test Suite Prompts

Covers all 41 test cases (L1-L7, A1-A34) as real automated tests added to
the suite, not a one-time manual pass. A3, A20, and A33 get reported as
findings, not silently written as passing tests — turning a real
decision or a known dead-code/dead-link issue into a green checkmark
would bury it.

## TEST-1 — Landing page suite (L1-L7)

```
New Playwright spec, tests/e2e/landing.spec.ts:

L1: visit / signed out — HeroLanding renders with Sign In / Signup links.
L2: visit / while signed in as each role — confirm the server-redirect to
    rootDestination(session) happens before hero content renders (check
    the response, not just final DOM, to catch a flash-of-wrong-content
    bug).
L3: click Sign In / Signup — both navigate to /auth. Also assert whether
    Signup pre-selects the signup tab. If it doesn't, this test should
    FAIL with a comment flagging it as the known UX gap — don't mark it
    expected-to-fail silently, the failure itself is the record that the
    gap still exists.
L4: forge/expire a session cookie, confirm hero renders, no crash.
L5: block image requests (Playwright route interception), confirm the
    photo grid still renders with alt text present on every tile.
L6: keyboard-only Tab navigation reaches Sign In and Signup with a
    visible focus state.
L7: mobile viewport (< lg breakpoint) — confirm no overflow, report
    whether the hero collage has any responsive fallback at all.

Run and report pass/fail per case.
```

## TEST-2 — Auth page: tabs and sign-in (A1-A15)

```
New Playwright spec, tests/e2e/auth-signin.spec.ts:

A1: default load (mode=signin, role=player, Sign In tab aria-selected=true).
A2: switch to Sign Up, error clears.
A3: switch tabs mid-typing — confirm email/password state persists across
    the switch. Report this as a finding, don't just assert it as
    correct — flag whether shared state between sign-in/signup forms
    looks intentional or like a data-leak risk between roles; that's a
    decision, not a test result.
A4: valid credentials → redirect lands on role home.
A5: wrong password → generic error.
A6: non-existent email → same generic error; note response timing
    relative to A5 (ties to SEC-1's timing fix — this test should pass
    whether or not that fix has landed, but flag if timing looks
    meaningfully different).
A7: empty submit blocked client-side; also hit the API directly with an
    empty body to confirm server-side rejection independent of the UI.
A8: 11th login attempt in 15 min for one email → confirm the generic
    failure message stays generic (not a distinct "too many attempts") —
    report if it differs, since that would leak rate-limit state.
A9: rapid double-click submit — confirm no duplicate signIn calls fire
    (check actual network requests, not just UI state).
A10: mixed-case/whitespace email normalizes and matches.
A11: SQL/NoSQL injection string in email field → safe no-match, no 500.
A12: XSS payload in email field → no unescaped reflection anywhere in the
     response HTML.
A13: "Remember me" checkbox is cosmetic only (doesn't change session
     maxAge) — report as a known gap, don't fix it in this prompt.
A14: "Forgot password?" — confirm current toast behavior; once SEC-4
     lands, update this test for the real flow (leave a TODO comment
     linking the two so it isn't forgotten).
A15: successful sign-in redirect chain accepts no callbackUrl or similar
     query param anywhere in it (ties to SEC-6 item 1).

Run and report pass/fail per case, with A3 and A13 called out separately
as decisions, not just results.
```

## TEST-3 — Auth page: sign-up role picker + inline form (A16-A34)

```
New Playwright spec (tests/e2e/auth-signup.spec.ts) plus direct API-level
tests where a case is really about server-side validation:

A16: select Association → routes to /onboarding/association; confirm via
     DB/API side-effect check (not just the redirect) that no bare
     account gets created.
A17: select Academy → routes to /academy/onboarding regardless of the
     flag; destination shows its own not-available state when off.
A18: select Scout → routes to /scout/onboarding.
A19: select Player or Coach → reveals inline form.
A20: don't write this as a passing test — add a comment confirming
     roleUnavailable is hardcoded false (dead code, this branch can never
     render) and report it as a finding.
A21: password < 10 chars blocked client-side AND server-side (hit the API
     directly for the server check).
A22: letters-only or digits-only password → server 400 with the specific
     message.
A23: common passwords → server 400, confirm case-insensitive match.
A24: valid strong password → account created, session set, redirect to
     ROLE_WIZARD_PATH[role].
A25: duplicate email → server 409, confirm it's actually Prisma P2002
     being caught, not a generic catch-all.
A26: malformed JSON body direct to the API → 400 "Invalid JSON".
A27: a role not in SIGNUP_ROLES posted directly to the API → 400,
     confirms API-level defense independent of the UI.
A28: academy role posted while the flag is off → 400, confirms the
     server re-checks the flag, not just the UI.
A29: 6th signup attempt for one email within an hour → 429.
A30: signup password field has autoComplete="new-password".
A31: simulate a network failure during signup fetch → generic error
     shown, submit button re-enabled.
A32: "Continue with Google" → toast only, no request fired.
A33: don't write this as a passing test — confirm Terms/Privacy links are
     href="#" and report as a known gap, don't fix silently.
A34: mode toggle switches without navigating.

Run and report pass/fail per case. A20 and A33 come back as explicit
findings in the report, not quietly-passing tests.
```
