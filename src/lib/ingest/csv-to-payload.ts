/**
 * Maps a documented CSV into the existing excel_mapper adapter payload.
 * Not an Excel product — exact (case-insensitive) headers in, adapter
 * input out. Match-level fields are taken from the first data row.
 */
import type { NormalizedIngestPayload, NormalizedPerformanceRow } from './types'

export const INGEST_CSV_HEADERS = [
  'tournamentName',
  'season',
  'format',
  'ageCategory',
  'level',
  'matchDate',
  'homeTeam',
  'awayTeam',
  'venue',
  'full_name',
  'dob',
  'district',
  'academy_raw',
  'batting_runs',
  'batting_balls',
  'batting_dismissed',
  'bowling_overs',
  'bowling_wickets',
  'bowling_runs_conceded',
] as const

const REQUIRED_HEADERS = ['tournamentName', 'matchDate', 'homeTeam', 'awayTeam', 'full_name'] as const

const NUMERIC_PERFORMANCE_FIELDS = [
  'batting_runs',
  'batting_balls',
  'bowling_overs',
  'bowling_wickets',
  'bowling_runs_conceded',
] as const

export type MappedExcelPayload = NormalizedIngestPayload & { mappingConfidence: number }

export function mapCsvToIngestPayload(csv: string): MappedExcelPayload {
  const rows = parseCsv(csv)
  if (rows.length < 2) {
    throw new Error('CSV must include a header row and at least one player row')
  }

  const headerIndex = new Map<string, number>()
  rows[0].forEach((h, i) => headerIndex.set(h.trim().toLowerCase(), i))
  for (const required of REQUIRED_HEADERS) {
    if (!headerIndex.has(required.toLowerCase())) {
      throw new Error(`CSV is missing required header: ${required}`)
    }
  }

  const cell = (row: string[], header: string): string => {
    const i = headerIndex.get(header.toLowerCase())
    if (i === undefined) return ''
    return (row[i] ?? '').trim()
  }

  const first = rows[1]
  const performances: NormalizedPerformanceRow[] = []
  for (const row of rows.slice(1)) {
    const full_name = cell(row, 'full_name')
    if (!full_name) continue

    const performance: NormalizedPerformanceRow = {
      full_name,
      dob: emptyToNull(cell(row, 'dob')),
      district: emptyToNull(cell(row, 'district')),
      academy_raw: emptyToNull(cell(row, 'academy_raw')),
    }

    const dismissed = parseBoolean(cell(row, 'batting_dismissed'))
    if (dismissed !== undefined) performance.batting_dismissed = dismissed

    for (const field of NUMERIC_PERFORMANCE_FIELDS) {
      const n = parseNumber(cell(row, field))
      if (n !== undefined) performance[field] = n
    }

    performances.push(performance)
  }

  if (performances.length === 0) {
    throw new Error('CSV has no player rows')
  }

  return {
    tournamentName: cell(first, 'tournamentName'),
    season: cell(first, 'season'),
    format: (cell(first, 'format') || 'T20') as NormalizedIngestPayload['format'],
    ageCategory: cell(first, 'ageCategory'),
    level: (cell(first, 'level') || 'district') as NormalizedIngestPayload['level'],
    matchDate: cell(first, 'matchDate'),
    homeTeam: cell(first, 'homeTeam'),
    awayTeam: cell(first, 'awayTeam'),
    venue: cell(first, 'venue'),
    mappingConfidence: 1,
    performances,
  }
}

function emptyToNull(value: string): string | null {
  return value === '' ? null : value
}

function parseNumber(value: string): number | undefined {
  if (value === '') return undefined
  const n = Number(value)
  return Number.isFinite(n) ? n : undefined
}

function parseBoolean(value: string): boolean | undefined {
  if (value === '') return undefined
  const v = value.toLowerCase()
  if (v === 'true' || v === 'yes' || v === '1') return true
  if (v === 'false' || v === 'no' || v === '0') return false
  return undefined
}

/** Minimal RFC 4180-ish parser: commas, quotes, escaped quotes, CRLF. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  const s = text.replace(/^\uFEFF/, '')

  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += c
      }
    } else if (c === '"') {
      inQuotes = true
    } else if (c === ',') {
      row.push(field)
      field = ''
    } else if (c === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else if (c !== '\r') {
      field += c
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ''))
}
