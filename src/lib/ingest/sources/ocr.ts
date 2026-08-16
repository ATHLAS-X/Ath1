import type { IngestSource, IngestSourceResult } from '../types'
import { payloadCompleteness, roundConfidence } from '../confidence'

/** OCR-scanned scoresheets — lowest-trust source by construction (max 0.9
 *  pre-review). ocrEngineConfidence is a caller-supplied input (from
 *  whatever OCR step ran before this), not computed here. humanReviewed
 *  starts false — a human reviewer bumping the IngestJob's status is a
 *  separate, later action, not part of normalize() itself. Ported from
 *  lib/ingest/sources/ocr-scan.ts. */
export const ocrSource: IngestSource = {
  key: 'ocr',
  normalize(input: unknown): IngestSourceResult {
    const body = input as Record<string, unknown>
    const ocrEngineConfidence = typeof body.ocrEngineConfidence === 'number' ? body.ocrEngineConfidence : 0.5

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
    const humanReviewed = 0 // bumped to 1 by a review action, not here
    return {
      payload,
      confidence: roundConfidence(0.6 * ocrEngineConfidence + 0.3 * completeness + 0.1 * humanReviewed),
    }
  },
}
