/**
 * Integration — the association self-serve pending-verification gate
 * (docs/AthlasX_Association_SelfServe_Fresh_Build_Prompt.md's Prompt 3).
 *
 * A self-serve submission creates a real account, but that account must
 * have ZERO real association-scoped access until AthlasX Ops approves it.
 * This is the actual proof: create a pending association through the real
 * public route, confirm its staff member cannot read association-scoped
 * data through a real API route, then flip verification_status to
 * 'approved' directly in the test DB and confirm the SAME staff member now
 * can — a positive control, so this isn't vacuously passing on a
 * miswired fixture.
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import {
  testDb, resetDb, assertIsTestSchema,
} from '../helpers/test-db'
import { getAsUser, postAsUser } from '../helpers/auth'
import { __resetRateLimitsForTests } from '@/lib/rate-limit'

vi.mock('@/lib/db', async () => ({
  db: (await import('../helpers/test-db')).testDb,
}))

// The route's own gate on ASSOCIATION_SELF_SERVE_ENABLED (real default:
// false) is a separate, deliberate concern from the pending-verification
// gate this suite proves — mocked true here so this suite's pass/fail
// doesn't depend on whatever the live flag happens to be set to.
vi.mock('@/lib/feature-flags', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/feature-flags')>()),
  ASSOCIATION_SELF_SERVE_ENABLED: true,
}))

const { POST: selfServeOnboard } = await import('@/app/api/associations/self-serve-onboard/route')
const { GET: tracking } = await import('@/app/api/tracking/route')

beforeAll(async () => { await assertIsTestSchema() })

beforeEach(async () => {
  await resetDb()
  __resetRateLimitsForTests()
})

afterAll(async () => { await resetDb(); await testDb.$disconnect() })

describe('POST /api/associations/self-serve-onboard', () => {
  it('creates the Association with verification_status pending, not the Ops-route default of approved', async () => {
    const req = await postAsUser('http://test.local/api/associations/self-serve-onboard', 'anon', 'anon', {
      name: 'Pending State CA', type: 'state', state: 'Bihar',
      email: 'pending-secretary@test.local', password: 'a-real-password-123',
      dataSharingSigned: true,
    })
    const res = await selfServeOnboard(req)
    expect(res.status).toBe(200)

    const association = await testDb.association.findFirst({ where: { name: 'Pending State CA' } })
    expect(association?.verification_status).toBe('pending')

    // Signs the creator in — unlike the Ops route, which does not.
    expect(res.headers.get('set-cookie')).toMatch(/next-auth\.session-token/)
  })

  it('rejects a submission with no data-sharing consent', async () => {
    const req = await postAsUser('http://test.local/api/associations/self-serve-onboard', 'anon', 'anon', {
      name: 'No Consent CA', type: 'state', state: 'Bihar',
      email: 'no-consent@test.local', password: 'a-real-password-123',
      dataSharingSigned: false,
    })
    const res = await selfServeOnboard(req)
    expect(res.status).toBe(400)
    expect(await testDb.association.findFirst({ where: { name: 'No Consent CA' } })).toBeNull()
  })
})

describe('the pending gate itself — real access must be withheld until approved', () => {
  it('a pending association\'s own staff member cannot read association-scoped data, then can once approved', async () => {
    // 1. Create the pending association + its staff member through the
    //    real public route — not a direct DB insert, so this test also
    //    exercises the actual signup path, not a shortcut around it.
    const signupReq = await postAsUser('http://test.local/api/associations/self-serve-onboard', 'anon', 'anon', {
      name: 'Gate Test CA', type: 'state', state: 'Bihar',
      email: 'gate-staff@test.local', password: 'a-real-password-123',
      dataSharingSigned: true,
    })
    const signupRes = await selfServeOnboard(signupReq)
    expect(signupRes.status).toBe(200)

    const association = await testDb.association.findFirstOrThrow({ where: { name: 'Gate Test CA' } })
    const staff = await testDb.user.findFirstOrThrow({ where: { email: 'gate-staff@test.local' } })
    expect(association.verification_status).toBe('pending') // sanity re-check before the real assertions

    // Seed one real, unambiguous piece of association-scoped data: a
    // flagged player belonging to this association.
    const player = await testDb.playerProfile.create({
      data: {
        full_name: 'Gate Test Player', dob: new Date('2001-01-01'), district: 'Patna', state: 'Bihar',
        claim_status: 'unclaimed', consent_status: 'not_required', profile_source: 'ingest',
        association_id: association.id,
      },
    })
    await testDb.trendAlert.create({
      data: { player_id: player.id, triggered_at: new Date(), flag_type: 'form_drop' },
    })

    // 2. Still pending — the staff member's own real session must see
    //    nothing, via a real API route (not a mocked scope check).
    const pendingReq = await getAsUser('http://test.local/api', staff.id, 'association')
    const pendingBody = await (await tracking(pendingReq)).json()
    expect(pendingBody.players.map((p: { id: string }) => p.id)).not.toContain(player.id)

    // 3. Ops approves — flip verification_status directly in the test DB
    //    (this is the one step a real Ops-approval PATCH route would do;
    //    that route is Prompt 4, separate scope, not built yet).
    await testDb.association.update({ where: { id: association.id }, data: { verification_status: 'approved' } })

    // 4. Positive control — the SAME staff member, same session shape, now
    //    sees the same player. Proves the negative above was the gate
    //    actually working, not a broken fixture that would fail regardless.
    const approvedReq = await getAsUser('http://test.local/api', staff.id, 'association')
    const approvedBody = await (await tracking(approvedReq)).json()
    expect(approvedBody.players.map((p: { id: string }) => p.id)).toContain(player.id)
  })

  it('a rejected association is treated the same as pending — still no access', async () => {
    const signupReq = await postAsUser('http://test.local/api/associations/self-serve-onboard', 'anon', 'anon', {
      name: 'Rejected CA', type: 'state', state: 'Bihar',
      email: 'rejected-staff@test.local', password: 'a-real-password-123',
      dataSharingSigned: true,
    })
    await selfServeOnboard(signupReq)
    const association = await testDb.association.findFirstOrThrow({ where: { name: 'Rejected CA' } })
    const staff = await testDb.user.findFirstOrThrow({ where: { email: 'rejected-staff@test.local' } })
    await testDb.association.update({ where: { id: association.id }, data: { verification_status: 'rejected' } })

    const player = await testDb.playerProfile.create({
      data: {
        full_name: 'Rejected-CA Player', dob: new Date('2001-01-01'), district: 'Patna', state: 'Bihar',
        claim_status: 'unclaimed', consent_status: 'not_required', profile_source: 'ingest',
        association_id: association.id,
      },
    })
    await testDb.trendAlert.create({
      data: { player_id: player.id, triggered_at: new Date(), flag_type: 'form_drop' },
    })

    const req = await getAsUser('http://test.local/api', staff.id, 'association')
    const body = await (await tracking(req)).json()
    expect(body.players.map((p: { id: string }) => p.id)).not.toContain(player.id)
  })
})
