import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { calculateAthlasXScore, getProvenanceLabel } from '@/lib/athlasx-score'
import { dbRoleMap, seedPerformances } from '@/lib/mock-performance-seed'
import { requireAuth } from '@/lib/require-auth'
import { resolveAssociationScope } from '@/lib/association-scope'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  // Was previously unscoped — pulled whichever SelectionSession was most
  // recently created in the WHOLE database, regardless of which
  // association the caller belongs to. A SelectionSession belongs to
  // exactly one association (session.association), so scoping the lookup
  // to the caller's own association is the actual visibility boundary
  // here — visibility_tier's cross-association opt-in has no separate
  // action to take on top of this, since every player in the result is
  // already that one association's own roster by construction.
  const scope = await resolveAssociationScope(auth.user)
  if (scope !== null && scope.length === 0) return NextResponse.json({ candidates: [], totalSelectors: 0 })

  // A player who withdrew consent must never be surfaced here again —
  // filtered at the query itself, not patched after the fact, so no future
  // caller of this route can accidentally reintroduce the leak.
  const session = await db.selectionSession.findFirst({
    where: scope === null ? undefined : { association_id: { in: scope } },
    orderBy: { created_at: 'desc' },
    include: { association: { include: { players: { where: { consent_status: { not: 'withdrawn' } } } } } },
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
