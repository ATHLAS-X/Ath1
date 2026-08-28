/**
 * Integration — identity-exception confirm / split / merge must write the
 * Performance that ingest approve skipped, not only flip status.
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import { NextRequest } from 'next/server'
import {
  testDb,
  resetDb,
  seedFixtures,
  assertIsTestSchema,
  type Fixtures,
} from '../helpers/test-db'
import { postAsUser } from '../helpers/auth'

vi.mock('@/lib/db', async () => ({
  db: (await import('../helpers/test-db')).testDb,
}))

const { POST: decide } = await import('@/app/api/ingest/[id]/decide/route')
const { POST: confirm } = await import('@/app/api/identity-exceptions/[id]/confirm/route')
const { POST: split } = await import('@/app/api/identity-exceptions/[id]/split/route')
const { POST: merge } = await import('@/app/api/identity-exceptions/[id]/merge/route')

let fx: Fixtures

beforeAll(async () => {
  await assertIsTestSchema()
})
beforeEach(async () => {
  await resetDb()
  fx = await seedFixtures()
})
afterAll(async () => {
  await resetDb()
  await testDb.$disconnect()
})

async function openAmbiguousException() {
  await testDb.playerProfile.create({
    data: {
      full_name: 'Adult Player',
      dob: new Date('1999-03-03'),
      district: 'Kanpur',
      state: 'Uttar Pradesh',
      claim_status: 'unclaimed',
      consent_status: 'not_required',
      profile_source: 'ingest',
      association_id: fx.association.id,
    },
  })

  const job = await testDb.ingestJob.create({
    data: {
      association_id: fx.association.id,
      source: 'api_sync',
      method: 'api_sync',
      tournament: 'U19 District Trophy',
      match_count: 1,
      player_rows: 1,
      status: 'pending_review',
      confidence: 0.9,
      raw_payload: {
        tournamentName: 'U19 District Trophy',
        season: '2026',
        format: 'T20',
        ageCategory: 'U19',
        level: 'district',
        matchDate: '2026-01-15',
        homeTeam: 'Kanpur XI',
        awayTeam: 'Lucknow XI',
        venue: 'Green Park',
        performances: [
          {
            full_name: 'Adult Player',
            dob: null,
            district: null,
            academy_raw: null,
            batting_runs: 10,
            bowling_wickets: 2,
          },
        ],
      },
    },
  })

  const res = await decide(
    await postAsUser('http://test.local/api/ingest/decide', fx.associationStaffUser.id, 'association', {
      decision: 'approved',
    }),
    { params: { id: job.id } },
  )
  const body = await res.json()
  expect(res.status, JSON.stringify(body)).toBe(200)
  expect(body.identityAmbiguous).toBe(1)

  const exception = await testDb.identityException.findFirst({
    where: { raw_name: 'Adult Player', status: 'OPEN' },
  })
  expect(exception).toBeTruthy()
  return { exception: exception!, matchId: body.matchId as string }
}

describe('confirming an identity exception', () => {
  it('writes the skipped Performance onto the chosen candidate and marks confirmed', async () => {
    const { exception, matchId } = await openAmbiguousException()

    const res = await confirm(
      await postAsUser(
        `http://test.local/api/identity-exceptions/${exception.id}/confirm`,
        fx.associationStaffUser.id,
        'association',
        { playerId: fx.adult.id },
      ),
      { params: { id: exception.id } },
    )
    const body = await res.json()
    expect(res.status, JSON.stringify(body)).toBe(200)
    expect(body.status).toBe('CONFIRMED')
    expect(body.playerId).toBe(fx.adult.id)

    const performances = await testDb.performance.findMany({ where: { match_id: matchId } })
    expect(performances.length, 'exactly one Performance for the skipped row').toBe(1)
    expect(performances[0].player_id).toBe(fx.adult.id)
    expect(performances[0].batting_runs).toBe(10)
    expect(performances[0].bowling_wickets).toBe(2)

    const updated = await testDb.identityException.findUnique({ where: { id: exception.id } })
    expect(updated?.status).toBe('CONFIRMED')
    expect(updated?.resolved_by_user_id).toBe(fx.associationStaffUser.id)
  })

  it('rejects an unauthenticated caller', async () => {
    const { exception, matchId } = await openAmbiguousException()

    const res = await confirm(
      new NextRequest(`http://test.local/api/identity-exceptions/${exception.id}/confirm`, {
        method: 'POST',
        body: JSON.stringify({ playerId: fx.adult.id }),
        headers: { 'content-type': 'application/json' },
      }),
      { params: { id: exception.id } },
    )
    expect(res.status).toBe(401)

    const performances = await testDb.performance.findMany({ where: { match_id: matchId } })
    expect(performances.length).toBe(0)
    const stillOpen = await testDb.identityException.findUnique({ where: { id: exception.id } })
    expect(stillOpen?.status).toBe('OPEN')
  })

  it('rejects staff of another association', async () => {
    const { exception, matchId } = await openAmbiguousException()
    const otherAssoc = await testDb.association.create({
      data: { name: 'Other District CA', type: 'district', state: 'Maharashtra' },
    })
    const otherStaff = await testDb.user.create({
      data: { email: 'other-staff@test.local', role: 'association' },
    })
    await testDb.associationStaff.create({
      data: { association_id: otherAssoc.id, user_id: otherStaff.id },
    })

    const res = await confirm(
      await postAsUser(
        `http://test.local/api/identity-exceptions/${exception.id}/confirm`,
        otherStaff.id,
        'association',
        { playerId: fx.adult.id },
      ),
      { params: { id: exception.id } },
    )
    expect(res.status).toBe(403)

    const performances = await testDb.performance.findMany({ where: { match_id: matchId } })
    expect(performances.length).toBe(0)
  })
})

describe('splitting an identity exception', () => {
  it('creates a new shadow profile from the raw identity, writes the Performance, and marks split', async () => {
    const { exception, matchId } = await openAmbiguousException()
    const playersBefore = await testDb.playerProfile.count()

    const res = await split(
      await postAsUser(
        `http://test.local/api/identity-exceptions/${exception.id}/split`,
        fx.associationStaffUser.id,
        'association',
        {},
      ),
      { params: { id: exception.id } },
    )
    const body = await res.json()
    expect(res.status, JSON.stringify(body)).toBe(200)
    expect(body.status).toBe('SPLIT')
    expect(body.playerId).toBeTruthy()
    expect(exception.candidate_player_ids).not.toContain(body.playerId)

    const shadow = await testDb.playerProfile.findUnique({ where: { id: body.playerId } })
    expect(shadow?.full_name).toBe('Adult Player')
    expect(shadow?.claim_status).toBe('unclaimed')
    expect(shadow?.user_id).toBeNull()
    expect(shadow?.profile_source).toBe('ingest')
    expect(shadow?.association_id).toBe(fx.association.id)

    const playersAfter = await testDb.playerProfile.count()
    expect(playersAfter).toBe(playersBefore + 1)

    const performances = await testDb.performance.findMany({ where: { match_id: matchId } })
    expect(performances.length).toBe(1)
    expect(performances[0].player_id).toBe(body.playerId)
    expect(performances[0].batting_runs).toBe(10)

    const updated = await testDb.identityException.findUnique({ where: { id: exception.id } })
    expect(updated?.status).toBe('SPLIT')
  })
})

describe('merging an identity exception', () => {
  it('writes the new row onto an explicit surviving candidate and leaves both histories alone', async () => {
    const { exception, matchId } = await openAmbiguousException()
    const otherId = exception.candidate_player_ids.find((id) => id !== fx.adult.id)!
    expect(otherId).toBeTruthy()

    const tournament = await testDb.tournament.create({
      data: {
        association_id: fx.association.id,
        name: 'Prior Trophy',
        season: '2025',
        format: 'T20',
        age_category: 'U19',
        level: 'district',
        start_date: new Date('2025-06-01'),
      },
    })
    const priorMatch = await testDb.match.create({
      data: {
        tournament_id: tournament.id,
        date: new Date('2025-06-01'),
        home_team: 'A',
        away_team: 'B',
        venue: 'Old Ground',
        source: 'api_sync',
        confidence: 0.9,
        ingest_method: 'api_sync',
      },
    })
    await testDb.performance.create({
      data: {
        match_id: priorMatch.id,
        player_id: fx.adult.id,
        batting_runs: 99,
        source: 'api_sync',
        ingest_method: 'api_sync',
        confidence_score: 0.9,
      },
    })
    await testDb.performance.create({
      data: {
        match_id: priorMatch.id,
        player_id: otherId,
        batting_runs: 88,
        source: 'api_sync',
        ingest_method: 'api_sync',
        confidence_score: 0.9,
      },
    })

    const res = await merge(
      await postAsUser(
        `http://test.local/api/identity-exceptions/${exception.id}/merge`,
        fx.associationStaffUser.id,
        'association',
        { playerId: fx.adult.id },
      ),
      { params: { id: exception.id } },
    )
    const body = await res.json()
    expect(res.status, JSON.stringify(body)).toBe(200)
    expect(body.status).toBe('MERGED')
    expect(body.playerId).toBe(fx.adult.id)

    const ingestPerfs = await testDb.performance.findMany({ where: { match_id: matchId } })
    expect(ingestPerfs.length).toBe(1)
    expect(ingestPerfs[0].player_id).toBe(fx.adult.id)
    expect(ingestPerfs[0].batting_runs).toBe(10)

    const adultHistory = await testDb.performance.findMany({
      where: { player_id: fx.adult.id },
      orderBy: { batting_runs: 'asc' },
    })
    expect(adultHistory.map((p) => p.batting_runs)).toEqual([10, 99])

    const otherHistory = await testDb.performance.findMany({ where: { player_id: otherId } })
    expect(otherHistory.length).toBe(1)
    expect(otherHistory[0].batting_runs).toBe(88)
    expect(otherHistory[0].match_id).toBe(priorMatch.id)

    const updated = await testDb.identityException.findUnique({ where: { id: exception.id } })
    expect(updated?.status).toBe('MERGED')
  })
})

