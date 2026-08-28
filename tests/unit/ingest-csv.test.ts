/**
 * Unit — CSV mapped into the existing excel_mapper adapter payload.
 * No spreadsheet product: documented headers in, NormalizedIngestPayload out.
 */
import { describe, it, expect } from 'vitest'
import { mapCsvToIngestPayload } from '@/lib/ingest/csv-to-payload'
import { excelMapperSource } from '@/lib/ingest/sources/excel-mapper'

const CSV = [
  'tournamentName,season,format,ageCategory,level,matchDate,homeTeam,awayTeam,venue,full_name,dob,district,academy_raw,batting_runs,batting_balls,batting_dismissed,bowling_overs,bowling_wickets,bowling_runs_conceded',
  'U19 District Trophy,2026,T20,U19,district,2026-01-15,Kanpur XI,Lucknow XI,Green Park,Adult Player,2000-01-01,Kanpur,Kanpur Cricket Academy,45,30,true,,,',
  'U19 District Trophy,2026,T20,U19,district,2026-01-15,Kanpur XI,Lucknow XI,Green Park,Brand New Player,2003-06-15,Lucknow,Lucknow Cricket Academy,,,,4,2,22',
].join('\n')

describe('mapCsvToIngestPayload', () => {
  it('maps a documented CSV into the excel_mapper payload', () => {
    const mapped = mapCsvToIngestPayload(CSV)

    expect(mapped).toEqual({
      tournamentName: 'U19 District Trophy',
      season: '2026',
      format: 'T20',
      ageCategory: 'U19',
      level: 'district',
      matchDate: '2026-01-15',
      homeTeam: 'Kanpur XI',
      awayTeam: 'Lucknow XI',
      venue: 'Green Park',
      mappingConfidence: 1,
      performances: [
        {
          full_name: 'Adult Player',
          dob: '2000-01-01',
          district: 'Kanpur',
          academy_raw: 'Kanpur Cricket Academy',
          batting_runs: 45,
          batting_balls: 30,
          batting_dismissed: true,
        },
        {
          full_name: 'Brand New Player',
          dob: '2003-06-15',
          district: 'Lucknow',
          academy_raw: 'Lucknow Cricket Academy',
          bowling_overs: 4,
          bowling_wickets: 2,
          bowling_runs_conceded: 22,
        },
      ],
    })

    const { payload } = excelMapperSource.normalize(mapped)
    expect(payload.tournamentName).toBe('U19 District Trophy')
    expect(payload.performances).toHaveLength(2)
  })
})
