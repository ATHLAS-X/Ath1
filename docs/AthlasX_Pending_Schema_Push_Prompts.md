# AthlasX — Pending Schema Push Prompts (AffiliatedAcademy, ConsentRecord, BcciAssociationReference)

All three are drafted/printed already per the last report, but "printed
in an earlier turn" isn't the same as "reviewed right before running" —
this prompt asks for one more fresh print immediately before anything
touches the live dev DB, consistent with how every other schema change
this engagement has been gated.

## PEND-1 — Review and push all three, in dependency order

```
Three schema changes are drafted but not applied: AffiliatedAcademy (+
AffiliatedAcademyStatus enum), ConsentRecord, and
BcciAssociationReference. Handle as one batch to minimize live-DB
touches:

1. Print all three schema definitions fresh, in full, in this response
   — actual field-by-field definitions, not a summary — so there's a
   final read immediately before anything runs.
2. Stop and wait for an explicit "push all three" (or a per-item
   breakdown) as a separate follow-up message before running
   prisma db push against the live dev DB.
3. Once approved, push in this order: BcciAssociationReference first
   (pure reference data, no dependencies on the other two), then
   AffiliatedAcademy (+ its enum), then ConsentRecord.
4. After BcciAssociationReference pushes successfully, run
   prisma/seed-bcci-associations.ts to populate the real 36-entry list.
5. After ConsentRecord pushes successfully, wire recordGuardianConsent()
   into /api/player/onboard's live submit flow — this was already part
   of MP-2's original scope (capture the record at the moment guardian
   consent completes, not inferred after the fact), so this isn't a new
   decision, it's finishing what that prompt already asked for.
6. Confirm the Association dashboard's affiliated-academies card renders
   real data instead of the graceful-failure error state, now that
   AffiliatedAcademy exists live.

Report pass/fail per step, and confirm explicitly whether
recordGuardianConsent() is now actually being called on real submits,
not just that the table exists.
```

## Not a prompt — two things that need you directly, not Claude Code

**Hero image (`p3` landing panel)**: the replacement trophy photo never
arrived as a real file — it kept coming through blank or as page
screenshots. This can't be fixed with a prompt; attach the actual image
file and I'll pass it through, or tell Claude Code directly once you
have it. Until then the Kohli/Rohit photo stays there, which is fine as
a placeholder, just don't forget it's still a placeholder.

**DigiLocker scope (player vs. guardian)**: based on the DPDP research
already done, this has a reasonably informed default — Rule 10's virtual-
token mechanism is specifically about verifying the *parent/guardian's*
identity and adulthood to back their consent. The player's own identity
verification is a separate concern (age/eligibility, not consent-giving)
and doesn't need the same "virtual token for consent" treatment. So the
likely right scope, once Surepass or an equivalent is actually chosen,
is: guardian gets the DigiLocker-token path, player keeps whatever
standard eKYC identity check the vendor provides. Worth confirming when
that vendor conversation concludes, not something to lock in now since
nothing is being built against it yet.
