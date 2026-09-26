/**
 * Regression test for a Critical IDOR: GET /api/trial-cycles/[id]/registrations/[registrationId]/dossier
 * used to call getOrGenerateDossier(registrationId) straight off requireAuth
 * with no ownership check — any authenticated user of any role could read
 * (and lazily generate) another association's private pre-camp dossier by
 * guessing/enumerating a registrationId. Fixed by resolving the
 * registration's real trial cycle -> association and requiring it be in the
 * caller's verified scope, plus confirming the registration actually
 * belongs to the URL's cycle id.
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import { testDb, resetDb, seedFixtures, assertIsTestSchema, type Fixtures } from '../helpers/test-db'
import { getAsUser } from '../helpers/auth'

vi.mock('@/lib/db', async () => ({
  db: (await import('../helpers/test-db')).testDb,
}))

const { GET } = await import('@/app/api/trial-cycles/[id]/registrations/[registrationId]/dossier/route')

let fx: Fixtures
let otherAssociationId: string
let otherStaffUserId: string
let otherCycleId: string
let otherRegistrationId: string

beforeAll(async () => {
  await assertIsTestSchema()
})
beforeEach(async () => {
  await resetDb()
  fx = await seedFixtures()

  const otherAssociation = await testDb.association.create({
    data: { name: 'Other District CA', type: 'district', state: 'Karnataka' },
  })
  const otherStaff = await testDb.user.create({
    data: { email: 'other-staff@test.local', role: 'association', password_hash: 'x' },
  })
  await testDb.associationStaff.create({
    data: { association_id: otherAssociation.id, user_id: otherStaff.id, is_lead: true },
  })
  otherAssociationId = otherAssociation.id
  otherStaffUserId = otherStaff.id

  const otherCycle = await testDb.trialCycle.create({
    data: {
      association_id: otherAssociationId,
      age_category: 'U19',
      dob_window_start: new Date('2007-09-01'),
      dob_window_end: new Date('2010-08-31'),
      fee_amount: 400,
      registration_opens: new Date(Date.now() - 7 * 864e5),
      registration_closes: new Date(Date.now() + 7 * 864e5),
      status: 'registration_open',
    },
  })
  const otherVenue = await testDb.trialVenue.create({
    data: { trial_cycle_id: otherCycle.id, name: 'Other Ground', district: 'Bengaluru Urban', date: new Date() },
  })
  const otherRegistration = await testDb.registration.create({
    data: { trial_cycle_id: otherCycle.id, player_id: fx.adult.id, venue_id: otherVenue.id },
  })
  otherCycleId = otherCycle.id
  otherRegistrationId = otherRegistration.id
})
afterAll(async () => {
  await resetDb()
  await testDb.$disconnect()
})

describe('Trial dossier — scoped to the caller’s own association', () => {
  it('rejects a caller from a different association entirely', async () => {
    const req = await getAsUser(
      `http://test.local/api/trial-cycles/${otherCycleId}/registrations/${otherRegistrationId}/dossier`,
      fx.associationStaffUser.id, 'association',
    )
    const res = await GET(req, { params: Promise.resolve({ id: otherCycleId, registrationId: otherRegistrationId }) })
    expect(res.status).toBe(403)
  })

  it('rejects a caller who mixes their own valid cycle id with a foreign registrationId', async () => {
    // fx.associationStaffUser belongs to fx.association, NOT otherAssociation.
    // Passing fx.trialCycle.id (their own, real cycle) alongside
    // otherRegistrationId (a real registration, but under a different
    // cycle/association) must not be treated as authorized just because the
    // cycle id in the URL happens to be one they own.
    const req = await getAsUser(
      `http://test.local/api/trial-cycles/${fx.trialCycle.id}/registrations/${otherRegistrationId}/dossier`,
      fx.associationStaffUser.id, 'association',
    )
    const res = await GET(req, { params: Promise.resolve({ id: fx.trialCycle.id, registrationId: otherRegistrationId }) })
    expect(res.status).toBe(404)
  })

  it('allows the owning association to read the dossier', async () => {
    const req = await getAsUser(
      `http://test.local/api/trial-cycles/${otherCycleId}/registrations/${otherRegistrationId}/dossier`,
      otherStaffUserId, 'association',
    )
    const res = await GET(req, { params: Promise.resolve({ id: otherCycleId, registrationId: otherRegistrationId }) })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.dossier).toBeDefined()
  })

  it('rejects an unrelated authenticated player, not just other associations', async () => {
    const req = await getAsUser(
      `http://test.local/api/trial-cycles/${otherCycleId}/registrations/${otherRegistrationId}/dossier`,
      fx.adult.id, 'player',
    )
    const res = await GET(req, { params: Promise.resolve({ id: otherCycleId, registrationId: otherRegistrationId }) })
    expect(res.status).toBe(403)
  })
})
