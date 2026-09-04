/**
 * Integration — /api/grading/session Quick View data source (T3a fix).
 *
 * The Quick View card used to be built from `seedPerformances()`, a
 * deterministic-but-fake mock generator keyed off the player id — no real
 * Performance row ever backed it, and an association-pending (unapproved)
 * scorecard would have scored identically to an approved one because the
 * mock didn't consult the DB at all. This proves the session endpoint now
 * returns each player's real, association-APPROVED Performance rows
 * (joined to their Match's Tournament level), excludes pending/unapproved
 * ones, and returns an empty list for a player with no match history —
 * never a fabricated number.
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import {
  testDb, resetDb, seedFixtures, assertIsTestSchema, type Fixtures,
} from '../helpers/test-db'
import { getAsUser } from '../helpers/auth'

vi.mock('@/lib/db', async () => ({
  db: (await import('../helpers/test-db')).testDb,
}))

const { GET: gradingSession } = await import('@/app/api/grading/session/route')

const URL = 'http://test.local/api'
let fx: Fixtures

beforeAll(async () => { await assertIsTestSchema() })

beforeEach(async () => {
  await resetDb()
  fx = await seedFixtures()
})

afterAll(async () => {
  await resetDb()
  await testDb.$disconnect()
})

async function makeMatch(approved: boolean) {
  const tournament = await testDb.tournament.create({
    data: {
      association_id: fx.association.id,
      name: 'District T20 Cup',
      season: '2026',
      format: 'T20',
      age_category: 'U19',
      level: 'district',
      start_date: new Date('2026-01-01'),
    },
  })
  return testDb.match.create({
    data: {
      tournament_id: tournament.id,
      date: new Date('2026-01-05'),
      home_team: 'Kanpur XI',
      away_team: 'Lucknow XI',
      venue: 'Green Park',
      source: 'test-fixture',
      confidence: 1,
      ingest_method: 'manual',
      association_approval_status: approved ? 'approved' : 'pending',
    },
  })
}

describe('grading/session — Quick View built from real Performance rows', () => {
  it('includes an association-approved performance', async () => {
    const match = await makeMatch(true)
    await testDb.performance.create({
      data: {
        match_id: match.id,
        player_id: fx.adult.id,
        batting_runs: 62,
        batting_balls: 40,
        batting_dismissed: true,
        source: 'test-fixture',
        ingest_method: 'manual',
        confidence_score: 1,
        association_approval_status: 'approved',
      },
    })

    const res = await gradingSession(await getAsUser(URL, fx.chair.id, 'selection_panel'))
    expect(res.status).toBe(200)
    const body = await res.json()
    const player = body.session.players.find((p: { id: string }) => p.id === fx.adult.id)

    expect(player.performances).toHaveLength(1)
    expect(player.performances[0]).toMatchObject({ level: 'district', batting_runs: 62, batting_balls: 40 })
  })

  it('excludes a performance still pending association approval', async () => {
    const match = await makeMatch(true) // match approved, performance row is not
    await testDb.performance.create({
      data: {
        match_id: match.id,
        player_id: fx.adult.id,
        batting_runs: 99,
        batting_balls: 50,
        source: 'test-fixture',
        ingest_method: 'manual',
        confidence_score: 1,
        association_approval_status: 'pending',
      },
    })

    const res = await gradingSession(await getAsUser(URL, fx.chair.id, 'selection_panel'))
    const body = await res.json()
    const player = body.session.players.find((p: { id: string }) => p.id === fx.adult.id)

    expect(player.performances).toHaveLength(0)
  })

  it('returns an empty performance list for a player with no match history — no fabricated stats', async () => {
    const res = await gradingSession(await getAsUser(URL, fx.chair.id, 'selection_panel'))
    const body = await res.json()
    const player = body.session.players.find((p: { id: string }) => p.id === fx.adult.id)

    expect(player.performances).toEqual([])
  })
})
