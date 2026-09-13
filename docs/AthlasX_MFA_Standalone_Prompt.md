# AthlasX — MFA/TOTP Standalone Prompt (SEC-5, finalized)

Its own checkpoint — do not run alongside the other SEC prompts or in the
same sitting as anything DB-related. This finalizes three things left
underspecified in the earlier version: encryption key handling, which
library to use, and recovery-code count. Enrollment is mandatory
immediately on ship — confirmed, not a grace-period rollout.

```
Add TOTP-based second-factor auth for athlasx_ops, association, and
academy_admin roles specifically — not player or coach. Enrollment is
MANDATORY immediately: a privileged-role session cannot reach any
dashboard or API route until MFA is enrolled. No grace period, no skip
option.

Schema (draft as its own migration, print it, do NOT apply — same gate
as every other schema change this engagement; wait for an explicit
go-ahead before touching the live DB):
- TOTP secret field on User (or a dedicated MfaEnrollment model if that
  fits the schema better) — encrypted at rest with AES-256-GCM. Read the
  encryption key from a new env var, MFA_ENCRYPTION_KEY — do not generate
  or hardcode a key yourself. If it's missing at startup, fail loudly in
  development (clear error) rather than silently running unencrypted or
  falling back to a default key.
- 10 single-use recovery codes per enrollment, each hashed with bcrypt
  (same treatment as passwords — never store them in plaintext or
  reversibly encrypted).
- An enrollment-status flag (enrolled / not-enrolled) checked on every
  privileged-role session.

Library: use a standard RFC 6238-compliant TOTP library (e.g. otpauth or
speakeasy) plus a QR-code generator (e.g. qrcode) — do not hand-roll TOTP
math. Use whichever pairing has better-maintained, actively-published npm
packages at the time of implementation.

Enrollment flow:
1. On first login after this ships (or from a settings page for existing
   sessions), a privileged-role user without MFA enrolled is routed to a
   mandatory enrollment screen — no way to reach anything else first.
2. Show a QR code (scannable by any standard authenticator app) plus the
   manual-entry secret as a fallback for users who can't scan.
3. User confirms with one valid code to complete enrollment.
4. Show the 10 recovery codes exactly once, with clear copy that they
   won't be shown again — this is a one-time reveal, not something
   retrievable later from account settings.

Login flow:
1. After password auth succeeds for a privileged role with MFA already
   enrolled, require a valid TOTP code before issuing the session.
2. Player and coach logins are completely unaffected — verify this
   explicitly, don't just assume the role check is correct.

Recovery flow:
1. A valid recovery code authenticates once and is then invalidated
   (marked used, cannot be reused).
2. After a recovery-code login, prompt the user to re-enroll TOTP before
   they can do anything else — a spent recovery code should not leave
   the account in a state with zero remaining second factors indefinitely.

Tests to write:
- Enrollment completes and a valid TOTP code authenticates.
- An invalid or expired code is rejected.
- A recovery code authenticates exactly once, then a second attempt with
  the same code fails.
- After a recovery-code login, the user is routed to re-enrollment before
  reaching anything else.
- Player and coach login flows are unaffected — an explicit regression
  test, not an assumption.
- Missing MFA_ENCRYPTION_KEY at startup fails loudly rather than running
  unencrypted.
```

## Before running this

You'll need to generate and provision `MFA_ENCRYPTION_KEY` yourself in
whatever secret store this deploys with — same category as never guessing
DB credentials, I'm not generating that value here. A 32-byte
cryptographically random value, base64 or hex encoded, is standard for
AES-256-GCM.
