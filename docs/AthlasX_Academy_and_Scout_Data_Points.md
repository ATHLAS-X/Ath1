# AthlasX — Academy & Scout Data Points (High / Medium / Low)

Academy points are sourced from `docs/AthlasX_Master_Data_Points.docx`
("Hritvik's Academy Registration Checklist" × "Team Expanded Data Points"),
re-tiered from that doc's original four-tier system (HIGH / MED / LIKELY /
LOW) into the three tiers requested here: **HIGH** and **MEDIUM** stay as
the source doc has them; **LIKELY** and **LOW** are merged into **LOW**,
since both are "collect opportunistically / post-onboarding, never block"
in the source doc's own language — the distinction between them was about
sequencing, not importance, so collapsing them loses no real signal.

Every Academy row also carries an **Implemented?** column — checked
directly against `prisma/schema.prisma` and the current 3-step onboarding
wizard (`src/app/academy/onboarding/page.tsx`) as of this session, not
assumed from the doc. Three states: **Persisted** (collected in the wizard
and saved to a real column), **Schema only** (a column exists but nothing
collects it), and **Not built** (no column, no field, anywhere).

Scout has no source document — nothing in this repo addressed Scout data
points before this session. The table below is a first-pass draft built
from what was actually implemented this session (`ScoutProfile` in
`prisma/schema.prisma`) plus reasonable extensions, held to the same
Why/How/Notes discipline as the Academy doc. Treat it as a starting point
for review, not settled fact — nobody has field-tested what a scout
actually needs the way Hritvik's checklist did for academies.

---

## 1. Academy Data Points

### HIGH — core, collect at onboarding

| Data Point | Why Collect It | How to Collect | Implemented? |
|---|---|---|---|
| Academy Name | Primary identifier every record anchors to | Text, title-case, validate uniqueness | **Persisted** (Step 2) |
| City / District / State | First filter scouts use; District maps to DCA | State dropdown, District filtered dropdown, City autocomplete | **Persisted** (Step 2) |
| Year Established | Proxy for track record; credibility signal | Year picker | **Persisted** (Step 2) |
| Academy Type | Different budget/decision-maker per type — determines sales motion | Single-select: Private / Government / Trust-NGO / Sports Club | **Persisted** (Step 2) |
| Primary Contact Name + Designation | Who AthlasX actually talks to — often not the head coach | Two text fields | **Persisted** (Step 2) |
| Mobile Number (WhatsApp) | Invite dispatch, OTP, support channel | Phone + OTP verify | **Persisted** (Step 1, on the admin's User row) |
| Official Email | Login, formal comms, account recovery | Email input | **Persisted** (Step 1, on the admin's User row) |
| BCCI Affiliation (+ ID) | Verification credibility signal | Yes/No + affiliation ID if yes | **Persisted** (Step 2 — moved here from the old, deleted Step 4) |
| State Cricket Association Affiliation | More common than BCCI at this level; enables future routing | Yes/No + which association | **Persisted** (Step 2 — moved here from the old, deleted Step 4) |
| Head Coach Name | Primary development decision-maker | Text input | **Persisted** (Step 2 — moved here from the old, deleted Step 3) |
| Active Player Count (Approx.) | Sets onboarding support path and platform tier | Range: <50 / 50–100 / 100–250 / 250+ | **Schema only** — `Academy.active_player_count_range` exists; no wizard field has ever set it |
| Ground Type | Infrastructure/quality signal scouts filter by | Single-select: Turf / Matting / Both | **Not built** — no `ground_type` column anywhere; the old wizard collected this and discarded it, and it was cut in this session's 3-step rebuild since keeping an unpersisted field would repeat the same problem |

### MEDIUM — strongly recommended, main onboarding form

| Data Point | Why Collect It | How to Collect | Implemented? |
|---|---|---|---|
| Head Coach Certification | Coaching-quality signal on the public profile | Single-select: BCCI L1–L3 / NCA / NIS / Informal / None | **Not built** — collected in the old 5-step wizard's Step 3, never persisted; cut in the 3-step rebuild |
| Head Coach Experience (Years) | Proxy for depth when certification is absent | Number input | **Not built** |
| Ex-Professional / State Player on Staff | Rare, high-value quality signal | Yes/No + name + level | **Not built** — was in the old Step 3, discarded server-side; cut in the rebuild |
| Number of Assistant Coaches | Coach-to-player ratio; seeds coach invite list | Number stepper | **Not built** — was in old Step 3, discarded; cut |
| Number of Practice Nets | Capacity-vs-infrastructure signal | Number stepper | **Not built** — was in old Step 3, discarded; cut |
| Indoor Facility | Monsoon-season training differentiator | Yes/No | **Not built** |
| Bowling Machine Available | Visible training-infrastructure differentiator | Yes/No (+ count) | **Not built** — was in old Step 3, discarded; cut |
| Approx. Simultaneous Capacity | Operational batch-size context | Number input | **Not built** — was in old Step 3, discarded; cut |
| Formats Trained | Scouts filter academies by competition format | Multi-select: T20 / ODI / 40-over / Red-ball / All | **Not built** — was in old Step 4, discarded; cut |
| Age Groups Offered | Triggers guardian-consent expectations at player onboarding | Multi-select chips | **Not built** — was in old Step 4, discarded; cut |
| Batch Timings | Scheduling fit for players/parents | Multi-select: Morning / Evening / Both | **Not built** — was in old Step 4, discarded; cut |
| Monthly Fee Range | Reveals tier/target demographic for plan matching | Range chips | **Not built** — was in old Step 4, discarded; cut |
| Website / Social Media | Public-profile credibility | Optional URLs | **Not built** |
| Society / Trust Registration Number | Verification + future billing | Optional text | **Not built** |
| Academy Logo / Letterhead | Appears on player profiles and search results | Image upload | **Not built** — the wizard's Step 2 upload button only flips a local `logoUploaded` boolean; nothing is actually uploaded, stored, or persisted anywhere despite README text claiming an `academies.logo_url` persistence path that does not exist in the schema |
| Previous Digital Tool Used | Predicts onboarding-support needs | Single-select | **Not built** |
| Annual New Player Intake | Forecasts profile-creation volume | Range | **Not built** |
| Language Preference | Determines Hindi vs English WhatsApp/UI copy | Single-select, auto-suggest from state | **Not built** |

### LOW — post-onboarding "complete your profile" (source doc's LIKELY + LOW merged)

| Data Point | Why Collect It | Implemented? |
|---|---|---|
| Players at District/State/National Level (alumni) | Strongest credibility signal available | Not built |
| Facilities: Gym / Pool / Hostel / Video Analysis | Secondary infra signal, filterable | Not built |
| Specialties / Focus Areas | Discovery by coaching focus | Not built |
| Trial / Admission Process | Signal quality vs volume of roster | Not built |
| School / College Partnerships | Bulk-enrollment channel | Not built |
| Internal Tournaments Run | Self-generated performance data source | Not built |
| Academy Description | Public-profile differentiation copy | Not built |
| Sports Insurance for Players | Professionalism signal | Not built |
| GST Number | B2B invoicing only, once billing exists | Not built (correctly deferred per source doc's own rule) |
| Awards & Recognitions | Public-profile nice-to-have | Not built |
| Preferred Contact Time | Support-ops convenience | Not built |
| Bank / UPI Details | Only once payment features exist | Not built (correctly deferred) |

---

## 2. Scout Data Points (draft — no prior source document)

### HIGH — required to create a scout account at all

| Data Point | Why Collect It | How to Collect | Implemented? |
|---|---|---|---|
| Organization Name | Primary identifier; shown to Ops during review | Text input | **Persisted** (`ScoutProfile.org_name`) |
| Organization Type | Franchise vs academy-recruiting-arm vs independent — different trust levels and future permissions | Single-select: Franchise / Academy Recruiting Arm / Independent | **Persisted** (`ScoutProfile.org_type`) |
| Mobile Number (WhatsApp) | Account verification, matches the platform-wide OTP pattern | Phone + OTP verify | **Persisted** (Step 1, on the scout's User row) |
| Official Email | Login, account recovery | Email input | **Persisted** (Step 1, on the scout's User row) |

### MEDIUM — strongly recommended, collected at signup

| Data Point | Why Collect It | How to Collect | Implemented? |
|---|---|---|---|
| Contact Name | A named human for Ops/support to reach, distinct from login email | Text input, optional | **Persisted** (`ScoutProfile.contact_name`) |
| Contact Phone | Backup channel if different from the WhatsApp number used for OTP | Text input, optional | **Persisted** (`ScoutProfile.contact_phone`) |
| Organization Verification Evidence (BCCI/franchise ID, letterhead, or LinkedIn/official profile link) | `ScoutProfile.verification_status` exists but nothing currently feeds it — Ops has no evidence to review a submission against | Optional text/URL field, or file upload | **Not built** — needs a decision on what "verified" actually checks before building the field |
| Scouting Focus (age groups / formats / regions of interest) | Lets a future dashboard pre-filter the candidate list to what this scout actually cares about, rather than one undifferentiated list | Multi-select chips | **Not built** |

### LOW — post-signup, only relevant once a real dashboard exists

| Data Point | Why Collect It | Implemented? |
|---|---|---|
| Profile Photo / Organization Logo | Identifies the scout to academy/association staff who approve any future contact request | Not built |
| Years Scouting / Prior Organizations | Credibility context, similar in spirit to a coach's certification | Not built |
| Preferred Contact Method (in-platform only vs email vs phone) | Relevant only once any scout-to-academy contact flow exists — see the open non-goal question below | Not built |
| Notes for Ops Review | Free text a scout can add to speed up manual verification | Not built |

**Two open questions this draft deliberately does not answer** (matches
`docs/AthlasX_Scout_SelfServe_Verification_Prompt.md`'s Prompt 3): what
`ScoutProfile.verification_status` should actually gate once it's read
somewhere (right now nothing reads it), and whether a scout can ever
initiate contact with a player directly or only through that player's
academy/association — the pivot document's stated non-goal was no direct
scout-to-player contact, and nobody has confirmed that still holds. Don't
build the "Scouting Focus" or "Preferred Contact Method" fields into a real
dashboard until those two are answered; they're listed here for
completeness, not as a green light.
