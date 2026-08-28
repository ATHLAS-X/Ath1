/**
 * Integration — proves the real W1 write path: approving an IngestJob must
 * actually create Tournament/Match/Performance rows, trigger W2 identity
 * resolution (a real player_id, or a real IdentityException for the
 * ambiguous row), and trigger W8 academy capture (a real
 * AcademyMatchCandidate) — all in one transaction, not just flip a status
 * flag on a bookkeeping row with nothing behind it.
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { encode } from 'next-auth/jwt'
import {
  testDb,
  resetDb,
  seedFixtures,
  assertIsTestSchema,
  type Fixtures,
} from '../helpers/test-db'

vi.mock('@/lib/db', async () => ({
  db: (await import('../helpers/test-db')).testDb,
}))

const { POST: decide } = await import('@/app/api/ingest/[id]/decide/route')

const SECRET = process.env.NEXTAUTH_SECRET!

async function getStaffRequest(userId: string, body: unknown) {
  const jwt = await encode({ token: { id: userId, role: 'association', email: `${userId}@test.local` }, secret: SECRET })
  return new NextRequest('http://test.local/api', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json', cookie: `next-auth.session-token=${jwt}` },
  })
}

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

describe('approving a real ingest job', () => {
  it('creates Tournament/Match/Performance rows and triggers W2 + W8', async () => {
    const job = await testDb.ingestJob.create({
      data: {
        association_id: fx.association.id,
        source: 'api_sync',
        method: 'api_sync',
        tournament: 'U19 District Trophy',
        match_count: 1,
        player_rows: 2,
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
            // Matches the existing seeded fixture exactly — should
            // HIGH_CONFIDENCE auto-attach (W2).
            {
              full_name: 'Adult Player',
              dob: '2000-01-01',
              district: 'Kanpur',
              academy_raw: 'Kanpur Cricket Academy',
              batting_runs: 45,
              batting_balls: 30,
            },
            // No existing candidate anywhere close — should create a new
            // shadow PlayerProfile (W2's NO_MATCH branch).
            {
              full_name: 'Brand New Player',
              dob: '2003-06-15',
              district: 'Lucknow',
              academy_raw: 'Lucknow Cricket Academy',
              bowling_overs: 4,
              bowling_wickets: 2,
            },
          ],
        },
      },
    })

    const res = await decide(await getStaffRequest(fx.chair.id, { decision: 'approved' }), { params: { id: job.id } })
    expect(res.status, 'approve should succeed').toBe(200)
    const body = await res.json()

    expect(body.matchId, 'a Match row should have been created').toBeTruthy()
    expect(body.performancesCreated, 'both performance rows should have resolved to a player').toBe(2)
    expect(body.identityResolved, 'both rows should have resolved (1 auto-attach + 1 new shadow)').toBe(2)
    expect(body.identityAmbiguous, 'no row in this payload should be ambiguous').toBe(0)
    expect(body.academyCandidatesCreated, '2 distinct raw academy strings should each enqueue a candidate').toBe(2)

    const match = await testDb.match.findUnique({ where: { id: body.matchId }, include: { performances: true } })
    expect(match, 'the Match row must actually exist in the database').toBeTruthy()
    expect(match!.source).toBe('api_sync')
    expect(match!.confidence).toBe(0.9)
    expect(match!.association_approval_status).toBe('approved')
    expect(match!.performances.length).toBe(2)
    for (const p of match!.performances) {
      expect(p.source, 'every performance row must carry provenance').toBe('api_sync')
      expect(p.ingest_method).toBe('api_sync')
      expect(p.confidence_score).toBe(0.9)
      expect(p.player_id, 'every performance row must have a real resolved player_id').toBeTruthy()
    }

    const tournament = await testDb.tournament.findUnique({ where: { id: body.tournamentId } })
    expect(tournament, 'the Tournament row must actually exist').toBeTruthy()
    expect(tournament!.association_id).toBe(fx.association.id)

    // W2 really ran, not just returned a count: the matching row attached
    // to the EXISTING seeded player, the new row created a genuinely new one.
    const attachedPerf = match!.performances.find((p) => p.player_id === fx.adult.id)
    expect(attachedPerf, 'the matching row should have attached to the existing seeded player').toBeTruthy()
    const newPerf = match!.performances.find((p) => p.player_id !== fx.adult.id)
    const newPlayer = await testDb.playerProfile.findUnique({ where: { id: newPerf!.player_id } })
    expect(newPlayer?.full_name).toBe('Brand New Player')
    expect(newPlayer?.claim_status).toBe('unclaimed')

    // W8 really ran: real AcademyMatchCandidate rows, not just a count.
    const candidates = await testDb.academyMatchCandidate.findMany({
      where: { raw_string: { in: ['Kanpur Cricket Academy', 'Lucknow Cricket Academy'] } },
    })
    expect(candidates.length, 'both raw academy strings should have real candidate rows').toBe(2)

    const updatedJob = await testDb.ingestJob.findUnique({ where: { id: job.id } })
    expect(updatedJob?.status).toBe('approved')
  })

  it('routes an ambiguous row to IdentityException instead of guessing', async () => {
    // A second player with the SAME name+district as fx.adult but a
    // DIFFERENT dob — name matches, DOB doesn't corroborate, so this must
    // route to AMBIGUOUS rather than picking one.
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
            },
          ],
        },
      },
    })

    const res = await decide(await getStaffRequest(fx.chair.id, { decision: 'approved' }), { params: { id: job.id } })
    const body = await res.json()

    expect(body.identityAmbiguous, 'the two-candidate name match must route to AMBIGUOUS').toBe(1)
    expect(body.identityResolved).toBe(0)
    expect(body.performancesCreated, 'no Performance row should be created for an unresolved player').toBe(0)

    const exceptions = await testDb.identityException.findMany({ where: { raw_name: 'Adult Player' } })
    expect(exceptions.length, 'a real IdentityException row must exist').toBe(1)
    expect(exceptions[0].status).toBe('OPEN')
    expect(exceptions[0].candidate_player_ids.length, 'both name-matching candidates should be listed').toBe(2)
    expect(exceptions[0].match_id, 'the skipped row must keep the match it belonged to').toBe(body.matchId)
    expect(exceptions[0].performance_snapshot).toMatchObject({ batting_runs: 10 })
  })
})
