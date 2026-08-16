/**
 * Ported from feat/w1-w8-and-association-auth's lib/ingest/types.ts — the
 * shape is re-targeted at this codebase's field names (full_name, not
 * player_name_raw) and stored as a plain JSON payload on IngestJob rather
 * than DB columns, since this schema has no matches/match_performances
 * tables of its own to normalize into ahead of approval.
 */

export type IngestSourceKey = 'api_sync' | 'structured_parser' | 'ocr' | 'excel_mapper'

export interface NormalizedPerformanceRow {
  full_name: string
  dob: string | null // ISO date
  district: string | null
  academy_raw: string | null
  batting_runs?: number
  batting_balls?: number
  batting_dismissed?: boolean
  bowling_overs?: number
  bowling_wickets?: number
  bowling_runs_conceded?: number
}

export interface NormalizedIngestPayload {
  tournamentName: string
  season: string
  format: 'T20' | 'ODI' | 'Test' | 'T10'
  ageCategory: string
  level: 'local' | 'district' | 'state' | 'national'
  matchDate: string // ISO date
  homeTeam: string
  awayTeam: string
  venue: string
  performances: NormalizedPerformanceRow[]
}

export interface IngestSourceResult {
  payload: NormalizedIngestPayload
  confidence: number
}

export interface IngestSource {
  key: IngestSourceKey
  normalize(input: unknown): IngestSourceResult
}
