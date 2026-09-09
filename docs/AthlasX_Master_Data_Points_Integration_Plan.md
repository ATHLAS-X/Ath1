# AthlasX Master Data Points — Integration Plan

Source: `docs/AthlasX_Master_Data_Points.docx` (78 fields: 40 Academy, 38 Player).
This plan maps every field to a schema change, a UI location, and a phase —
for review before any code is written. No schema, migration, or form change
has been made yet.

## Ground rules carried over from the doc (binding on every phase)

1. Never block profile/draft creation on LOW fields. HIGH fields alone must
   produce a valid draft.
2. Aadhaar is always player-initiated — never in the academy's CSV, never
   fillable by an admin, never a gate on profile creation. (Already true
   today via `src/lib/aadhaar-verification.ts` — no change needed there.)
3. Under-18 → guardian name + OTP-verified phone become mandatory the
   moment DOB confirms a minor. (Partially true today for player-onboarding
   Aadhaar; needs to extend to the new guardian-adjacent fields below.)
4. Admin bulk-CSV template is exactly 8 columns: Name, DOB, Gender, Role,
   Batting style, State, Batch, Guardian (if minor). Nothing else belongs
   in the CSV — everything else is either academy-onboarding-collected
   (HIGH/MED, admin-entered once) or player-self-registration-collected
   (LIKELY/LOW, player-entered after claiming their profile).
5. H+T-sourced fields (both Hritvik's checklist and the team's analysis
   independently flagged them) are the highest-confidence set — these are
   all HIGH or MED already per the doc, so this doesn't change phasing,
   just confirms it.

## Phasing

- **Phase 1 — HIGH fields.** Gate: valid draft profile. Blocking within
  their onboarding step. Includes wiring up academy-wizard fields the UI
  already collects but the API currently discards.
- **Phase 2 — MED fields.** Still in the main onboarding wizard, but never
  block advancing to the next step or final submit.
- **Phase 3 — LIKELY/LOW fields.** Two new "complete your profile" surfaces
  (one for academy, one for player) collected post-onboarding, per the
  doc's own design. Never shown during the signup wizard.

Every phase needs a live DB connection to actually run its migration —
currently blocked on the still-unresolved Supabase password (`P1000`)
from earlier this session. Schema/migration work can be written and
reviewed before that's fixed, but not applied.

---

## Part A — Academy (40 fields)

### Current state
`Academy` model has 8 columns today: `name`, `name_variants`, `district`,
`state`, `verified`, `players_at_district_plus`, `admin_user_id`,
`created_at`. Of the 40 doc fields, only Name/District/State are modeled.
**~20 of the remaining 37 are already collected in
`src/app/academy/onboarding/page.tsx`'s React state but never sent to the
API** — `POST /api/academy/onboard` explicitly discards them today (see
that route's own header comment). Those are marked "UI-only today" below.

### Phase 1 — HIGH (11 fields, 9 net-new after Name/District/State)

| Field | Existing state | Proposed column | Type | Notes |
|---|---|---|---|---|
| Academy Name | ✅ modeled | `name` | — | no change |
| City / District / State | ✅ District/State modeled, City missing | `city` (new) | `String?` | District/State unchanged |
| Year Established | UI-only today | `year_established` | `Int?` | 1950–current validated client-side |
| Academy Type | UI-only today | `academy_type` | new enum `AcademyType` (private, government, sports_club, school_attached, ngo, trust) | |
| Primary Contact Name + Designation | UI-only today | `contact_name`, `contact_designation` | `String?`, `String?` | two columns, not one |
| Mobile Number (WhatsApp) | collected (OTP flow), persisted as `User.phone` today — not on Academy | — | — | already correctly modeled on `User`, not `Academy`; no change needed, just confirm no duplicate column gets added |
| Official Email | collected, persisted as `User.email` | — | — | same as above — already correct via the admin `User` row |
| BCCI Affiliation | UI-only today | `bcci_affiliated` (+ `bcci_affiliation_id`) | `Boolean @default(false)`, `String?` | |
| State Cricket Association Affiliation | UI-only today | `state_assoc_affiliated` (+ `state_assoc_names String[]`) | `Boolean @default(false)`, `String[]` | multi-entry per doc's edge case |
| Head Coach Name | UI-only today | `head_coach_name` | `String?` | doc also wants a Coach-profile link/invite trigger — flag as a follow-up, not blocking Phase 1 |
| Active Player Count (Approximate) | UI-only today | `active_player_count_range` | new enum `PlayerCountRange` (`under_50`,`50_100`,`100_250`,`250_plus`) | range, not exact count, per doc |

**Net-new Academy columns in Phase 1: 10** (`city`, `year_established`, `academy_type`, `contact_name`, `contact_designation`, `bcci_affiliated`, `bcci_affiliation_id`, `state_assoc_affiliated`, `state_assoc_names`, `head_coach_name`, `active_player_count_range`) plus 2 new enums.

**UI work:** none needed for the 9 UI-only fields — pure persistence wiring in `POST /api/academy/onboard`. Only City is a genuinely new form field (add to Step 2 identity block).

### Phase 2 — MED (16 fields, all UI-only today except where noted)

| Field | Proposed column | Type |
|---|---|---|
| Head Coach Certification | `head_coach_certification` | enum `CoachCertLevel` (bcci_l1, bcci_l2, bcci_l3, nca, nis, state_board, informal, none) |
| Head Coach Experience (Years) | `head_coach_experience_years` | `Int?` |
| Ex-Professional/State Player on Staff | `has_ex_professional_staff` (+ `ex_professional_details String?`) | `Boolean @default(false)`, `String?` |
| Number of Assistant Coaches | `assistant_coach_count` | `Int?` |
| Number of Practice Nets | `practice_net_count` | `Int?` |
| Indoor Facility | `has_indoor_facility` | `Boolean @default(false)` |
| Bowling Machine Available | `bowling_machine_count` | `Int?` (0/null = no) |
| Approximate Simultaneous Capacity | `simultaneous_capacity` | `Int?` |
| Formats Trained | `formats_trained` | `Format[]` (reuse existing `Format` enum) |
| Age Groups Offered | `age_groups_offered` | new enum array `AgeGroup[]` (u10,u12,u14,u16,u19,u23,senior) |
| Batch Timings | `batch_timing_slots` (+ `batch_days String?`) | new enum array, `String?` |
| Monthly Fee Range | `monthly_fee_range` | new enum `FeeRange` |
| Website / Social Media | `website_url`, `instagram_handle`, `youtube_channel` | `String?` ×3 |
| Society/Trust Registration Number | `registration_number` | `String?` — collected in profile settings, not onboarding, per doc |
| Academy Logo / Letterhead | `logo_url`, `letterhead_url` | `String?` ×2 — reuses existing upload pattern (`src/lib/upload.ts`) |
| Previous Digital Tool Used | `previous_digital_tool` | new enum `PriorTool` (none_paper, excel, google_sheets, whatsapp_groups, mobile_app, other) |
| Annual New Player Intake | `annual_intake_range` | new enum `IntakeRange` |
| Language Preference | `language_preference` | new enum `LanguagePref` (english, hindi, both) — auto-suggested from state, admin-overridable |

**Net-new: 20 columns, 7 new enums.** All UI-only today (fields the wizard's Step 3/4 already render) — Phase 2 is pure persistence wiring, zero new form fields, **except** Website/Social/Logo/Letterhead/Registration-number, which the current wizard doesn't render at all and need new UI (doc explicitly places Logo/Letterhead/Registration in "the profile," i.e., post-onboarding settings, not the wizard — recommend deferring those 5 sub-fields to Phase 3's "complete your profile" surface instead, even though the doc tags them MED, since the doc's own "How to Collect" column for them says "collected in the profile, not a blocker at onboarding").

### Phase 3 — LIKELY/LOW (13 fields) → new "Complete Your Academy Profile" surface

| Tier | Field | Column | Type |
|---|---|---|---|
| LIKELY | Players at District/State/National Level | `notable_alumni_reported`, `notable_alumni_details Json?` | `Boolean`, `Json?` |
| LIKELY | Facilities (Gym/Pool/Hostel/Video Analysis/Transport) | `facilities` | new enum array `AcademyFacility[]` |
| LIKELY | Specialties/Focus Areas | `specialties` | new enum array `AcademySpecialty[]` |
| LIKELY | Trial/Admission Process | `admission_process` | new enum `AdmissionProcess` |
| LIKELY | School/College Partnerships | `has_school_partnerships`, `partner_institutions String?` | `Boolean`, `String?` |
| LIKELY | Internal Tournaments Run | `runs_internal_tournaments`, `tournament_frequency` | `Boolean`, new enum `Frequency` |
| LIKELY | Academy Description | `description` | `String?` (50–500 chars, app-layer validated) |
| LIKELY | Sports Insurance for Players | `player_insurance_status` | new enum `TriState` (yes,no,not_sure) |
| LOW | GST Number | `gst_number` | `String?` — billing/settings, not onboarding |
| LOW | Awards & Recognitions | `awards` | `String?` |
| LOW | Preferred Contact Time | `preferred_contact_time` | new enum `ContactWindow` |
| LOW | Bank/UPI Details | *(not modeled yet — doc says don't collect until payment features exist; explicitly deferred, not part of this integration at all)* | — | — |

Plus the 5 MED sub-fields deferred here from Phase 2: `website_url`, `instagram_handle`, `youtube_channel`, `registration_number`, `logo_url`, `letterhead_url`.

---

## Part B — Player (38 fields)

### Current state
`PlayerProfile` today: `full_name`, `dob`, `district`, `state`,
`guardian_phone`, `playing_role`, `batting_style`, `bowling_style`,
`preferred_formats`, `academy` (free-text name, not a relation),
`footage_urls`, `bio`, plus Aadhaar fields (already correctly minimal —
last4 + status only, per doc rule #2). The self-serve player wizard
(`src/app/player/onboarding/page.tsx`) collects `cricheroes_handle` and
`yearsExperience` too, but **neither is persisted** — same
discard-in-the-API pattern as academy onboarding. Gender, batch,
enrollment date, highest level, personal phone, and everything else below
has no field anywhere yet.

### Phase 1 — HIGH (14 fields)

| Field | Existing state | Proposed column | Type |
|---|---|---|---|
| Full Name | ✅ modeled | `full_name` | — |
| Date of Birth | ✅ modeled | `dob` | — |
| Gender | missing entirely | `gender` | new enum `Gender` (male, female, other) — **never default to Male, per doc** |
| Primary Playing Role | ✅ modeled | `playing_role` | — |
| Batting Style | ✅ modeled | `batting_style` | — |
| Bowling Style | ✅ modeled | `bowling_style` | — |
| State | ✅ modeled | `state` | — |
| City / District | District ✅, City missing | `city` (new) | `String?` |
| Guardian Name + Phone (under-18) | Phone ✅ (`guardian_phone`), Name missing | `guardian_name` | `String?`, mandatory when minor (app-layer, same pattern as existing guardian-phone gating) |
| Enrollment Date at Academy | missing | `enrollment_date` | `DateTime? @db.Date` — backdatable 15 years for CSV imports |
| Batch / Group | missing | `batch_id` (relation) or `batch_label String?` | needs a decision: link to the real `AcademyBatch` model (exists already, from the Sparsh port) if the player belongs to a tracked academy, else free text — **flagging this as an open question below**, not deciding it here |
| Highest Level Represented | missing | `highest_level_represented` | new enum `CompetitiveLevel` (club_only, school_team, zonal, district_team, state_trial, state_team, ipl_trial, national) — unverified badge until association-confirmed |
| Personal Phone (15+) | missing | separate from `guardian_phone`; likely lives on `User.phone` once the player has claimed/created their own account, not on `PlayerProfile` directly — **open question below** | |
| — | `cricheroes_handle` (UI-only today) | `cricheroes_handle` | `String?` — pure persistence wiring, no new UI |

**Net-new: 6 new PlayerProfile columns minimum** (`gender`, `city`, `guardian_name`, `enrollment_date`, `highest_level_represented`, `cricheroes_handle`), plus the batch and personal-phone open questions below.

### Phase 2 — MED (13 fields)

| Field | Column | Type |
|---|---|---|
| Height (cm) | `height_cm` | `Int?` |
| Weight (kg) | `weight_kg` | `Int?` |
| School Name | `school_name` | `String?` |
| Secondary Playing Role | `secondary_playing_role` | reuse `PlayingRoleEnum?` |
| Photo | `avatar_url` | ✅ already exists (`avatar_url` on `PlayerProfile`) — no change, just wire up the UI upload if not already |
| Playing Since (Year or Age) | `playing_since_year` | `Int?` |
| Current Team Affiliations | `school_team`, `club_team`, `district_team_affiliation` | `String?` ×3 |
| Playing Format Experience | *(distinct from `preferred_formats`, which is "what they'd like to play" — doc wants "what they've actually played")* → `format_experience` | `Format[]` |
| Preferred Batting Position | `preferred_batting_position` | new enum `BattingPosition` |
| School/College Grade | `education_grade` | new enum `EducationGrade` |
| Matches Played (Career) | `career_matches` | `Int? @default(0)` |
| Previous Academy / Club | `previous_academy` | `String?` |
| — | `yearsExperience` (already in form, UI-only) | superseded by `playing_since_year` above — recommend dropping the separate `yearsExperience` field rather than keeping both |

**Net-new: ~12 columns, 2 enums.**

### Phase 3 — LIKELY/LOW (21 fields) → new "Complete Your Player Profile" surface

| Tier | Field | Column | Type |
|---|---|---|---|
| LIKELY | Dominant Hand | `dominant_hand` | enum (right,left,ambidextrous) |
| LIKELY | Runs Scored (Career) | `career_runs` | `Int?` |
| LIKELY | Wickets Taken (Career) | `career_wickets` | `Int?` |
| LIKELY | Best Bowling Figures | `best_bowling_figures` | `String?` (validated X/Y format) |
| LIKELY | Fitness Metrics | `yoyo_test_level`, `sprint_30m_sec`, `run_2km_min` | `Float?` ×3 |
| LIKELY | Fielding Specialty | `fielding_specialty` | new enum |
| LIKELY | Captain/VC Experience | `captaincy_level` | new enum, nullable |
| LIKELY | Injury History | `injury_disclosed`, `injury_details` | `Boolean`, `String?` — **coach/scout-only visibility, never public, per doc's DPDP note** |
| LIKELY | Referral Source | `referral_source` | new enum |
| LIKELY | Player Aspirations | `aspirations` | `String?` (≤200 chars) |
| LIKELY | Strengths (Self-Assessed) | `self_assessed_strengths` | `String?` |
| LIKELY | Areas to Improve | `self_assessed_improvements` | `String?` |
| LIKELY | Video Highlight Link | `highlight_video_url` | `String?` |
| LOW | Aadhaar Number | ✅ already correctly modeled/gated | — |
| LOW | District Team Representation | `district_team_year` (+ existing pattern) | `Int?` with "unverified" badge |
| LOW | Languages Spoken | `languages_spoken` | new enum array |
| LOW | Social Media Handles | `social_handles Json?` | `Json?` |
| LOW | Kit Ownership | `kit_ownership` | new enum, **never shown publicly per doc** |
| LOW | Dietary/Medical Notes | `dietary_medical_notes` | `String?`, **head-coach-only, DPDP-sensitive per doc, shown only if academy has hostel flagged** |
| LOW | Transport to Academy | `transport_mode` | new enum |

**Net-new: ~20 columns, ~8 new enums.**

---

## Open questions needing your decision before Phase 1 is finalized

1. **Batch/Group field** — should it be a real foreign key into the
   existing `AcademyBatch` model (from the Sparsh port, currently flagged
   off by `ACADEMY_SELF_SERVE_ENABLED`), or a free-text fallback for
   players whose academy isn't on the flagged-off self-serve system yet?
   The doc says "allow free-text if batches not yet set up — convert to
   structured later," which suggests both need to coexist.
2. **Personal Phone (15+)** — doc treats this as the player's own contact
   channel, separate from `guardian_phone`. Does this belong on
   `PlayerProfile` directly, or only ever on `User.phone` once a player
   account exists (mirroring how Academy's mobile/email already live on
   `User`, not `Academy`)? Affects whether unclaimed/admin-imported
   profiles can even hold this field.
3. ~~**CSV template fix**~~ — **done.** Template is now
   `full_name,dob,gender,playing_role,batting_style,state,batch,guardian`
   (District dropped, inherited from the importing academy's own
   district/state). Batch always maps to the new `batch_label` free-text
   field — CSV rows are never matched against real `AcademyBatch` rows by
   name. See `src/app/(dashboard)/academy/add-players/page.tsx`,
   `src/app/api/academy/players/bulk/route.ts`, and
   `src/lib/academy/players.ts`'s `addPlayerFromCsv`.
4. **New enums volume** — Phases 1–3 combined introduce roughly **22 new
   Prisma enums**. Want them named/grouped as I've proposed above, or
   consolidated differently (e.g. shared `Range` enum reused across
   fee/intake/capacity instead of one enum per field)?
5. **Migration sequencing** — given the DB is currently unreachable, do
   you want the Phase 1 schema diff + migration file written and reviewed
   now (ready to apply the moment the password is fixed), or held until
   connectivity is confirmed first?

Nothing above has been implemented. Awaiting your go on Phase 1 scope
(and the 5 open questions) before touching `prisma/schema.prisma`.
