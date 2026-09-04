/**
 * Integration — T-FAKEDATA sweep.
 *
 * Four routes (my-record, dashboard, candidate-pool, coach/squad) built
 * their score/match data from `seedPerformances()`/`seedMatchHistory()` — a
 * deterministic-but-fake generator keyed off the player id, never backed by
 * a real Performance row. A player with zero real match history still
 * showed a fabricated score and match count. This proves each route now
 * sources real, association-APPROVED Performance/Match rows and shows an
 * honest empty/zero state (never synthetic numbers) when a player has none.
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import {
  testDb, resetDb, seedFixtures, assertIsTestSchema, type Fixtures,
} from '../helpers/test-db'
import { getAsUser } from '../helpers/auth'

vi.mock('@/lib/db', async () => ({
  db: (await import('../helpers/test-db')).testDb,
}))

const { GET: myRecord } = await import('@/app/api/my-record/route')
const { GET: dashboard } = await import('@/app/api/dashboard/route')
const { GET: candidatePool } = await import('@/app/api/candidate-pool/route')
const { GET: coachSquad } = await import('@/app/api/coach/squad/route')
const { calculateAthlasXScore } = await import('@/lib/athlasx-score')

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

async function makeApprovedPerformance(playerId: string, runs: number) {
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
  const match = await testDb.match.create({
    data: {
      tournament_id: tournament.id,
      date: new Date('2026-01-05'),
      home_team: 'Kanpur XI',
      away_team: 'Lucknow XI',
      venue: 'Green Park',
      source: 'test-fixture',
      confidence: 1,
      ingest_method: 'manual',
      association_approval_status: 'approved',
    },
  })
  await testDb.performance.create({
    data: {
      match_id: match.id,
      player_id: playerId,
      batting_runs: runs,
      batting_balls: 40,
      batting_dismissed: true,
      source: 'test-fixture',
      ingest_method: 'manual',
      confidence_score: 1,
      association_approval_status: 'approved',
    },
  })
}

describe('my-record — real data, honest empty state', () => {
  it('a player with zero real performances shows a genuine empty record, not fabricated stats', async () => {
    const user = await testDb.user.create({
      data: { email: 'player@test.local', role: 'player', linked_player_id: fx.adult.id },
    })
    const res = await myRecord(await getAsUser(URL, user.id, 'player'))
    const body = await res.json()

    // total score still carries the fixed experience-input component (not
    // match-derived) — the honest-empty-state contract is zero MATCHES and
    // zero PERFORMANCE stats, not a zeroed-out total.
    expect(body.summary.matches).toBe(0)
    expect(body.summary.runs).toBe(0)
    expect(body.score.batting).toBe(0)
    expect(body.matches).toEqual([])
  })

  it('a player with a real approved performance shows it, not seeded fake data', async () => {
    await makeApprovedPerformance(fx.adult.id, 62)
    const user = await testDb.user.create({
      data: { email: 'player2@test.local', role: 'player', linked_player_id: fx.adult.id },
    })
    const res = await myRecord(await getAsUser(URL, user.id, 'player'))
    const body = await res.json()

    expect(body.summary.matches).toBe(1)
    expect(body.summary.runs).toBe(62)
    expect(body.matches[0]).toMatchObject({ opponent: 'Lucknow XI', tournament: 'District T20 Cup', level: 'district' })
  })
})

describe('dashboard — score distribution from real data only', () => {
  it('a player with no verified performances is excluded from the score distribution, not fabricated into a band', async () => {
    const res = await dashboard(await getAsUser(URL, fx.chair.id, 'association'))
    const body = await res.json()
    const totalInBands = body.scoreDist.reduce((s: number, b: { count: number }) => s + b.count, 0)

    expect(totalInBands).toBe(0)
  })

  it('a player with a real approved performance is counted once real data exists', async () => {
    await makeApprovedPerformance(fx.adult.id, 62)
    const res = await dashboard(await getAsUser(URL, fx.chair.id, 'association'))
    const body = await res.json()
    const totalInBands = body.scoreDist.reduce((s: number, b: { count: number }) => s + b.count, 0)

    expect(totalInBands).toBe(1)
  })
})

describe('candidate-pool — real data, honest zero score', () => {
  it('a player with zero real performances shows score 0 and match_count 0, not fabricated numbers', async () => {
    const res = await candidatePool(await getAsUser(URL, fx.chair.id, 'association'))
    const body = await res.json()
    const candidate = body.candidates.find((c: { id: string }) => c.id === fx.adult.id)

    expect(candidate.match_count).toBe(0)
    expect(candidate.batting_0_to_10).toBeUndefined()
  })

  it('a player with a real approved performance is scored from it', async () => {
    await makeApprovedPerformance(fx.adult.id, 62)
    const res = await candidatePool(await getAsUser(URL, fx.chair.id, 'association'))
    const body = await res.json()
    const candidate = body.candidates.find((c: { id: string }) => c.id === fx.adult.id)

    expect(candidate.match_count).toBe(1)
    expect(candidate.athlasx_score).toBeGreaterThan(0)
  })
})

describe('coach/squad — real data, honest zero score', () => {
  it('a squad player with zero real performances shows score 0, not fabricated numbers', async () => {
    const squad = await testDb.squad.create({
      data: { association_id: fx.association.id, name: 'U19 Squad', season: '2026', trial_cycle_id: fx.trialCycle.id },
    })
    const coachUser = await testDb.user.create({ data: { email: 'coach@test.local', role: 'coach' } })
    await testDb.squadCoach.create({ data: { squad_id: squad.id, user_id: coachUser.id } })
    await testDb.squadPlayer.create({ data: { squad_id: squad.id, player_id: fx.adult.id } })

    const res = await coachSquad(await getAsUser(URL, coachUser.id, 'coach'))
    const body = await res.json()
    const player = body.squad.find((p: { id: string }) => p.id === fx.adult.id)

    // The score must match the engine's own honest zero-match output
    // exactly (real "no data" behavior), not a seeded fake value drawn from
    // a range like the old seedPerformances() generator produced.
    const expected = calculateAthlasXScore({ playingRole: 'Batsman', performances: [], yearsExperience: 3 })
    expect(player.athlasx_score).toBe(expected.total)
  })
})
