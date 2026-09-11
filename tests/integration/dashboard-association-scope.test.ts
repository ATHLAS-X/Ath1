/**
 * Integration — GET /api/dashboard must scope every aggregate to the
 * caller's own association, not return counts across every association
 * in the table.
 *
 * Creates two real, approved associations, each with its own trial cycle,
 * registrations, ingest job, and flagged player, then proves one
 * association's staff member sees only their own numbers — the actual
 * regression this route's own "NOT YET SCOPED" comment used to flag.
 * athlasx_ops is checked too, as a positive control: unrestricted access
 * should see BOTH associations combined, proving the fix didn't
 * accidentally over-scope the unrestricted role (a real second bug found
 * alongside this one — the old code picked "the first association in the
 * table" for ops too, instead of a true cross-association view).
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import { testDb, resetDb, assertIsTestSchema } from '../helpers/test-db'
import { getAsUser } from '../helpers/auth'

vi.mock('@/lib/db', async () => ({
  db: (await import('../helpers/test-db')).testDb,
}))

const { GET: dashboard } = await import('@/app/api/dashboard/route')

const URL = 'http://test.local/api/dashboard'

beforeAll(async () => { await assertIsTestSchema() })
beforeEach(async () => { await resetDb() })
afterAll(async () => { await resetDb(); await testDb.$disconnect() })

async function seedAssociation(label: string, registrationCount: number) {
  const association = await testDb.association.create({
    data: { name: `Scope Test CA ${label}`, type: 'district', state: 'Uttar Pradesh' },
  })
  const staff = await testDb.user.create({
    data: { email: `staff-${label}@test.local`, role: 'association', password_hash: 'x' },
  })
  await testDb.associationStaff.create({
    data: { association_id: association.id, user_id: staff.id, is_lead: true },
  })

  const trialCycle = await testDb.trialCycle.create({
    data: {
      association_id: association.id,
      age_category: `U-16-${label}`,
      dob_window_start: new Date('2008-01-01'),
      dob_window_end: new Date('2010-01-01'),
      fee_amount: 500,
      registration_opens: new Date('2026-01-01'),
      registration_closes: new Date('2026-02-01'),
    },
  })
  const venue = await testDb.trialVenue.create({
    data: { trial_cycle_id: trialCycle.id, name: `${label} Ground`, district: 'Test District', date: new Date('2026-01-15') },
  })
  const player = await testDb.playerProfile.create({
    data: {
      full_name: `Scope ${label} Player`, dob: new Date('2009-01-01'), district: 'Test District', state: 'Uttar Pradesh',
      claim_status: 'unclaimed', consent_status: 'not_required', profile_source: 'ingest',
      association_id: association.id,
    },
  })
  for (let i = 0; i < registrationCount; i++) {
    await testDb.registration.create({
      data: { trial_cycle_id: trialCycle.id, player_id: player.id, venue_id: venue.id },
    })
  }
  await testDb.trendAlert.create({
    data: { player_id: player.id, triggered_at: new Date(), flag_type: 'form_drop' },
  })
  await testDb.ingestJob.create({
    data: {
      association_id: association.id,
      source: 'api_sync', method: 'api_sync', tournament: `${label} Tournament`,
      match_count: 1, player_rows: 1, status: 'pending_review', confidence: 0.9,
    },
  })

  return { association, staff, player, trialCycle }
}

describe('GET /api/dashboard — association scoping', () => {
  it('an association_staff user sees only their own association\'s aggregates, not another\'s', async () => {
    const a = await seedAssociation('A', 2)
    const b = await seedAssociation('B', 1)

    const resA = await dashboard(await getAsUser(URL, a.staff.id, 'association'))
    expect(resA.status).toBe(200)
    const bodyA = await resA.json()

    // Own numbers, not the combined total across both associations.
    expect(bodyA.kpis.registrations).toBe(2)
    expect(bodyA.kpis.pendingIngest).toBe(1)
    expect(bodyA.kpis.formDropAlerts).toBe(1)

    // Association B's identifying data must not leak through anywhere in
    // the response — not just the obvious count fields.
    const bodyAText = JSON.stringify(bodyA)
    expect(bodyAText).not.toContain('Scope B Player')
    expect(bodyAText).not.toContain('B Tournament')
    expect(bodyAText).not.toContain('U-16-B')

    const resB = await dashboard(await getAsUser(URL, b.staff.id, 'association'))
    const bodyB = await resB.json()
    expect(bodyB.kpis.registrations).toBe(1)
    expect(bodyB.kpis.pendingIngest).toBe(1)
    expect(bodyB.kpis.formDropAlerts).toBe(1)

    const bodyBText = JSON.stringify(bodyB)
    expect(bodyBText).not.toContain('Scope A Player')
    expect(bodyBText).not.toContain('A Tournament')
    expect(bodyBText).not.toContain('U-16-A')
  })

  it('a caller with no association staff row sees zero, not everyone else\'s data', async () => {
    await seedAssociation('A', 2)
    const orphan = await testDb.user.create({
      data: { email: 'no-staff-row@test.local', role: 'association', password_hash: 'x' },
    })

    const res = await dashboard(await getAsUser(URL, orphan.id, 'association'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.kpis.registrations).toBe(0)
    expect(body.kpis.pendingIngest).toBe(0)
    expect(body.kpis.formDropAlerts).toBe(0)
    expect(body.activeFlags).toEqual([])
  })

  it('athlasx_ops sees the combined total across every association — unrestricted, not narrowed to one', async () => {
    await seedAssociation('A', 2)
    await seedAssociation('B', 1)
    const ops = await testDb.user.create({
      data: { email: 'ops@test.local', role: 'athlasx_ops', password_hash: 'x' },
    })

    const res = await dashboard(await getAsUser(URL, ops.id, 'athlasx_ops'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.kpis.registrations).toBe(3)
    expect(body.kpis.pendingIngest).toBe(2)
    expect(body.kpis.formDropAlerts).toBe(2)
  })
})
