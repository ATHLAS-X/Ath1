/**
 * Integration — association staff submit through POST /api/ingest and the
 * new job is listed as pending_review. Approve still writes Match/Performance.
 *
 * Fixtures are unique per file run so they do not collide with the shared
 * athlasx_test seed emails used by other worktrees.
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { encode } from 'next-auth/jwt'
import { randomUUID } from 'node:crypto'
import { testDb, assertIsTestSchema } from '../helpers/test-db'
import { hashPassword } from '@/lib/password'
import { CRICHEROES_SYNC_FIXTURE } from '@/lib/ingest/fixtures/cricheroes-sync'
import { mapCsvToIngestPayload } from '@/lib/ingest/csv-to-payload'

vi.mock('@/lib/db', async () => ({
  db: (await import('../helpers/test-db')).testDb,
}))

const { POST: submit, GET: list } = await import('@/app/api/ingest/route')

const SECRET = process.env.NEXTAUTH_SECRET!
const DEV_PASSWORD = 'athlasx-dev-password'

async function authedRequest(
  userId: string,
  role: string,
  opts: { method?: string; body?: unknown } = {},
) {
  const jwt = await encode({
    token: { id: userId, role, email: `${userId}@test.local` },
    secret: SECRET,
  })
  return new NextRequest('http://test.local/api/ingest', {
    method: opts.method ?? 'GET',
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    headers: {
      cookie: `next-auth.session-token=${jwt}`,
      ...(opts.body === undefined ? {} : { 'content-type': 'application/json' }),
    },
  })
}

const CSV = [
  'tournamentName,season,format,ageCategory,level,matchDate,homeTeam,awayTeam,venue,full_name,dob,district,academy_raw,batting_runs,batting_balls,batting_dismissed,bowling_overs,bowling_wickets,bowling_runs_conceded',
  'U19 District Trophy,2026,T20,U19,district,2026-01-15,Kanpur XI,Lucknow XI,Green Park,Adult Player,2000-01-01,Kanpur,Kanpur Cricket Academy,45,30,true,,,',
].join('\n')

const runId = randomUUID()

let associationId: string
let staffUserId: string
let playerUserId: string

async function setupFixtures() {
  const staffHash = await hashPassword(DEV_PASSWORD)
  const playerHash = await hashPassword(DEV_PASSWORD)
  const suffix = randomUUID()
  const created = await testDb.$transaction(async (tx) => {
    const association = await tx.association.create({
      data: { name: `Ingest Submit ${runId}-${suffix}`, type: 'district', state: 'Uttar Pradesh' },
    })
    const staff = await tx.user.create({
      data: {
        email: `staff-${suffix}@test.local`,
        role: 'association',
        password_hash: staffHash,
      },
    })
    await tx.associationStaff.create({
      data: { association_id: association.id, user_id: staff.id, is_lead: true },
    })
    const player = await tx.user.create({
      data: {
        email: `player-${suffix}@test.local`,
        role: 'player',
        password_hash: playerHash,
      },
    })
    await tx.playerProfile.create({
      data: {
        full_name: 'Adult Player',
        dob: new Date('2000-01-01'),
        district: 'Kanpur',
        state: 'Uttar Pradesh',
        playing_role: 'Batsman',
        claim_status: 'unclaimed',
        consent_status: 'not_required',
        profile_source: 'ingest',
        association_id: association.id,
      },
    })
    return { associationId: association.id, staffUserId: staff.id, playerUserId: player.id }
  })
  associationId = created.associationId
  staffUserId = created.staffUserId
  playerUserId = created.playerUserId
}

beforeAll(async () => {
  await assertIsTestSchema()
  let last: unknown
  for (let i = 0; i < 4; i++) {
    try {
      await setupFixtures()
      return
    } catch (e) {
      last = e
      await new Promise((r) => setTimeout(r, 400 * (i + 1)))
    }
  }
  throw last
})
afterAll(async () => {
  await testDb.$disconnect()
})

beforeEach(async () => {
  if (!staffUserId || !associationId) return
  const row = await testDb.associationStaff.findFirst({
    where: { user_id: staffUserId, association_id: associationId },
  })
  if (!row) await setupFixtures()
})

describe.sequential('POST /api/ingest', () => {
  it('creates a pending_review job that GET lists for association staff', async () => {
    const payload = {
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
          dob: '2000-01-01',
          district: 'Kanpur',
          academy_raw: 'Kanpur Cricket Academy',
          batting_runs: 45,
          batting_balls: 30,
        },
      ],
    }

    const postRes = await submit(
      await authedRequest(staffUserId, 'association', {
        method: 'POST',
        body: {
          associationId,
          sourceKey: 'api_sync',
          payload,
        },
      }),
    )
    const postBody = await postRes.json()
    expect(postRes.status, JSON.stringify(postBody)).toBe(200)
    const { job } = postBody
    expect(job.status).toBe('pending_review')
    expect(job.tournament).toBe('U19 District Trophy')
    expect(job.player_rows).toBe(1)
    expect(job.association_id).toBe(associationId)

    const getRes = await list(await authedRequest(staffUserId, 'association'))
    expect(getRes.status).toBe(200)
    const listed = await getRes.json()
    expect(listed.jobs.some((j: { id: string }) => j.id === job.id)).toBe(true)
    expect(listed.associationId).toBe(associationId)
  })

  it('rejects an anonymous caller', async () => {
    const res = await submit(
      new NextRequest('http://test.local/api/ingest', {
        method: 'POST',
        body: JSON.stringify({
          associationId,
          sourceKey: 'api_sync',
          payload: { tournamentName: 'X' },
        }),
        headers: { 'content-type': 'application/json' },
      }),
    )
    expect(res.status).toBe(401)
  })

  it('rejects a player role', async () => {
    const res = await submit(
      await authedRequest(playerUserId, 'player', {
        method: 'POST',
        body: {
          associationId,
          sourceKey: 'api_sync',
          payload: { tournamentName: 'X' },
        },
      }),
    )
    expect(res.status).toBe(403)
  })

  it('rejects an association the caller is not scoped to', async () => {
    const other = await testDb.association.create({
      data: { name: `Other ${runId}`, type: 'district', state: 'Maharashtra' },
    })
    const res = await submit(
      await authedRequest(staffUserId, 'association', {
        method: 'POST',
        body: {
          associationId: other.id,
          sourceKey: 'api_sync',
          payload: { tournamentName: 'X' },
        },
      }),
    )
    expect(res.status).toBe(403)
  })

  it('rejects an unknown sourceKey', async () => {
    const res = await submit(
      await authedRequest(staffUserId, 'association', {
        method: 'POST',
        body: {
          associationId,
          sourceKey: 'not_a_source',
          payload: { tournamentName: 'X' },
        },
      }),
    )
    expect(res.status).toBe(400)
  })

  it('creates a pending_review job from a CSV mapped into excel_mapper', async () => {
    const payload = mapCsvToIngestPayload(CSV)
    const res = await submit(
      await authedRequest(staffUserId, 'association', {
        method: 'POST',
        body: {
          associationId,
          sourceKey: 'excel_mapper',
          payload,
        },
      }),
    )
    const body = await res.json()
    expect(res.status, JSON.stringify(body)).toBe(200)
    expect(body.job.status).toBe('pending_review')
    expect(body.job.method).toBe('excel_mapper')
    expect(body.job.player_rows).toBe(1)
  })

  it('lists a CricHeroes fixture submit as pending_review', async () => {
    const postRes = await submit(
      await authedRequest(staffUserId, 'association', {
        method: 'POST',
        body: {
          associationId,
          sourceKey: 'api_sync',
          payload: CRICHEROES_SYNC_FIXTURE,
        },
      }),
    )
    const postBody = await postRes.json()
    expect(postRes.status, JSON.stringify(postBody)).toBe(200)
    expect(postBody.job.status).toBe('pending_review')
    expect(postBody.job.method).toBe('api_sync')
    expect(postBody.job.player_rows).toBe(2)
  })
})
