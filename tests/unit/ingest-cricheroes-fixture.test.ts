/**
 * Unit — CricHeroes Sync posts this documented JSON fixture through the
 * existing api_sync adapter. No third-party call.
 */
import { describe, it, expect } from 'vitest'
import { CRICHEROES_SYNC_FIXTURE } from '@/lib/ingest/fixtures/cricheroes-sync'
import { apiSyncSource } from '@/lib/ingest/sources/api-sync'

describe('CRICHEROES_SYNC_FIXTURE', () => {
  it('normalizes through api_sync into a pending-review-ready payload', () => {
    const { payload, confidence } = apiSyncSource.normalize(CRICHEROES_SYNC_FIXTURE)

    expect(payload.tournamentName).toBe('CricHeroes Fixture — U19 District Trophy')
    expect(payload.season).toBe('2026')
    expect(payload.format).toBe('T20')
    expect(payload.matchDate).toBe('2026-01-15')
    expect(payload.homeTeam).toBe('Kanpur XI')
    expect(payload.awayTeam).toBe('Lucknow XI')
    expect(payload.performances).toEqual([
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
    ])
    expect(confidence).toBeGreaterThan(0)
  })
})
