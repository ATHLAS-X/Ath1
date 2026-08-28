import { NextRequest, NextResponse } from 'next/server'
import type { BattingStyle, BowlingStyleEnum, Format, PlayingRoleEnum } from '@prisma/client'
import { db } from '@/lib/db'
import { applySessionCookie, encodeSessionToken } from '@/lib/auth'
import { hashPassword } from '@/lib/password'

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

  if (!email || !password || !fullName || !dob || Number.isNaN(dob.getTime()) || !district || !state || !playingRole) {
    return NextResponse.json({ error: 'Identity and playing profile are required' }, { status: 400 })
  }

  const minor = isUnder18(dob)
  const guardianPhone = String(body.guardianPhone ?? '').trim()
  if (minor && !guardianPhone) {
    return NextResponse.json(
      { error: 'Guardian phone is required for players under 18' },
      { status: 400 },
    )
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
              playing_role: playingRole,
              batting_style: typeof body.battingStyle === 'string' ? BATTING_STYLE[body.battingStyle] : undefined,
              bowling_style: typeof body.bowlingStyle === 'string' ? BOWLING_STYLE[body.bowlingStyle] : undefined,
              preferred_formats: Array.isArray(body.selectedFormats)
                ? body.selectedFormats.filter((f): f is Format => typeof f === 'string' && FORMATS.has(f as Format))
                : [],
              academy: body.academy ? String(body.academy) : undefined,
              guardian_phone: guardianPhone || undefined,
              footage_urls: footageUrls(body),
              bio: foldBio(body),
              profile_source: 'self_registered',
              claim_status: 'claimed',
              consent_status: minor ? 'pending' : 'granted',
            },
          },
        },
        include: { player_profile: true },
      })

      await tx.user.update({
        where: { id: created.id },
        data: { linked_player_id: created.player_profile!.id },
      })

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

function isUnder18(dob: Date): boolean {
  return (Date.now() - dob.getTime()) / (365.25 * 24 * 3600 * 1000) < 18
}

function footageUrls(body: Record<string, unknown>): string[] {
  return [body.batting_url, body.bowling_url, body.keeping_url, body.youtube_channel]
    .map((v) => (typeof v === 'string' ? v.trim() : ''))
    .filter(Boolean)
}

function foldBio(body: Record<string, unknown>): string | undefined {
  const parts: string[] = []
  if (typeof body.bio === 'string' && body.bio.trim()) parts.push(body.bio.trim())
  if (typeof body.cricheroes_handle === 'string' && body.cricheroes_handle.trim()) {
    parts.push(`CricHeroes: ${body.cricheroes_handle.trim()}`)
  }
  if (body.yearsExperience !== undefined && body.yearsExperience !== null && String(body.yearsExperience).trim() !== '') {
    parts.push(`${String(body.yearsExperience).trim()} years of cricket`)
  }
  return parts.length ? parts.join('\n') : undefined
}
