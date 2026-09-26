import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { calculateAthlasXScore, getScoreTier } from '@/lib/athlasx-score'
import { dbRoleMap } from '@/lib/mock-performance-seed'
import { requireAuth } from '@/lib/require-auth'
import { verifiedMatchHistoryForPlayer } from '@/lib/verified-performances'
import { computeCohortPercentile } from '@/lib/player-cohort'

export const dynamic = 'force-dynamic'

// "My record" now resolves to the caller's own linked player profile
// (User.linked_player_id) instead of arbitrarily picking the first claimed
// profile in the table — that placeholder is what let any caller see
// whichever player happened to be claimed first, regardless of who they
// actually were.
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const me = await db.user.findUnique({ where: { id: auth.user.id }, select: { linked_player_id: true } })
  if (!me?.linked_player_id) return NextResponse.json({ player: null })

  const player = await db.playerProfile.findUnique({ where: { id: me.linked_player_id } })
  if (!player) return NextResponse.json({ player: null })
  // FLAGGED, applied as directed, not silently decided: the audit's finding
  // (5 read paths not honouring consent withdrawal) named my-record as one
  // of them, applied uniformly here too — but this route is a player
  // viewing their OWN record. Hiding someone's own data from themselves
  // after THEY withdrew consent is an unusual UX call the audit's literal
  // wording may not have intended to cover; worth a real product decision
  // rather than assuming this is obviously correct.
  if (player.consent_status === 'withdrawn') return NextResponse.json({ player: null })

  const role = dbRoleMap[player.playing_role ?? 'Batsman'] ?? 'Batsman'
  const matches = await verifiedMatchHistoryForPlayer(player.id)
  const performances = matches.map(m => ({
    level: m.level, batting_runs: m.batting_runs, batting_balls: m.batting_balls,
    batting_dismissed: m.batting_dismissed, bowling_overs: m.bowling_overs,
    bowling_wickets: m.bowling_wickets, bowling_runs_conceded: m.bowling_runs_conceded,
  }))
  const result = calculateAthlasXScore({ playingRole: role, performances, yearsExperience: 3 })
  const tier = getScoreTier(result.total)
  const cohort = await computeCohortPercentile(player.id, player.district, player.playing_role, player.dob, result.total)

  const battingMatches = matches.filter(m => m.batting_runs !== undefined)
  const totalRuns = battingMatches.reduce((s, m) => s + (m.batting_runs ?? 0), 0)
  const totalBalls = battingMatches.reduce((s, m) => s + (m.batting_balls ?? 0), 0)
  const dismissals = battingMatches.filter(m => m.batting_dismissed).length
  const fifties = battingMatches.filter(m => (m.batting_runs ?? 0) >= 50).length
  const best = Math.max(0, ...battingMatches.map(m => m.batting_runs ?? 0))
  const totalFours = battingMatches.reduce((s, m) => s + (m.batting_fours ?? 0), 0)
  const totalSixes = battingMatches.reduce((s, m) => s + (m.batting_sixes ?? 0), 0)
  const boundaryRuns = totalFours * 4 + totalSixes * 6
  const boundaryPct = totalRuns > 0 ? Math.round((boundaryRuns / totalRuns) * 1000) / 10 : 0

  const bowlingMatches = matches.filter(m => m.bowling_overs !== undefined)
  const totalOvers = bowlingMatches.reduce((s, m) => s + (m.bowling_overs ?? 0), 0)
  const totalWickets = bowlingMatches.reduce((s, m) => s + (m.bowling_wickets ?? 0), 0)
  const totalRunsConceded = bowlingMatches.reduce((s, m) => s + (m.bowling_runs_conceded ?? 0), 0)
  const economy = totalOvers > 0 ? Math.round((totalRunsConceded / totalOvers) * 100) / 100 : 0

  // Monthly trend bucketed from the synthetic match dates
  const monthly = new Map<string, { runs: number; balls: number }>()
  for (const m of battingMatches) {
    const label = new Date(m.date).toLocaleDateString('en-IN', { month: 'short' })
    const bucket = monthly.get(label) ?? { runs: 0, balls: 0 }
    bucket.runs += m.batting_runs ?? 0
    bucket.balls += m.batting_balls ?? 0
    monthly.set(label, bucket)
  }
  const trend = Array.from(monthly.entries()).map(([label, b]) => ({
    label, runs: b.runs, sr: b.balls > 0 ? Math.round((b.runs / b.balls) * 1000) / 10 : 0,
  }))

  // Real "score trend, last 8 assessments" — PlayerWeek.rolling_4week_average
  // is a real per-player column, populated when this player has been
  // through coach-supervised weekly assessment (i.e. is on a Squad roster).
  // Players with no PlayerWeek rows get an honest empty state instead of a
  // fabricated line — most claimed players won't have this yet, same
  // treatment as every other "no history" case in this app.
  const weeks = await db.playerWeek.findMany({
    where: { player_id: player.id, rolling_4week_average: { not: null } },
    orderBy: { week_start: 'asc' },
    select: { week_start: true, rolling_4week_average: true },
  })
  const scoreTrend = weeks.slice(-8).map((w) => ({
    week: w.week_start.toISOString().slice(0, 10),
    score: w.rolling_4week_average!,
  }))

  return NextResponse.json({
    player: { id: player.id, full_name: player.full_name, playing_role: role, dob: player.dob, district: player.district, academy: player.academy },
    score: { total: result.total, tier: tier.label, batting: result.batting, bowling: result.bowling, fitness: result.fitness, fitnessAssessed: result.fitnessAssessed },
    matrix: {
      batting: { score: result.batting, matches: battingMatches.length, boundaryPct, average: dismissals > 0 ? Math.round((totalRuns / dismissals) * 10) / 10 : totalRuns, strikeRate: totalBalls > 0 ? Math.round((totalRuns / totalBalls) * 1000) / 10 : 0 },
      bowling: { score: result.bowling, matches: bowlingMatches.length, economy, wickets: totalWickets, style: player.bowling_style },
      fitness: { assessed: result.fitnessAssessed, score: result.fitness },
    },
    percentile: {
      value: cohort.percentile,
      cohortSize: cohort.cohortSize,
      ageCategory: cohort.ageCategory,
      district: player.district,
    },
    summary: {
      matches: matches.length,
      runs: totalRuns,
      average: dismissals > 0 ? Math.round((totalRuns / dismissals) * 10) / 10 : totalRuns,
      strikeRate: totalBalls > 0 ? Math.round((totalRuns / totalBalls) * 1000) / 10 : 0,
      fifties,
      best,
    },
    trend,
    scoreTrend,
    matches: matches.slice(0, 10).map(m => ({
      id: m.id, opponent: m.opponent, tournament: m.tournament, date: m.date, level: m.level,
      runs: m.batting_runs, balls: m.batting_balls,
      sr: m.batting_balls ? Math.round((m.batting_runs! / m.batting_balls) * 1000) / 10 : undefined,
    })),
  })
}
