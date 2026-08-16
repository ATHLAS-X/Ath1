import type { NormalizedIngestPayload, NormalizedPerformanceRow } from './types'

/** Shared across all 4 adapters — fraction of "expected" fields actually
 *  present on a performance row. Ported from lib/ingest/confidence.ts. */
export function completenessScore(row: NormalizedPerformanceRow): number {
  const fields = [row.full_name, row.dob, row.district, row.academy_raw];
  const battingOrBowling = row.batting_runs !== undefined || row.bowling_wickets !== undefined;
  const present = fields.filter((f) => f !== null && f !== undefined && f !== '').length;
  return (present / fields.length) * (battingOrBowling ? 1 : 0.7);
}

export function payloadCompleteness(payload: NormalizedIngestPayload): number {
  if (payload.performances.length === 0) return 0;
  const sum = payload.performances.reduce((acc, r) => acc + completenessScore(r), 0);
  return sum / payload.performances.length;
}

export function roundConfidence(n: number): number {
  return Math.round(Math.min(1, Math.max(0, n)) * 1000) / 1000;
}
