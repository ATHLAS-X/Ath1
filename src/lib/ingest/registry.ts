import type { IngestSource, IngestSourceKey } from './types'
import { apiSyncSource } from './sources/api-sync'
import { structuredScorecardSource } from './sources/structured-scorecard'
import { ocrSource } from './sources/ocr'
import { excelMapperSource } from './sources/excel-mapper'

const REGISTRY: Record<IngestSourceKey, IngestSource> = {
  api_sync: apiSyncSource,
  structured_parser: structuredScorecardSource,
  ocr: ocrSource,
  excel_mapper: excelMapperSource,
}

export function resolveIngestSource(key: IngestSourceKey): IngestSource {
  const source = REGISTRY[key]
  if (!source) throw new Error(`Unknown ingest source: ${key}`)
  return source
}
