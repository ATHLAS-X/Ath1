import type { IngestSource, IngestSourceResult } from '../types'
import { payloadCompleteness, roundConfidence } from '../confidence'

/** API/export sync — structurally trusted (an external platform already
 *  validated types), so weighted mostly on completeness with a small
 *  trust-weight floor. Ported from lib/ingest/sources/api-sync.ts. */
export const apiSyncSource: IngestSource = {
  key: 'api_sync',
  normalize(input: unknown): IngestSourceResult {
    const body = input as Record<string, unknown>
    const payload = {
      tournamentName: String(body.tournamentName ?? ''),
      season: String(body.season ?? ''),
      format: (body.format as 'T20' | 'ODI' | 'Test' | 'T10') ?? 'T20',
      ageCategory: String(body.ageCategory ?? ''),
      level: (body.level as 'local' | 'district' | 'state' | 'national') ?? 'district',
      matchDate: String(body.matchDate ?? ''),
      homeTeam: String(body.homeTeam ?? ''),
      awayTeam: String(body.awayTeam ?? ''),
      venue: String(body.venue ?? ''),
      performances: Array.isArray(body.performances) ? body.performances : [],
    }
    const completeness = payloadCompleteness(payload)
    const confidence = roundConfidence(0.9 * completeness + 0.1 * 1.0)
    return { payload, confidence: Math.max(confidence, completeness >= 0.99 ? 0.75 : confidence) }
  },
}
