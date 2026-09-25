# AthlasX — DigiLocker/Aadhaar Virtual-Token Verification: Dependency Map

Analysis only — nothing in this document has been built. It maps what would
need to change to replace today's dev-mode Aadhaar OTP stub with a real
DPDP Rule 10-compliant verification path, once a real eKYC vendor (Surepass
or an equivalent) is actually integrated. That integration is **not
confirmed** — this is scoped as a dependency map for when it is, not a
build plan for now.

## 1. What exists today

`src/lib/aadhaar-verification.ts` already uses a pluggable-provider registry
(mirroring `src/lib/ingest/registry.ts`'s shape): one interface
(`AadhaarVerificationProvider`), one registered key (`dev_stub`), swappable
in principle. The stub behaves like a phone-OTP flow — generate a 6-digit
code, return it directly to the client (marked "Dev mode — no eKYC vendor
connected"), verify it against a hash. This is used identically for both
the player's own identity check and the guardian's, in
`src/app/player/onboarding/page.tsx`'s Stage 2 (`AadhaarBlock`, called
twice with `subject: 'player'` / `subject: 'guardian'`).

**The registry shape is the right foundation.** The gap is that
`dev_stub` is the only implementation, and it provides no real
verification weight — no vendor ever confirms the Aadhaar number is real,
matches the person, or matches the claimed relationship to a minor.

## 2. What Rule 10's virtual-token path actually requires

Rule 10 names a virtual token, issued by an authorized entity (a
government body, its appointee, or a Digital Locker Service Provider),
mapped to identity and age — in practice, a DigiLocker token linked to
Aadhaar. The platform never touches the parent's raw ID documents; the
parent authenticates directly with DigiLocker (or the vendor's hosted
flow), and the platform receives back an encrypted attestation.

This is structurally a **redirect/consent flow**, not an inline
number-and-OTP form:

1. App requests a DigiLocker consent URL from the vendor (Surepass or
   equivalent), scoped to "verify this person is an adult and get a
   token."
2. User leaves the app, authenticates with DigiLocker on DigiLocker's own
   domain (their credentials, their OTP — AthlasX never sees them).
3. DigiLocker redirects back to an AthlasX callback URL with an
   authorization code.
4. AthlasX exchanges that code with the vendor's API for the actual
   token/attestation and stores only what Rule 10 needs to keep
   (verification status + a reference, never the raw document).

## 3. Concrete changes this would require

**New provider implementation**
- Add `'digilocker_token'` to `AadhaarProviderKey` in
  `src/lib/aadhaar-verification.ts`.
- Its `initiate()` doesn't generate an OTP — it calls the vendor's API to
  get a consent/redirect URL and returns that instead of `devCode`.
- Its `verify()` doesn't check an OTP hash — it's invoked by a callback
  route after the redirect, exchanging the vendor's authorization code for
  a verified/not-verified result.

**New route**
- A callback endpoint (e.g. `/api/onboarding/aadhaar/digilocker/callback`)
  to receive the redirect from DigiLocker/the vendor and complete
  verification server-side. Nothing like this exists today — the current
  flow never leaves the wizard's own page.

**UI change — not just a swapped provider under the same UI**
- `AadhaarBlock` (`src/app/player/onboarding/page.tsx`) is built around an
  inline number input + OTP input. A DigiLocker flow needs a
  "Verify via DigiLocker" button that navigates away and back, a
  loading/pending state across that round trip, and handling for the user
  abandoning the redirect (closing the tab, denying consent on
  DigiLocker's side, etc.) — states the current stub has no reason to
  handle because it never leaves the page.
- The onboarding wizard's localStorage-based progress-save
  (`saveProgress`/`loadProgress`) would need to survive a full page
  navigation away and back, not just tab-switch/refresh — worth checking
  this actually round-trips correctly today before relying on it for a
  multi-domain redirect.

**Env/config**
- Vendor API key/secret, redirect URI allowlisted with the vendor, and
  (per this codebase's existing pattern of never hardcoding secrets) new
  entries in `.env.example`/`.env.local` — none of which exist yet since
  no vendor contract is signed.

**Consent-record linkage (see the ConsentRecord draft in
`prisma/schema.prisma`, not yet applied)**
- `ConsentRecord.verification_method` is already a plain string (not a
  hardcoded enum), specifically so `'digilocker_token'` can be written
  there without a schema change.
- Worth deciding *before* building: does DigiLocker's own consent screen
  (shown on their domain) substitute for AthlasX's own consent copy, or
  does AthlasX still show its Stage 3 `ConsentPanel` text first and then
  layer the DigiLocker token on top as the verification backing it? Rule
  10's three mechanisms are about verifying *who the parent is*, not
  about what they're told they're consenting to on AthlasX's platform —
  the two are related but distinct, and the current draft schema doesn't
  yet have a field for a vendor-side reference ID (e.g. DigiLocker's own
  transaction ID) if that turns out to be needed for audit purposes.

**Player vs. guardian scope**
- Rule 10's virtual-token path is about verifying the *parent's* identity
  and age. It's less clear this is the right mechanism for the *player's*
  own identity check (a minor may not have their own DigiLocker account
  in the same way) — this document does not resolve that; it's a real
  product question to answer before building, not something to default
  on silently.

## 4. What this document deliberately does not do

- It does not assume Surepass is the chosen vendor — per the research
  brief, that conversation isn't finished.
- It does not modify `src/lib/aadhaar-verification.ts`, the onboarding
  wizard, or the ConsentRecord draft beyond what's already been printed
  elsewhere in this pass.
- It does not estimate effort/timeline — that depends on which vendor is
  chosen and what their actual API/consent-flow shape is, which isn't
  known yet.
