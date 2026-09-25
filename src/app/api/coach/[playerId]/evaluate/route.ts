import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/require-auth'
import { calculateAthlasXScore } from '@/lib/athlasx-score'
import { dbRoleMap } from '@/lib/mock-performance-seed'
import { verifiedPerformancesByPlayer } from '@/lib/verified-performances'
import { canAccessPlayer } from '@/lib/squad-access'

// 3 consecutive weeks moving the same direction before flagging —
// matches the business rule prisma/seed.ts's own fixture already assumed
// (its hand-written decliningScores/risingScores arrays flag form_drop/
// on_form only on the 4th data point, i.e. after 3 real consecutive
// deltas), not a new number invented here.
const TREND_STREAK_THRESHOLD = 3

function mondayOfCurrentWeek(): Date {
  const d = new Date()
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  const monday = new Date(d.setDate(diff))
  monday.setHours(0, 0, 0, 0)
  return monday
}

// Supervised evaluation only — fitness/behaviour ratings here are set by a
// coach viewing this form, never derived from player self-report. Upserts
// the current week's PlayerWeek row rather than overwriting history.
export async function POST(req: NextRequest, { params }: { params: { playerId: string } }) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  // T-EVAL-AUTH: requireAuth alone let ANY authenticated user (player,
  // scout, unrelated coach) POST fitness/behaviour ratings for any
  // playerId — this is the same membership check coach/squad/route.ts
  // already applies via canAccessSquad, extended to a playerId caller.
  if (!(await canAccessPlayer(auth.user, params.playerId))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { fitness, behaviour, note } = await req.json()

  if (fitness !== undefined && (fitness < 1 || fitness > 5)) {
    return NextResponse.json({ error: 'fitness must be 1-5' }, { status: 400 })
  }
  if (behaviour !== undefined && (behaviour < 1 || behaviour > 5)) {
    return NextResponse.json({ error: 'behaviour must be 1-5' }, { status: 400 })
  }
  if (note !== undefined && (typeof note !== 'string' || note.length > 200)) {
    return NextResponse.json({ error: 'note must be a string of 200 characters or fewer' }, { status: 400 })
  }

  const weekStart = mondayOfCurrentWeek()

  const player = await db.playerProfile.findUnique({
    where: { id: params.playerId },
    select: { playing_role: true },
  })
  if (!player) {
    return NextResponse.json({ error: 'Player not found' }, { status: 404 })
  }

  // Real weekly score snapshot — computed the same way every other real
  // score display in this app computes it (calculateAthlasXScore over
  // verified match performances). rolling_4week_average/score_delta had
  // no live write path anywhere in src/ before this (confirmed by grep —
  // only prisma/seed.ts ever touched them), so every "trend" UI reading
  // them was frozen at whatever the seed happened to contain.
  const role = dbRoleMap[player.playing_role ?? 'Batsman'] ?? 'Batsman'
  const perfsByPlayer = await verifiedPerformancesByPlayer([params.playerId])
  const currentScore = calculateAthlasXScore({
    playingRole: role,
    performances: perfsByPlayer[params.playerId],
    yearsExperience: 3,
  }).total

  // Last 10 weeks, most recent first — enough to walk a real consecutive-
  // trend streak without an unbounded history scan.
  const priorWeeks = await db.playerWeek.findMany({
    where: { player_id: params.playerId, week_start: { lt: weekStart } },
    orderBy: { week_start: 'desc' },
    take: 10,
    select: { score_delta: true, flag_type: true, rolling_4week_average: true },
  })
  const previousWeek = priorWeeks[0] ?? null
  const scoreDelta = previousWeek?.rolling_4week_average != null
    ? Math.round((currentScore - previousWeek.rolling_4week_average) * 10) / 10
    : 0

  // Consecutive weeks (including this one) moving the same direction,
  // walking backward through real stored deltas — not fabricated.
  let streak = 1
  if (scoreDelta !== 0) {
    const sign = Math.sign(scoreDelta)
    for (const w of priorWeeks) {
      if (w.score_delta == null || Math.sign(w.score_delta) !== sign) break
      streak++
    }
  }

  let flagType: 'form_drop' | 'on_form' | 'none' = 'none'
  if (scoreDelta < 0 && streak >= TREND_STREAK_THRESHOLD) flagType = 'form_drop'
  else if (scoreDelta > 0 && streak >= TREND_STREAK_THRESHOLD) flagType = 'on_form'

  // This week's own PRE-upsert state (not last week's) — the dedup check
  // below needs "did this exact week already carry this flag before this
  // call", so a coach re-saving the same week's note (fixing a typo, say)
  // doesn't spam a second TrendAlert for a trend that hasn't changed.
  const existingThisWeek = await db.playerWeek.findUnique({
    where: { player_id_week_start: { player_id: params.playerId, week_start: weekStart } },
    select: { flag_type: true },
  })

  const saved = await db.playerWeek.upsert({
    where: { player_id_week_start: { player_id: params.playerId, week_start: weekStart } },
    create: {
      player_id: params.playerId,
      week_start: weekStart,
      matches_played: 0,
      fitness_rating: fitness,
      behaviour_rating: behaviour,
      coach_note: note,
      coach_note_at: note ? new Date() : undefined,
      rolling_4week_average: currentScore,
      score_delta: scoreDelta,
      flag_type: flagType,
    },
    update: {
      fitness_rating: fitness,
      behaviour_rating: behaviour,
      coach_note: note,
      coach_note_at: note ? new Date() : undefined,
      rolling_4week_average: currentScore,
      score_delta: scoreDelta,
      flag_type: flagType,
    },
  })

  // Only fire a new TrendAlert on the transition into a flagged state —
  // not every subsequent save of the same week (a coach re-saving notes
  // for an already-flagged week shouldn't spam duplicate alerts).
  // skill_dimension is deliberately left unset: PlayerWeek stores only the
  // composite score per week, not a batting/bowling breakdown per week,
  // so there's no real historical basis to honestly attribute which
  // specific skill drove a 3-week trend — leaving it blank instead of
  // guessing.
  if ((flagType === 'form_drop' || flagType === 'on_form') && (existingThisWeek?.flag_type ?? 'none') !== flagType) {
    await db.trendAlert.create({
      data: {
        player_id: params.playerId,
        triggered_at: new Date(),
        flag_type: flagType,
        consecutive_declining_weeks: flagType === 'form_drop' ? streak : undefined,
      },
    })
  }

  return NextResponse.json({ saved: true, id: saved.id })
}
