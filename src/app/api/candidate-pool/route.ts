import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { calculateAthlasXScore, getProvenanceLabel } from '@/lib/athlasx-score'
import { dbRoleMap, seedPerformances } from '@/lib/mock-performance-seed'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await db.selectionSession.findFirst({
    orderBy: { created_at: 'desc' },
    include: { association: { include: { players: true } } },
  })

  if (!session) return NextResponse.json({ candidates: [], totalSelectors: 0 })

  const totalSelectors = await db.user.count({ where: { role: 'selection_panel' } })
  const grades = await db.grade.groupBy({
    by: ['player_id'],
    where: { selection_session_id: session.id },
    _count: { player_id: true },
  })
  const gradeCountByPlayer = new Map(grades.map(g => [g.player_id, g._count.player_id]))

  const trendAlerts = await db.trendAlert.findMany({
    where: { player_id: { in: session.association.players.map(p => p.id) } },
    select: { player_id: true, flag_type: true },
  })
  const flagByPlayer = new Map(trendAlerts.map(t => [t.player_id, t.flag_type]))

  const candidates = session.association.players.map(p => {
    const role = dbRoleMap[p.playing_role ?? 'Batsman'] ?? 'Batsman'
    const performances = seedPerformances(p.id, role)
    const result = calculateAthlasXScore({ playingRole: role, performances, yearsExperience: 3 })
    const age = Math.floor((Date.now() - p.dob.getTime()) / (365.25 * 24 * 3600 * 1000))
    return {
      id: p.id,
      name: p.full_name,
      age,
      district: p.district,
      playing_role: role,
      athlasx_score: result.total,
      batting_0_to_10: result.batting > 0 ? result.batting : undefined,
      bowling_0_to_10: result.bowling > 0 ? result.bowling : undefined,
      match_count: result.verifiedMatchCount,
      provenance: getProvenanceLabel(result.verifiedMatchCount, result.tqiWeightedMatches, 'district'),
      flag: flagByPlayer.get(p.id) ?? 'none',
      graded_by: gradeCountByPlayer.get(p.id) ?? 0,
      total_selectors: totalSelectors,
    }
  }).sort((a, b) => b.athlasx_score - a.athlasx_score)

  const withPercentile = candidates.map((c, i) => ({
    ...c,
    percentile: candidates.length > 1 ? Math.round(100 - (i / (candidates.length - 1)) * 100) : 100,
  }))

  return NextResponse.json({ candidates: withPercentile, totalSelectors })
}
