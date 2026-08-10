import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { calculateAthlasXScore, getScoreTier } from '@/lib/athlasx-score'
import { dbRoleMap, seedMatchHistory } from '@/lib/mock-performance-seed'

export const dynamic = 'force-dynamic'

// No auth system yet — "my record" stands in for the current player by
// picking the first claimed profile, same pattern as grading's
// acting-as-selector. Swap for a real session lookup once auth exists.
export async function GET() {
  const player = await db.playerProfile.findFirst({
    where: { claim_status: 'claimed' },
    orderBy: { created_at: 'asc' },
  })
  if (!player) return NextResponse.json({ player: null })

  const role = dbRoleMap[player.playing_role ?? 'Batsman'] ?? 'Batsman'
  const matches = seedMatchHistory(player.id, role)
  const performances = matches.map(m => ({
    level: m.level, batting_runs: m.batting_runs, batting_balls: m.batting_balls,
    batting_dismissed: m.batting_dismissed, bowling_overs: m.bowling_overs,
    bowling_wickets: m.bowling_wickets, bowling_runs_conceded: m.bowling_runs_conceded,
  }))
  const result = calculateAthlasXScore({ playingRole: role, performances, yearsExperience: 3 })
  const tier = getScoreTier(result.total)

  const battingMatches = matches.filter(m => m.batting_runs !== undefined)
  const totalRuns = battingMatches.reduce((s, m) => s + (m.batting_runs ?? 0), 0)
  const totalBalls = battingMatches.reduce((s, m) => s + (m.batting_balls ?? 0), 0)
  const dismissals = battingMatches.filter(m => m.batting_dismissed).length
  const fifties = battingMatches.filter(m => (m.batting_runs ?? 0) >= 50).length
  const best = Math.max(0, ...battingMatches.map(m => m.batting_runs ?? 0))

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

  return NextResponse.json({
    player: { id: player.id, full_name: player.full_name, playing_role: role },
    score: { total: result.total, tier: tier.label, batting: result.batting, bowling: result.bowling, fitness: result.fitness, fitnessAssessed: result.fitnessAssessed },
    summary: {
      matches: matches.length,
      runs: totalRuns,
      average: dismissals > 0 ? Math.round((totalRuns / dismissals) * 10) / 10 : totalRuns,
      strikeRate: totalBalls > 0 ? Math.round((totalRuns / totalBalls) * 1000) / 10 : 0,
      fifties,
      best,
    },
    trend,
    matches: matches.slice(0, 10).map(m => ({
      id: m.id, opponent: m.opponent, tournament: m.tournament, date: m.date, level: m.level,
      runs: m.batting_runs, balls: m.batting_balls,
      sr: m.batting_balls ? Math.round((m.batting_runs! / m.batting_balls) * 1000) / 10 : undefined,
    })),
  })
}
