# AthlasX — Consent Rewrite + Minor/Guardian Separation Master Prompts

Grounded in real DPDP Rule 10 research (docs/AthlasX_Legal_Consent_and_Association_Research.md)
— not guessed-at legal content. MP-2's schema change follows the
standard gate: draft, print, wait for explicit go-ahead. MP-2's
DigiLocker-token verification itself is explicitly NOT in scope here —
that depends on the still-pending Surepass integration; this batch
builds the compliance-ready shape around whatever verification method is
active today, real or stub.

## MP-1 — Rewrite consent content to match DPDP Rule 10

```
Rewrite every consent-facing text block in the app (guardian DPDP
consent panel, the 4 scrollable consent panels in player onboarding
Stage 3, any equivalent in coach/academy/scout/association onboarding)
to actually reflect DPDP Rule 10's requirements, not generic
boilerplate:

1. State plainly that this is a parent/guardian consenting to a minor's
   data being processed — not the minor consenting for themselves.
2. Name what data is collected about the minor and why (playing stats,
   Aadhaar-verified identity, contact info) — purpose-specific, not a
   blanket "we may use your data" clause.
3. State explicitly that the minor's data will NOT be used for
   behavioral monitoring or targeted advertising — this is a legal
   prohibition, not a privacy nicety, say it as a hard commitment.
4. State how consent can be withdrawn and what happens to the minor's
   data if it is (this is a real DPDP right, not optional copy).
5. Distinguish clearly, in the copy itself, between what's being
   verified about the PLAYER (identity, age) and what's being verified
   about the PARENT/GUARDIAN (identity, relationship, authority to
   consent) — these are two different attestations and the current
   copy doesn't visually or textually separate them.

This is a content and copy change on existing consent panels — don't
change the underlying consent-capture mechanism (checkbox +
scroll-to-unlock) in this prompt, that's MP-2.
```

## MP-2 — Formalize the player/guardian separation with an auditable consent record

```
Today, minor onboarding runs two independent Aadhaar verification
blocks (player's own, guardian's) through the same dev-mode stub — the
right shape, but with no record of what was actually consented to, and
no real verification weight behind the guardian side.

Schema change (draft as its own migration, print it, do NOT apply —
same gate as every other schema change this engagement; wait for an
explicit go-ahead before touching the live DB):
1. A ConsentRecord model: which guardian (linked to the specific
   minor's profile, not just a free-text name), which consent text
   version was shown (store a version identifier or hash of the
   rewritten MP-1 copy, not just "consented: true"), timestamp, and
   which verification method backed it (today: dev-stub Aadhaar OTP;
   future: DigiLocker token, once Surepass or an equivalent is
   integrated — build the field to accept either, don't hardcode to the
   stub).
2. This record is written at the moment guardian consent completes in
   the onboarding wizard, not inferred after the fact.

Application changes:
1. Make the UI-level separation between player-identity-verification and
   guardian-consent-verification visually and structurally distinct
   (separate sections, separate headers, not just two AadhaarBlock
   components that look identical) — a reviewer or auditor should be
   able to tell at a glance which block verified whom and for what
   purpose.
2. Report explicitly, don't fix in this pass: exactly what would need to
   change to swap the stub verification for a real DigiLocker/Aadhaar
   virtual-token flow once Surepass (or an equivalent vendor) is
   integrated — this is a dependency map, not a build, since that
   integration isn't confirmed yet.

Write a test: guardian consent completion creates a ConsentRecord with
the correct minor/guardian link, text version, and timestamp; the
record is queryable independent of the player's own verification record.
```

## MP-3 — Audit and exclude minors from behavioral tracking / ad targeting

```
DPDP Rule 10's constraint here is absolute, not consent-gated: no
behavioral monitoring or targeted advertising toward anyone under 18.

Audit every analytics/tracking integration in the app (any client-side
analytics script, any event-logging pipeline, any place player behavior
gets recorded beyond the cricket stats themselves) and report: what's
collected, whether it's currently scoped by age, and whether a minor's
browsing/usage behavior could end up in a dataset used for targeting or
profiling. Do not fix anything in this pass if nothing analytics-wise
currently exists beyond basic error/request logging — report "nothing
found" as a real, useful answer if that's the truth, don't manufacture
findings.

If something is found, stop and report it rather than silently
excluding minors from it — this may need a product decision about
whether the feature itself should exist at all for any user, not just a
scoping fix.
```

## MP-4 — Association-managed academy affiliation (self-serve, not scraped)

```
There is no reliable external source mapping academies to associations
— confirmed by research, don't attempt to import or scrape one. Build
this as a feature associations manage themselves:

1. Seed a reference table of the 36 real BCCI-affiliated state/UT
   cricket associations (list in
   docs/AthlasX_Legal_Consent_and_Association_Research.md) so association
   names in the system match real entities — this is reference/lookup
   data, draft as a migration + seed script, print it, do not apply
   without the standard go-ahead.
2. On the Association dashboard, add (or extend, if something partial
   already exists — check first) a section where an association can
   list and manage which academies are affiliated with them: academy
   name, contact info, affiliation status. This is association-entered
   data, not verified against any external source — label it as
   self-reported in the UI copy, don't imply it's independently verified.
3. This does NOT need to block on or relate to Academy's own
   self-serve onboarding (ACADEMY_SELF_SERVE_ENABLED) — an academy
   doesn't need its own AthlasX account to be listed as affiliated by an
   association; this is the association's own record-keeping.

Write a test: an association adds an affiliated academy entry, it shows
up on that association's dashboard, and is scoped correctly (one
association can't see or edit another's affiliated-academy list).
```
