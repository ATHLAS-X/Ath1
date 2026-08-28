/**
 * Documented CricHeroes Sync fixture.
 *
 * The ingest page "Sync now" control POSTs this JSON to /api/ingest with
 * sourceKey `api_sync`. Shape is the api_sync adapter input
 * (`NormalizedIngestPayload`). There is no live CricHeroes call.
 */
import type { NormalizedIngestPayload } from '../types'
import fixture from './cricheroes-sync.json'

export const CRICHEROES_SYNC_FIXTURE = fixture as NormalizedIngestPayload
