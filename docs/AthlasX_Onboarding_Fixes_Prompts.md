# AthlasX — Onboarding Fix Prompts (scroll layout, Aadhaar routing, Association OTP)

These three don't depend on the Academy/Association/Scout scope decisions
still pending — run them regardless of how those land. OF-2 does depend
on the pending migration decision (flagged inline).

## Prompt OF-0 — Show the actual diff and approval trail for the Aadhaar fix

```
For the aadhaar-verification.ts fix (verify()/consumeVerifiedAadhaar() map
mismatch) reported as done in the last verification pass: show me the
exact diff. Also state plainly where "your go-ahead" for this fix came
from — was I asked directly and did I approve it in this session, or did
you infer approval from the HP-6 prompt's scope? HP-6 authorized
verification only (tsc/build/tests/screenshots), not code changes. I want
the actual approval trail, not a restated summary that it was approved.
```

## Prompt OF-1 — Onboarding: left rail should not scroll with the page

```
Across every onboarding wizard that renders the StepRail/left nav panel
(Player, Coach, Academy — whichever currently use this two-column
layout), the left step-rail panel currently scrolls along with the
right-hand form content. Fix: the left rail should stay fixed/sticky at
the top of its own column height; only the right-hand content area
should scroll independently. Apply this consistently to every onboarding
flow using this layout — don't fix one and leave the others inconsistent.
Screenshot before/after at desktop width on at least two of the flows to
confirm the rail no longer moves with page scroll.
```

## Prompt OF-2 — Player: after Aadhaar verification succeeds, no fallback detour

```
In the player onboarding wizard's Aadhaar verification step, when
verification succeeds, do not route to any fallback/manual-verification
screen. On success, continue through the remaining onboarding steps as
already designed, and land the player on their dashboard (/record) once
onboarding completes — same as the existing "onboarding complete"
behavior, just skip the fallback detour when verification already
succeeded.

Note: this may still be blocked by the live DB schema drift already
reported (missing User.gender column) — /api/player/onboard 500s until
that migration is applied. If you hit that same 500 while testing this,
do not work around it by skipping the field, defaulting it, or catching
the error silently. Stop and report that this is still blocked on the
pending migration decision — fixing the routing doesn't help until that
lands.
```

## Prompt OF-3 — Association: investigate "Incorrect or expired OTP" before fixing

```
Association login/onboarding is showing "Incorrect or expired OTP" where
it shouldn't. Investigate before fixing — don't widen the expiry window
or add a silent retry as a first move. Check specifically:
1. Does this happen on the seeded test account (staff@upca.example)
   specifically — does the seed script's OTP path differ from the real
   signup OTP path?
2. Does the dev-mode inline-OTP-display show the exact same code the
   verification endpoint checks against? A mismatch between displayed
   and validated code would explain this precisely.
3. Is there a timing issue — the expiry clock starting server-side before
   the client even finishes fetching/rendering the code?

Report the actual OTP values and timestamps involved, not just "fixed
it" — given this same codebase just had a real map-mismatch bug in
aadhaar-verification.ts, I want root cause confirmed, not guessed at.
```
