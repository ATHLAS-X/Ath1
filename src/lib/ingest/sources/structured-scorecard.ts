import type { IngestSource, IngestSourceResult } from '../types'
import { payloadCompleteness, roundConfidence } from '../confidence'

/** Digital scorecard exports — weighted on completeness plus how cleanly
 *  the payload parsed against the expected shape. Ported from
 *  lib/ingest/sources/digital-scorecard.ts. */
export const structuredScorecardSource: IngestSource = {
  key: 'structured_parser',
  normalize(input: unknown): IngestSourceResult {
    const body = input as Record<string, unknown>
    let schemaValidationScore = 1.0
    const requiredTop = ['tournamentName', 'season', 'matchDate', 'homeTeam', 'awayTeam']
    for (const k of requiredTop) if (!(k in body)) schemaValidationScore = 0.6

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
    if (payload.performances.length === 0) schemaValidationScore = Math.min(schemaValidationScore, 0)

    const completeness = payloadCompleteness(payload)
    return { payload, confidence: roundConfidence(0.7 * completeness + 0.3 * schemaValidationScore) }
  },
}
