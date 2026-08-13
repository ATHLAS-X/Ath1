import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  const alerts = await db.trendAlert.findMany({
    orderBy: { triggered_at: 'desc' },
  })
  const playerIds = Array.from(new Set(alerts.map(a => a.player_id)))

  const players = await db.playerProfile.findMany({
    where: { id: { in: playerIds } },
  })
  const playerById = new Map(players.map(p => [p.id, p]))

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
