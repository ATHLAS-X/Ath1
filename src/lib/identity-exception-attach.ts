import type { IdentityException, Prisma, PrismaClient } from '@prisma/client'
import type { NormalizedPerformanceRow } from '@/lib/ingest/types'

type DbClient = PrismaClient | Prisma.TransactionClient

/**
 * Writes the Performance that ingest approve skipped when identity was
 * ambiguous. Confirm / split / merge all attach through this so the
 * snapshot is applied once, onto exactly one player, without rewriting
 * anyone else's existing history.
 */
export async function attachSkippedPerformance(
  client: DbClient,
  exception: IdentityException,
  playerId: string,
) {
  if (!exception.match_id || exception.performance_snapshot == null) {
    throw new AttachSnapshotMissingError()
  }

  const match = await client.match.findUnique({ where: { id: exception.match_id } })
  if (!match) {
    throw new AttachSnapshotMissingError()
  }

  const row = exception.performance_snapshot as Partial<NormalizedPerformanceRow>

  return client.performance.create({
    data: {
      match_id: match.id,
      player_id: playerId,
      batting_runs: row.batting_runs,
      batting_balls: row.batting_balls,
      batting_dismissed: row.batting_dismissed,
      bowling_overs: row.bowling_overs,
      bowling_wickets: row.bowling_wickets,
      bowling_runs_conceded: row.bowling_runs_conceded,
      source: match.source,
      ingest_method: match.ingest_method,
      confidence_score: match.confidence,
    },
  })
}

export class AttachSnapshotMissingError extends Error {
  constructor() {
    super('Exception is missing match identity or a performance snapshot')
    this.name = 'AttachSnapshotMissingError'
  }
}
