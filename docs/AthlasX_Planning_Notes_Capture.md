# AthlasX — Planning Notes Capture (organized, 2026-09-20)

Raw notes organized by area, sorted into: already built, blocked on
something outside code, and genuinely new decisions needed. Nothing here
became a Claude Code prompt yet — most of it isn't actionable as code
work until something outside this codebase resolves first.

## Auth & identity verification

- Proposed flow (email signup → OTP via Surepass → Aadhaar verification
  → OTP → register) describes real eKYC integration. **Blocked**: Surepass
  isn't integrated yet — you're reaching out to someone about it. Nothing
  to build until that's confirmed; current Aadhaar verification stays a
  documented dev-mode stub until then.
- Real Google Sign-In — currently dead (a toast that doesn't even show,
  per the earlier `<Toaster/>` finding). Needs a real OAuth app in Google
  Cloud Console (client ID/secret) — you provision this, same category as
  the DB password and the MFA encryption key.
- Terms & Privacy Policy links — dead (`href="#"`) until real legal
  documents exist.
- Digital signature for consent — **not built**. Current consent is
  checkbox-based (scroll-to-unlock), not an actual signature capture.
  Open scope, no prompt written yet.
- Already built and working: manual ops-approval for Academy/Association,
  Scout role selector on signup, 10-character password minimum, scrollable
  consent panels.

## Admin & security

- "Supreme admin DB — all read/write operations" — reads like an
  unscoped superuser role. **Needs a decision before any prompt**: what
  is it actually for (support, debugging, ops overrides), who holds it,
  is it a real UI or direct DB access, and how does it relate to the
  MFA-for-privileged-roles work already planned? An unrestricted
  all-access role is one of the highest-risk additions to a platform
  holding minors' data — define the actual operations it needs before
  it gets built as "everything."
- "Backend jumps" / "security flaws" — too vague to act on as written;
  if these point at specific findings, they need to come from you or a
  named audit, not guessed at from two words.

## Infrastructure

- Deployment: Vercel — confirmed this session, see the separate
  serverless-audit prompts (SERV-1/SERV-2).
- Agile mode + continuous CI/CD — worth its own deploy-checklist/CI setup
  pass, but premature before the serverless audit resolves; no point
  building a pipeline around an architecture that isn't confirmed
  serverless-safe yet.
- Dummy data for demos — already the existing convention (realistic
  non-lorem-ipsum names used throughout this engagement's mockups/tests).

## Landing page

- Replace AI-generated hero photos with real photos or commissioned
  cartoon/illustrated art — an asset decision, not a code change. Needs
  the actual photos or artwork before anything can be swapped in.

## Domain/data-model research (not yet actionable — these are research
items you flagged, not specs)

- Cricket academy ↔ association affiliation at state/district level —
  research.
- Which academies are affiliated with which association — a real data
  relationship that may need schema modeling once the research above
  lands, but noted as research, not a spec.
- Association affiliation and contact info — same.
- Parent/guardian consent legal requirements ("action items to be
  searched") — legal research, likely DPDP Act specifics for minors'
  data in India. Not something to guess at in a prompt.
- "Legal concerns" — unspecified; needs your input once identified.
- Primary bowling style — likely already covered by the existing player
  field inventory; P8 in the onboarding test suite already checks
  required-vs-optional fields at this level of detail.

## Naming

- "Scoutflix" — appears as a name, not used anywhere else in this
  engagement. Flag if this renames the Scout-facing product surface
  specifically, or is just a working title.
- "Lightweight for association" — matches the existing design already
  (Association dashboard is read-only with one write action).

## Bottom line

Nothing in this note set is ready to become a Claude Code prompt except
the serverless audit (separate doc) — everything else is either already
built, blocked on an external step, or needs a scoping decision from you
first (supreme admin DB and digital signature being the two real ones).
