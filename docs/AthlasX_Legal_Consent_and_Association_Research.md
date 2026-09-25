# AthlasX — Consent/Minor-Data Legal Research + Association Reference Data

## DPDP Act 2023 / DPDP Rules 2025 — what actually applies

Source of truth: DPDP Rules 2025 were notified in November 2025. Consent
Manager registration is expected to open November 2026. Substantive
obligations — including every child-data provision below — become
enforceable **May 14, 2027**. There's runway, but AthlasX already
collects minors' data live today (Association and Scout are both
already enabled), so building toward this now rather than at the
deadline is the right call, not just caution for its own sake.

### Rule 10 — verifiable parental consent

A Data Fiduciary must obtain "verifiable consent of the parent" before
processing a child's (under-18) personal data, via one of three
mechanisms:

1. Reliable existing identity/age details already held by the platform.
2. Information voluntarily provided by whoever claims to be the parent.
3. A **virtual token** issued by an authorized entity (a government
   body, an entity it appoints, or a Digital Locker Service Provider)
   mapped to identity and age — in practice, a **DigiLocker token linked
   to Aadhaar**. This is the mechanism the rule actually illustrates in
   detail, and it's the one that gives a real compliance-grade
   attestation: the parent authenticates separately and the platform
   gets an encrypted "yes, this is a verified adult" without ever
   touching the parent's raw ID documents.

Fourth Schedule exemptions exist for certain fiduciary classes/purposes
but weren't detailed in what I could pull — don't assume AthlasX
qualifies for one without checking specifically.

### The hard constraint, not just a consent checkbox

Behavioral monitoring and targeted advertising directed at anyone under
18 are **prohibited outright** — this isn't satisfied by getting
consent, it's a flat ban. Any analytics/tracking AthlasX runs needs to
structurally exclude minor player accounts from behavioral profiling or
ad-targeting datasets, not just get a checkbox first.

### What this means concretely for AthlasX right now

- The existing "guardian AadhaarBlock, separate from the player's own"
  pattern (confirmed in the P13 test case) is structurally the right
  shape — Rule 10 is about verifying the **parent**, distinct from the
  child. But today both blocks run through the same dev-mode Aadhaar
  stub, which gives you the right shape with none of the actual
  verification weight the rule wants.
- The real compliant version of this is the DigiLocker/Aadhaar
  virtual-token path — which depends on a real eKYC vendor. This is a
  second, concrete reason (beyond "we need real verification at all")
  to finish the Surepass conversation, not just a nice-to-have.
- Consent needs to be demonstrable after the fact — a checkbox with no
  record of what text was shown, when, or to whom doesn't hold up if
  you ever need to prove what a guardian actually agreed to. This
  implies a real consent-audit record, not just a boolean flag.

## BCCI-affiliated state/UT cricket associations (current, verified)

36 full/associate members, by state/UT — use this as reference data for
association names, not as a source of academy affiliations (see below):

Andhra Pradesh (Andhra Cricket Association), Arunachal Pradesh (Arunachal
Cricket Association), Assam (Assam Cricket Association), Bihar (Bihar
Cricket Association), Chhattisgarh (Chhattisgarh State Cricket Sangh),
Delhi (Delhi & District Cricket Association), Goa (Goa Cricket
Association), Gujarat (Gujarat Cricket Association, Baroda Cricket
Association, Saurashtra Cricket Association), Haryana (Haryana Cricket
Association), Himachal Pradesh (Himachal Pradesh Cricket Association),
Jammu & Kashmir (Jammu & Kashmir Cricket Association), Jharkhand
(Jharkhand State Cricket Association), Karnataka (Karnataka State
Cricket Association), Kerala (Kerala Cricket Association), Madhya
Pradesh (Madhya Pradesh Cricket Association), Maharashtra (Maharashtra
Cricket Association, Mumbai Cricket Association, Vidarbha Cricket
Association), Manipur (Manipur Cricket Association), Meghalaya
(Meghalaya Cricket Association), Mizoram (Cricket Association of
Mizoram), Nagaland (Nagaland Cricket Association), Odisha (Odisha
Cricket Association), Punjab (Punjab Cricket Association), Rajasthan
(Rajasthan Cricket Association), Sikkim (Sikkim Cricket Association),
Tamil Nadu (Tamil Nadu Cricket Association), Telangana (Hyderabad
Cricket Association), Tripura (Tripura Cricket Association), Uttar
Pradesh (Uttar Pradesh Cricket Association), Uttarakhand (Cricket
Association of Uttarakhand), West Bengal (Cricket Association of
Bengal), plus Union Territory Cricket Association—Chandigarh, Cricket
Association of Pondicherry, Railways Sports Promotion Board, Services
Sports Control Board.

## Academy-to-association affiliation — the honest finding

There is no structured, authoritative public directory mapping specific
cricket academies to the association they're affiliated with. The one
page that looked like it might be this turned out to contain zero
academy data and a factual error in its first claim (misplacing a
stadium's state). Academy-level affiliation in India is fragmented,
locally known, and not centrally published — scraping this would produce
confident-looking wrong data, which is worse than no data.

**Recommendation**: don't build a pre-populated academy-association
database from web research. Build (or finish — this may already be
partway there in the Association dashboard) a feature where each
association self-reports and manages its own list of affiliated
academies. Seed only the association side with the real 36-entry list
above so association names match reality; academy affiliations get
populated by the associations themselves as they onboard.

## Sources

- [Rule 10 of Digital Personal Data Protection Act, 2023 DPDP Rules 2025](https://www.dpdpa.com/dpdparules/rule10.html)
- [India's DPDP Rules Draw the Line at 18: Age Verification and Verifiable Parental Consent Before May 2027](https://xident.io/blog/india-dpdp-age-verification-verifiable-parental-consent-childrens-data-2026/)
- [DPDP Rules, 2025 Notified (PIB)](https://static.pib.gov.in/WriteReadData/specificdocs/documents/2025/nov/doc20251117695301.pdf)
- [Digital Personal Data Protection Rules, 2025 (Wikipedia)](https://en.wikipedia.org/wiki/Digital_Personal_Data_Protection_Rules,_2025)
- [DPDP Rules and the Future of Child Data Safety (ORF)](https://www.orfonline.org/expert-speak/dpdp-rules-and-the-future-of-child-data-safety)
- [Parental Consent: DPDP Law on Children's Data](https://www.consent.in/blog/child-consent)
- [Child Data Protection Under DPDP Act: Parental Consent Rules](https://ksandk.com/data-protection-and-data-privacy/child-data-protection-under-dpdp-act-parental-consent-rules/)
- [List of member associations of the BCCI (Wikipedia)](https://en.wikipedia.org/wiki/List_of_member_associations_of_the_BCCI)
- [State Association Membership Details (BCCI)](https://www.bcci.tv/details-of-membership)
