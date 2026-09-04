/**
 * Batch version of the query dossier.ts (`playerVerifiedPerformances`) already
 * uses for a single player — association-approved Performance rows only,
 * joined to their Match's Tournament level. One round trip for a whole
 * roster instead of N, for pages (e.g. /grading Quick View) that need every
 * player's verified match data at once.
 */
import { db } from '@/lib/db'
import type { VerifiedPerformanceRow } from '@/lib/athlasx-score'

export interface VerifiedMatchRow {
  id: string
  opponent: string
  tournament: string
  date: string
  level: VerifiedPerformanceRow['level']
  batting_runs?: number
  batting_balls?: number
  batting_dismissed?: boolean
  bowling_overs?: number
  bowling_wickets?: number
  bowling_runs_conceded?: number
}

// Real match history for one player's own "record" view — same
// approved-only shape as verifiedPerformancesByPlayer/dossier.ts, plus the
// match-identifying fields (opponent/tournament/date) that a single score
// row doesn't carry. There's no stored "player's own team" field, so
// `opponent` is the match's away_team — the real recorded opponent, not a
// synthetic pairing.
export async function verifiedMatchHistoryForPlayer(playerId: string): Promise<VerifiedMatchRow[]> {
  const rows = await db.performance.findMany({
    where: { player_id: playerId, association_approval_status: 'approved' },
    include: { match: { include: { tournament: { select: { name: true, level: true } } } } },
    orderBy: { match: { date: 'desc' } },
  })

  return rows.map(r => ({
    id: r.id,
    opponent: r.match.away_team,
    tournament: r.match.tournament.name,
    date: r.match.date.toISOString(),
    level: r.match.tournament.level,
    batting_runs: r.batting_runs ?? undefined,
    batting_balls: r.batting_balls ?? undefined,
    batting_dismissed: r.batting_dismissed ?? undefined,
    bowling_overs: r.bowling_overs ?? undefined,
    bowling_wickets: r.bowling_wickets ?? undefined,
    bowling_runs_conceded: r.bowling_runs_conceded ?? undefined,
  }))
}

export async function verifiedPerformancesByPlayer(
  playerIds: string[],
): Promise<Record<string, VerifiedPerformanceRow[]>> {
  const byPlayer: Record<string, VerifiedPerformanceRow[]> = {}
  for (const id of playerIds) byPlayer[id] = []
  if (playerIds.length === 0) return byPlayer

  const rows = await db.performance.findMany({
    where: { player_id: { in: playerIds }, association_approval_status: 'approved' },
    include: { match: { include: { tournament: { select: { level: true } } } } },
  })

  for (const r of rows) {
    byPlayer[r.player_id].push({
      level: r.match.tournament.level,
      batting_runs: r.batting_runs ?? undefined,
      batting_balls: r.batting_balls ?? undefined,
      batting_dismissed: r.batting_dismissed ?? undefined,
      bowling_overs: r.bowling_overs ?? undefined,
      bowling_wickets: r.bowling_wickets ?? undefined,
      bowling_runs_conceded: r.bowling_runs_conceded ?? undefined,
    })
  }

  return byPlayer
}
