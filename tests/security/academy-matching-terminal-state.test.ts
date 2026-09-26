/**
 * Security/regression — terminal-state guard on
 * POST /api/academy-matching/[id]/{confirm,reject}.
 *
 * Before this guard, a candidate could be confirmed or rejected more than
 * once: a second confirm pushed the same raw string into
 * academy.name_variants again, and a reject-after-confirm silently flipped a
 * confirmed match back to rejected. GET /api/academy-matching's own queue
 * query (status IN ('unmatched','suggested')) is the evidence this was never
 * intended: 'confirmed'/'rejected' are the two states a candidate is decided
 * INTO, never decided FROM again.
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import { testDb, resetDb, assertIsTestSchema } from '../helpers/test-db'
import { postAsUser } from '../helpers/auth'

vi.mock('@/lib/db', async () => ({
  db: (await import('../helpers/test-db')).testDb,
}))

const { POST: confirm } = await import('@/app/api/academy-matching/[id]/confirm/route')
const { POST: reject } = await import('@/app/api/academy-matching/[id]/reject/route')

const URL = 'http://test.local/api'

let academyId: string
let staffA: string
let staffB: string

beforeAll(async () => { await assertIsTestSchema() })

beforeEach(async () => {
  await resetDb()
  const academy = await testDb.academy.create({
    data: { name: 'Terminal State Test Academy', district: 'Kanpur', state: 'UP', players_at_district_plus: 0 },
  })
  academyId = academy.id
  const a = await testDb.user.create({ data: { email: 'terminal-staff-a@test.local', role: 'association', password_hash: 'x' } })
  staffA = a.id
  const b = await testDb.user.create({ data: { email: 'terminal-staff-b@test.local', role: 'association', password_hash: 'x' } })
  staffB = b.id
})

afterAll(async () => { await resetDb(); await testDb.$disconnect() })

async function freshCandidate() {
  return testDb.academyMatchCandidate.create({
    data: { raw_string: 'Terminal Test Acad', source: 'test', suggested_academy_id: academyId, status: 'suggested' },
  })
}

describe('academy-matching confirm — terminal state', () => {
  it('1. first confirm succeeds', async () => {
    const candidate = await freshCandidate()
    const res = await confirm(await postAsUser(URL, staffA, 'association', {}), { params: { id: candidate.id } })
    expect(res.status).toBe(200)
  })

  it('2. second confirm on the same candidate is rejected (409) and does not grow name_variants again', async () => {
    const candidate = await freshCandidate()
    await confirm(await postAsUser(URL, staffA, 'association', {}), { params: { id: candidate.id } })
    const second = await confirm(await postAsUser(URL, staffB, 'association', {}), { params: { id: candidate.id } })
    expect(second.status).toBe(409)
    const academy = await testDb.academy.findUniqueOrThrow({ where: { id: academyId } })
    expect(academy.name_variants.filter((v) => v === 'Terminal Test Acad')).toHaveLength(1)
  })

  it('3. reject after confirm is also rejected (409) — confirmed is terminal', async () => {
    const candidate = await freshCandidate()
    await confirm(await postAsUser(URL, staffA, 'association', {}), { params: { id: candidate.id } })
    const afterReject = await reject(await postAsUser(URL, staffB, 'association', {}), { params: { id: candidate.id } })
    expect(afterReject.status).toBe(409)
  })
})

describe('academy-matching reject — terminal state', () => {
  it('4. first reject succeeds', async () => {
    const candidate = await freshCandidate()
    const res = await reject(await postAsUser(URL, staffA, 'association', {}), { params: { id: candidate.id } })
    expect(res.status).toBe(200)
  })

  it('5. confirm after reject is rejected (409) — rejected is terminal', async () => {
    const candidate = await freshCandidate()
    await reject(await postAsUser(URL, staffA, 'association', {}), { params: { id: candidate.id } })
    const afterConfirm = await confirm(await postAsUser(URL, staffB, 'association', {}), { params: { id: candidate.id } })
    expect(afterConfirm.status).toBe(409)
  })
})

describe('the first decision is never silently overwritten', () => {
  it('6. reviewed_by/reviewed_at/status remain from the first decision after a blocked second attempt', async () => {
    const candidate = await freshCandidate()
    await confirm(await postAsUser(URL, staffA, 'association', {}), { params: { id: candidate.id } })
    const afterFirst = await testDb.academyMatchCandidate.findUniqueOrThrow({ where: { id: candidate.id } })
    expect(afterFirst.reviewed_by).toBe(staffA)

    await reject(await postAsUser(URL, staffB, 'association', {}), { params: { id: candidate.id } })
    const afterBlockedSecond = await testDb.academyMatchCandidate.findUniqueOrThrow({ where: { id: candidate.id } })
    expect(afterBlockedSecond.reviewed_by).toBe(staffA)
    expect(afterBlockedSecond.reviewed_at?.getTime()).toBe(afterFirst.reviewed_at?.getTime())
    expect(afterBlockedSecond.status).toBe('confirmed')
  })

  it('7. a nonexistent candidate is still a plain 404, not a 409', async () => {
    const res = await confirm(await postAsUser(URL, staffA, 'association', {}), { params: { id: '00000000-0000-0000-0000-000000000000' } })
    expect(res.status).toBe(404)
  })
})
