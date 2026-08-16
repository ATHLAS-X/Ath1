import type { IngestSource, IngestSourceResult } from '../types'
import { payloadCompleteness, roundConfidence } from '../confidence'

/** Excel/CSV register uploads — column-mapping confidence stands in for
 *  how much of the header mapping was auto-guessed vs. exact-matched.
 *  Ported from lib/ingest/sources/excel-register.ts. */
export const excelMapperSource: IngestSource = {
  key: 'excel_mapper',
  normalize(input: unknown): IngestSourceResult {
    const body = input as Record<string, unknown>
    const mappingConfidence = typeof body.mappingConfidence === 'number' ? body.mappingConfidence : 0.7

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
    const rowParseCleanliness = payload.performances.length > 0 ? 1 : 0
    return {
      payload,
      confidence: roundConfidence(0.5 * completeness + 0.3 * mappingConfidence + 0.2 * rowParseCleanliness),
    }
  },
}
