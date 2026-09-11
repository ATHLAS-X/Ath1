import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/require-auth'
import { resolveVerifiedAssociationScope } from '@/lib/association/verification-gate'
import { visibilityWhere } from '@/lib/player-visibility'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  // TrendAlert has no association_id of its own — was previously joined
  // straight to PlayerProfile with no visibility check at all, so ANY
  // authenticated caller could see every association's flagged players.
  // Scoped the same way every other cross-association player read now is:
  // own association, plus any player who opted into cross_association (or
  // franchise_scout, while that tier is enabled).
  const scope = await resolveVerifiedAssociationScope(auth.user)

  const alerts = await db.trendAlert.findMany({
    orderBy: { triggered_at: 'desc' },
  })
  const alertPlayerIds = Array.from(new Set(alerts.map(a => a.player_id)))

  // A player who withdrew consent must never be surfaced here, in any
  // field — filtering the profile lookup alone isn't enough, since
  // `playerIds` below drives which ids appear in the response at all.
  const players = await db.playerProfile.findMany({
    where: { AND: [{ id: { in: alertPlayerIds } }, { consent_status: { not: 'withdrawn' } }, visibilityWhere(scope)] },
  })
  const playerById = new Map(players.map(p => [p.id, p]))
  const playerIds = alertPlayerIds.filter(id => playerById.has(id))

  const weeksByPlayer = await Promise.all(
    playerIds.map(id => db.playerWeek.findMany({
      where: { player_id: id },
      orderBy: { week_start: 'asc' },
    }))
  )

  const tracked = playerIds.map((id, i) => {
    const player = playerById.get(id)
    const alert = alerts.find(a => a.player_id === id)
    const weeks = weeksByPlayer[i]
    const latest = weeks[weeks.length - 1]
    const first = weeks[0]
    return {
      id,
      name: player?.full_name ?? 'Unknown',
      district: player?.district ?? '',
      playing_role: player?.playing_role ?? '',
      flag: alert?.flag_type ?? 'none',
      athlasx_score: latest?.rolling_4week_average ?? 0,
      score_delta: latest && first ? Math.round((latest.rolling_4week_average ?? 0) - (first.rolling_4week_average ?? 0)) : 0,
      consecutive_declines: alert?.consecutive_declining_weeks ?? undefined,
      skill_dimension: alert?.skill_dimension ?? undefined,
      coach_note: latest?.coach_note ?? undefined,
      trend: weeks.map((w, idx) => ({
        week: `W${idx + 1}`,
        runs: w.runs_this_week ?? undefined,
        wickets: w.wickets_this_week ?? undefined,
        score: w.rolling_4week_average ?? 0,
      })),
    }
  })

  return NextResponse.json({ players: tracked })
}
