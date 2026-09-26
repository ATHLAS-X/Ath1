/**
 * Regression test: GET/POST on the academy-matching identity-resolution
 * queue previously only checked requireAuth (any authenticated role could
 * read or mutate it). Fixed to require ['association', 'athlasx_ops'], same
 * gate as the direct analog ingest/[id]/decide.
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import { testDb, resetDb, seedFixtures, assertIsTestSchema, type Fixtures } from '../helpers/test-db'
import { getAsUser, postAsUser } from '../helpers/auth'

vi.mock('@/lib/db', async () => ({
  db: (await import('../helpers/test-db')).testDb,
}))

const { GET } = await import('@/app/api/academy-matching/route')
const { POST: confirmCandidate } = await import('@/app/api/academy-matching/[id]/confirm/route')
const { POST: rejectCandidate } = await import('@/app/api/academy-matching/[id]/reject/route')

let fx: Fixtures
let candidateId: string

beforeAll(async () => {
  await assertIsTestSchema()
})
beforeEach(async () => {
  await resetDb()
  fx = await seedFixtures()

  const candidate = await testDb.academyMatchCandidate.create({
    data: { raw_string: 'Some Cricket Academy', source: 'api_sync', status: 'unmatched' },
  })
  candidateId = candidate.id
})
afterAll(async () => {
  await resetDb()
  await testDb.$disconnect()
})

describe('Academy matching queue — role-gated, not just authenticated', () => {
  it('rejects a player (any authenticated role) from listing the queue', async () => {
    const req = await getAsUser('http://test.local/api/academy-matching', fx.adult.id, 'player')
    const res = await GET(req)
    expect(res.status).toBe(403)
  })

  it('rejects a player from confirming a candidate', async () => {
    const req = await postAsUser(`http://test.local/api/academy-matching/${candidateId}/confirm`, fx.adult.id, 'player', {})
    const res = await confirmCandidate(req, { params: { id: candidateId } })
    expect(res.status).toBe(403)

    const unchanged = await testDb.academyMatchCandidate.findUnique({ where: { id: candidateId } })
    expect(unchanged?.status).toBe('unmatched')
  })

  it('rejects a coach from rejecting a candidate', async () => {
    const coachUser = await testDb.user.create({
      data: { email: 'coach-role-test@test.local', role: 'coach', password_hash: 'x' },
    })
    const req = await postAsUser(`http://test.local/api/academy-matching/${candidateId}/reject`, coachUser.id, 'coach', {})
    const res = await rejectCandidate(req, { params: { id: candidateId } })
    expect(res.status).toBe(403)

    const unchanged = await testDb.academyMatchCandidate.findUnique({ where: { id: candidateId } })
    expect(unchanged?.status).toBe('unmatched')
  })

  it('allows association staff to list and reject', async () => {
    const listReq = await getAsUser('http://test.local/api/academy-matching', fx.associationStaffUser.id, 'association')
    const listRes = await GET(listReq)
    expect(listRes.status).toBe(200)

    const rejectReq = await postAsUser(`http://test.local/api/academy-matching/${candidateId}/reject`, fx.associationStaffUser.id, 'association', {})
    const rejectRes = await rejectCandidate(rejectReq, { params: { id: candidateId } })
    expect(rejectRes.status).toBe(200)

    const updated = await testDb.academyMatchCandidate.findUnique({ where: { id: candidateId } })
    expect(updated?.status).toBe('rejected')
  })
})
