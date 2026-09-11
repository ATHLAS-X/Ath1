/**
 * Integration — the scout pending-verification gate
 * (src/lib/scout/verification-gate.ts), mirroring
 * tests/integration/association-verification-gate.test.ts's structure.
 *
 * A new scout account's ScoutProfile.verification_status defaults
 * 'pending' and must have ZERO real candidate access until AthlasX Ops
 * approves it. Proof: seed a pending scout + a real franchise_scout-
 * visible adult player, confirm the pending scout's own session sees no
 * candidates through the real API route, flip verification_status to
 * 'approved' directly (same positive-control pattern the association
 * suite uses) and confirm the SAME session now sees the player — proving
 * the negative above was the gate actually working, not a broken
 * fixture. Also proves the Ops approval route itself performs that same
 * flip for real, and that 'rejected' is treated the same as 'pending'.
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import { testDb, resetDb, assertIsTestSchema } from '../helpers/test-db'
import { getAsUser, patchAsUser } from '../helpers/auth'

vi.mock('@/lib/db', async () => ({
  db: (await import('../helpers/test-db')).testDb,
}))

vi.mock('@/lib/feature-flags', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/feature-flags')>()),
  FRANCHISE_SCOUT_ENABLED: true,
}))

const { GET: candidates } = await import('@/app/api/scout/candidates/route')
const { PATCH: setVerification } = await import('@/app/api/ops/scouts/[id]/verification/route')
const { GET: pendingScouts } = await import('@/app/api/ops/scouts/pending/route')

const URL = 'http://test.local/api/scout/candidates'

beforeAll(async () => { await assertIsTestSchema() })
beforeEach(async () => { await resetDb() })
afterAll(async () => { await resetDb(); await testDb.$disconnect() })

async function seedPendingScout(label: string) {
  const user = await testDb.user.create({
    data: { email: `scout-${label}@test.local`, role: 'scout', password_hash: 'x' },
  })
  const profile = await testDb.scoutProfile.create({
    data: { user_id: user.id, org_name: `${label} Franchise`, org_type: 'franchise' },
  })
  return { user, profile }
}

async function seedFranchiseScoutVisiblePlayer() {
  return testDb.playerProfile.create({
    data: {
      full_name: 'Verified Adult Player', dob: new Date('2000-01-01'), district: 'Test District', state: 'Uttar Pradesh',
      claim_status: 'unclaimed', consent_status: 'not_required', profile_source: 'ingest',
      visibility_tier: 'franchise_scout',
    },
  })
}

describe('GET /api/scout/candidates — pending gate', () => {
  it('a pending scout sees no candidates, then sees them once approved', async () => {
    const { user, profile } = await seedPendingScout('gate')
    const player = await seedFranchiseScoutVisiblePlayer()
    expect(profile.verification_status).toBe('pending') // sanity re-check before the real assertions

    const pendingRes = await candidates(await getAsUser(URL, user.id, 'scout'))
    expect(pendingRes.status).toBe(200)
    const pendingBody = await pendingRes.json()
    expect(pendingBody.candidates).toEqual([])

    await testDb.scoutProfile.update({ where: { id: profile.id }, data: { verification_status: 'approved' } })

    const approvedRes = await candidates(await getAsUser(URL, user.id, 'scout'))
    const approvedBody = await approvedRes.json()
    expect(approvedBody.candidates.map((c: { id: string }) => c.id)).toContain(player.id)
  })

  it('a rejected scout is treated the same as pending — still no access', async () => {
    const { user, profile } = await seedPendingScout('rejected')
    await seedFranchiseScoutVisiblePlayer()
    await testDb.scoutProfile.update({ where: { id: profile.id }, data: { verification_status: 'rejected' } })

    const res = await candidates(await getAsUser(URL, user.id, 'scout'))
    const body = await res.json()
    expect(body.candidates).toEqual([])
  })

  it('athlasx_ops is unrestricted regardless of any ScoutProfile', async () => {
    const player = await seedFranchiseScoutVisiblePlayer()
    const ops = await testDb.user.create({
      data: { email: 'ops-scout-gate@test.local', role: 'athlasx_ops', password_hash: 'x' },
    })

    const res = await candidates(await getAsUser(URL, ops.id, 'athlasx_ops'))
    const body = await res.json()
    expect(body.candidates.map((c: { id: string }) => c.id)).toContain(player.id)
  })
})

describe('the Ops approval surface', () => {
  it('lists pending scouts and lets athlasx_ops approve one for real', async () => {
    const { user, profile } = await seedPendingScout('ops-flow')
    const ops = await testDb.user.create({
      data: { email: 'ops-approver@test.local', role: 'athlasx_ops', password_hash: 'x' },
    })

    const listRes = await pendingScouts(await getAsUser('http://test.local/api/ops/scouts/pending', ops.id, 'athlasx_ops'))
    expect(listRes.status).toBe(200)
    const listBody = await listRes.json()
    expect(listBody.scouts.map((s: { id: string }) => s.id)).toContain(profile.id)

    const patchRes = await setVerification(
      await patchAsUser(`http://test.local/api/ops/scouts/${profile.id}/verification`, ops.id, 'athlasx_ops', { verification_status: 'approved' }),
      { params: Promise.resolve({ id: profile.id }) },
    )
    expect(patchRes.status).toBe(200)

    const updated = await testDb.scoutProfile.findUniqueOrThrow({ where: { id: profile.id } })
    expect(updated.verification_status).toBe('approved')

    // The same scout's own session now genuinely sees candidates — not
    // just a DB row flipped, but the real gate honoring it.
    const player = await seedFranchiseScoutVisiblePlayer()
    const res = await candidates(await getAsUser(URL, user.id, 'scout'))
    const body = await res.json()
    expect(body.candidates.map((c: { id: string }) => c.id)).toContain(player.id)
  })

  it('a non-ops caller cannot approve a scout', async () => {
    const { profile } = await seedPendingScout('unauthorized')
    const otherScout = await testDb.user.create({
      data: { email: 'other-scout@test.local', role: 'scout', password_hash: 'x' },
    })

    const res = await setVerification(
      await patchAsUser(`http://test.local/api/ops/scouts/${profile.id}/verification`, otherScout.id, 'scout', { verification_status: 'approved' }),
      { params: Promise.resolve({ id: profile.id }) },
    )
    expect(res.status).toBe(403)

    const unchanged = await testDb.scoutProfile.findUniqueOrThrow({ where: { id: profile.id } })
    expect(unchanged.verification_status).toBe('pending')
  })
})
