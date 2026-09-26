import { NextRequest, NextResponse } from 'next/server'
import { isSameOriginRequest } from '@/lib/same-origin'
import type { BattingStyle, BowlingStyleEnum, CompetitiveLevel, Format, Gender, PlayingRoleEnum } from '@prisma/client'
import { db } from '@/lib/db'
import { applySessionCookie, encodeSessionToken } from '@/lib/auth'
import { hashPassword, validatePasswordStrength } from '@/lib/password'
import { consumeVerifiedAadhaar } from '@/lib/aadhaar-verification'
import { rateLimit } from '@/lib/rate-limit'
import { recordGuardianConsent } from '@/lib/consent-record'
import { isUnder18 } from '@/lib/age'

// Bump this whenever CONSENTS.dpdpGuardian.body (src/app/player/onboarding/
// page.tsx) changes wording — a stable identifier for exactly which copy a
// guardian was shown, so a later rewrite never retroactively changes what
// an earlier ConsentRecord is understood to have agreed to. This route has
// no access to the frontend's CONSENTS array (only the boolean the client
// posts), so a manually-bumped tag is used rather than a hash computed
// from text this route never receives.
const GUARDIAN_CONSENT_TEXT_VERSION = 'guardian_dpdp_v1'

// docs/AthlasX_Master_Data_Points.docx Player Phase 1 (HIGH) — the wizard's
// <select> already sends the enum's own values directly (see the "value"
// attrs in src/app/onboarding/page.tsx), unlike playingRole/battingStyle/
// bowlingStyle above, which still send the old mockup-copy display strings
// needing a lookup table. No mapping table needed for gender/level.
const GENDER_VALUES = new Set<Gender>(['male', 'female', 'other'])
const COMPETITIVE_LEVEL_VALUES = new Set<CompetitiveLevel>([
  'club_only', 'school_team', 'zonal', 'district_team', 'state_trial', 'state_team', 'ipl_trial', 'national',
])

const PLAYING_ROLE: Record<string, PlayingRoleEnum> = {
  Batsman: 'Batsman',
  Bowler: 'Bowler',
  'All-rounder': 'All_rounder',
  All_rounder: 'All_rounder',
  'Wicket-keeper Batsman': 'Wicket_keeper_Batsman',
  Wicket_keeper_Batsman: 'Wicket_keeper_Batsman',
}

const BATTING_STYLE: Record<string, BattingStyle> = {
  'Right-handed': 'Right_handed',
  Right_handed: 'Right_handed',
  'Left-handed': 'Left_handed',
  Left_handed: 'Left_handed',
}

const BOWLING_STYLE: Record<string, BowlingStyleEnum> = {
  'Right-arm Fast': 'Right_arm_Fast',
  'Right-arm Medium': 'Right_arm_Medium',
  'Right-arm Off-spin': 'Right_arm_Off_spin',
  'Right-arm Leg-spin': 'Right_arm_Leg_spin',
  'Left-arm Fast': 'Left_arm_Fast',
  'Left-arm Medium': 'Left_arm_Medium',
  'Left-arm Orthodox': 'Left_arm_Orthodox',
  'Left-arm Unorthodox': 'Left_arm_Unorthodox',
  None: 'None',
}

const FORMATS = new Set<Format>(['T20', 'ODI', 'Test', 'T10'])

const MATCH_STAT_KEYS = new Set([
  'runs',
  'wickets',
  'batting_runs',
  'batting_balls',
  'batting_fours',
  'batting_sixes',
  'bowling_wickets',
  'bowling_overs',
  'bowling_runs_conceded',
  'bowling_maidens',
  'hundreds',
  'fifties',
  'average',
  'strike_rate',
  'matches',
  'innings',
  'highest_score',
  'economy',
  'catches',
  'stumpings',
  'run_outs',
  'performances',
  'match_stats',
  'stats',
])

export async function POST(req: NextRequest) {
  // Mints a session cookie outside NextAuth's own CSRF-protected handler —
  // same-origin check, as on the auth routes (see src/lib/same-origin.ts).
  if (!isSameOriginRequest(req)) {
    return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const statKey = Object.keys(body).find((key) => MATCH_STAT_KEYS.has(key))
  if (statKey) {
    return NextResponse.json(
      { error: 'Match statistics are not accepted. Scores come from ingested scorecards only.' },
      { status: 400 },
    )
  }

  const email = String(body.email ?? '').trim().toLowerCase()
  const password = String(body.password ?? '')
  const fullName = String(body.fullName ?? '').trim()
  const dobRaw = body.dob
  const dob = typeof dobRaw === 'string' || typeof dobRaw === 'number' ? new Date(dobRaw) : null
  const district = String(body.district ?? '').trim()
  const state = String(body.state ?? '').trim()
  const playingRole = typeof body.playingRole === 'string' ? PLAYING_ROLE[body.playingRole] : undefined

  // docs/AthlasX_Master_Data_Points.docx Player Phase 1 (HIGH) — required
  // the same way the pre-existing identity/playing-profile fields above
  // are: a 400 if missing, not a silent null. Re-checked server-side even
  // though the wizard's own canProceedStage1() already gates on these —
  // same trust-the-client-nothing pattern as the Aadhaar re-check below.
  const gender = typeof body.gender === 'string' && GENDER_VALUES.has(body.gender as Gender) ? (body.gender as Gender) : undefined
  const city = String(body.city ?? '').trim()
  const enrollmentDateRaw = body.enrollmentDate
  const enrollmentDate = typeof enrollmentDateRaw === 'string' && enrollmentDateRaw ? new Date(enrollmentDateRaw) : null
  const highestLevelRepresented = typeof body.highestLevelRepresented === 'string' && COMPETITIVE_LEVEL_VALUES.has(body.highestLevelRepresented as CompetitiveLevel)
    ? (body.highestLevelRepresented as CompetitiveLevel)
    : undefined

  if (
    !email || !password || !fullName || !dob || Number.isNaN(dob.getTime()) || !district || !state || !playingRole
    || !gender || !city || !enrollmentDate || Number.isNaN(enrollmentDate.getTime()) || !highestLevelRepresented
  ) {
    return NextResponse.json({ error: 'Identity and playing profile are required' }, { status: 400 })
  }

  // Account-creation attempts weren't rate-limited at all (only the Aadhaar
  // OTP step was) — keyed by email, same "identity being targeted" pattern
  // authenticateWithPassword uses for login.
  const signupLimit = await rateLimit('player-onboard-signup', email, 5, 3600)
  if (!signupLimit.success) {
    return NextResponse.json({ error: 'Too many signup attempts. Please try again later.' }, { status: 429 })
  }

  const passwordError = validatePasswordStrength(password)
  if (passwordError) {
    return NextResponse.json({ error: passwordError }, { status: 400 })
  }

  const minor = isUnder18(dob)
  const guardianPhone = String(body.guardianPhone ?? '').trim()
  const guardianName = String(body.guardianName ?? '').trim()
  if (minor && (!guardianPhone || !guardianName)) {
    return NextResponse.json(
      { error: 'Guardian name and phone are required for players under 18' },
      { status: 400 },
    )
  }

  // Batch dual-mode (docs Phase 1, HIGH) — batch_id when the wizard
  // resolved a real AcademyBatch via /api/academy/lookup, batch_label
  // free text otherwise. Exactly one is expected to be set; not enforced
  // as a DB constraint (see the schema's own comment on batch_id/batch_label).
  const batchId = String(body.batchId ?? '').trim() || undefined
  const batchLabel = String(body.batchLabel ?? '').trim() || undefined

  // Aadhaar verification (Stage 2 of the onboarding wizard) — the client
  // never sends a raw Aadhaar number here, only the requestId its own
  // /api/onboarding/aadhaar/verify call already confirmed. Re-checking
  // server-side via consumeVerifiedAadhaar rather than trusting a
  // client-supplied "verified: true" boolean outright, and consuming it
  // (one-time use) so the same verification can't be replayed onto a
  // second account.
  const aadhaarRequestId = String(body.aadhaarRequestId ?? '')
  const aadhaarLast4 = aadhaarRequestId ? consumeVerifiedAadhaar(aadhaarRequestId) : null
  if (!aadhaarLast4) {
    return NextResponse.json({ error: 'Aadhaar verification is required and must be completed just before submitting' }, { status: 400 })
  }

  let guardianAadhaarLast4: string | null = null
  if (minor) {
    const guardianRequestId = String(body.guardianAadhaarRequestId ?? '')
    guardianAadhaarLast4 = guardianRequestId ? consumeVerifiedAadhaar(guardianRequestId) : null
    if (!guardianAadhaarLast4) {
      return NextResponse.json({ error: "Guardian Aadhaar verification is required for players under 18" }, { status: 400 })
    }
  }

  // Consent gate — Stage 3's four panels. Same DPDP-only-when-minor
  // pattern as guardianPhone/guardian Aadhaar above; the other three are
  // required regardless of age.
  const consentDataUse = body.consentDataUse === true
  const consentVisibility = body.consentVisibility === true
  const consentTerms = body.consentTerms === true
  const consentDpdpGuardian = body.consentDpdpGuardian === true
  if (!consentDataUse || !consentVisibility || !consentTerms || (minor && !consentDpdpGuardian)) {
    return NextResponse.json({ error: 'All required consents must be accepted before submitting' }, { status: 400 })
  }

  // Product note (not enforced here): creating this account lets the player
  // use the app. It does not mean they are verified talent for selectors.
  // Under-18 claim still proves guardian OTP; this wizard only stores the
  // guardian phone and signs the player in. See /claim for the verified path.
  const passwordHash = await hashPassword(password)

  try {
    const user = await db.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email,
          password_hash: passwordHash,
          role: 'player',
          player_profile: {
            create: {
              full_name: fullName,
              dob,
              district,
              state,
              gender,
              city,
              enrollment_date: enrollmentDate,
              highest_level_represented: highestLevelRepresented,
              cricheroes_handle: typeof body.cricheroes_handle === 'string' && body.cricheroes_handle.trim() ? body.cricheroes_handle.trim() : undefined,
              batch_id: batchId,
              batch_label: batchLabel,
              playing_role: playingRole,
              batting_style: typeof body.battingStyle === 'string' ? BATTING_STYLE[body.battingStyle] : undefined,
              bowling_style: typeof body.bowlingStyle === 'string' ? BOWLING_STYLE[body.bowlingStyle] : undefined,
              preferred_formats: Array.isArray(body.selectedFormats)
                ? body.selectedFormats.filter((f): f is Format => typeof f === 'string' && FORMATS.has(f as Format))
                : [],
              academy: body.academy ? String(body.academy) : undefined,
              guardian_phone: guardianPhone || undefined,
              guardian_name: guardianName || undefined,
              footage_urls: footageUrls(body),
              bio: foldBio(body),
              profile_source: 'self_registered',
              claim_status: 'claimed',
              consent_status: minor ? 'pending' : 'granted',
              aadhaar_last4: aadhaarLast4,
              aadhaar_verification_status: 'verified',
              guardian_aadhaar_last4: guardianAadhaarLast4 ?? undefined,
              guardian_aadhaar_verification_status: guardianAadhaarLast4 ? 'verified' : undefined,
            },
          },
        },
        include: { player_profile: true },
      })

      await tx.user.update({
        where: { id: created.id },
        data: { linked_player_id: created.player_profile!.id },
      })

      // Captured at the moment guardian consent completes (this submit),
      // not inferred after the fact from the consent_status column alone.
      // guardian_relation is NOT collected anywhere in this wizard's form
      // (unlike /claim and the academy join flow, which both ask for it)
      // — recorded honestly as unspecified rather than fabricated, and
      // flagged as a real gap to close, not silently papered over.
      if (minor) {
        await recordGuardianConsent({
          playerId: created.player_profile!.id,
          guardianName,
          guardianRelation: 'Unspecified — not collected by this onboarding wizard',
          consentTextVersion: GUARDIAN_CONSENT_TEXT_VERSION,
          verificationMethod: 'aadhaar_otp_stub',
          verifiedAt: new Date(),
        }, tx)
      }

      return created
    })

    const res = NextResponse.json({ playerId: user.player_profile!.id })
    const token = await encodeSessionToken({
      id: user.id,
      email: user.email,
      role: user.role,
    })
    return applySessionCookie(res, token)
  } catch (err) {
    if (isUniqueViolation(err)) {
      return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 })
    }
    throw err
  }
}

function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && (err as { code: string }).code === 'P2002'
}

function footageUrls(body: Record<string, unknown>): string[] {
  return [body.batting_url, body.bowling_url, body.keeping_url, body.youtube_channel]
    .map((v) => (typeof v === 'string' ? v.trim() : ''))
    .filter(Boolean)
}

function foldBio(body: Record<string, unknown>): string | undefined {
  // cricheroes_handle and yearsExperience used to be folded into bio text
  // here (no real columns existed for either). cricheroes_handle now has
  // its own column (see the create() call above); yearsExperience was
  // dropped from the wizard entirely — superseded by Phase 2's
  // playing_since_year, not replaced yet. bio is just bio now.
  const bio = typeof body.bio === 'string' ? body.bio.trim() : ''
  return bio || undefined
}
