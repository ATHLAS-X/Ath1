/**
 * Integration — visibility_tier + the cross-association scoping fixes it
 * required (candidate-pool, coach/squad, grading/session, grading/
 * convergence, tracking, trial-cycles registrations all previously either
 * pulled the most-recently-created session in the WHOLE database, or
 * trusted a caller-supplied ID with no ownership check at all).
 *
 * Two associations (A, B), one staff user scoped to A only. Every
 * assertion proves a NEGATIVE — that A's staff cannot see B's data — with
 * a positive control alongside so the test isn't vacuously passing.
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import {
  testDb, resetDb, seedFixtures, assertIsTestSchema, type Fixtures,
} from '../helpers/test-db'
import { getAsUser } from '../helpers/auth'

vi.mock('@/lib/db', async () => ({
  db: (await import('../helpers/test-db')).testDb,
}))

const { GET: candidatePool } = await import('@/app/api/candidate-pool/route')
const { GET: coachSquad } = await import('@/app/api/coach/squad/route')
const { GET: gradingSession } = await import('@/app/api/grading/session/route')
const { GET: convergence } = await import('@/app/api/grading/[sessionId]/convergence/route')
const { GET: tracking } = await import('@/app/api/tracking/route')
const { GET: registrations } = await import('@/app/api/trial-cycles/[id]/registrations/route')

let fx: Fixtures
let staffA: { id: string }
let assocB: { id: string }
let sessionB: { id: string }
let cycleB: { id: string }
let playerBDefault: { id: string }
let playerBCross: { id: string }

beforeAll(async () => { await assertIsTestSchema() })

beforeEach(async () => {
  await resetDb()
  fx = await seedFixtures()

  const userA = await testDb.user.create({ data: { email: 'staff-a@test.local', role: 'association' } })
  await testDb.associationStaff.create({ data: { association_id: fx.association.id, user_id: userA.id } })
  staffA = userA

  assocB = await testDb.association.create({ data: { name: 'Other State CA', type: 'state', state: 'Bihar' } })

  playerBDefault = await testDb.playerProfile.create({
    data: {
      full_name: 'Association-Only Player', dob: new Date('2001-01-01'), district: 'Patna', state: 'Bihar',
      claim_status: 'unclaimed', consent_status: 'not_required', profile_source: 'ingest',
      association_id: assocB.id, // visibility_tier omitted — defaults to association_only
    },
  })
  playerBCross = await testDb.playerProfile.create({
    data: {
      full_name: 'Cross-Association Player', dob: new Date('2001-02-02'), district: 'Gaya', state: 'Bihar',
      claim_status: 'unclaimed', consent_status: 'not_required', profile_source: 'ingest',
      association_id: assocB.id, visibility_tier: 'cross_association',
    },
  })

  cycleB = await testDb.trialCycle.create({
    data: {
      association_id: assocB.id, age_category: 'U19',
      dob_window_start: new Date('2005-01-01'), dob_window_end: new Date('2010-01-01'),
      fee_amount: 300, registration_opens: new Date(Date.now() - 864e5), registration_closes: new Date(Date.now() + 864e5),
      status: 'registration_open',
    },
  })
  const chairB = await testDb.user.create({ data: { email: 'chair-b@test.local', role: 'selection_panel' } })
  sessionB = await testDb.selectionSession.create({
    data: { trial_cycle_id: cycleB.id, association_id: assocB.id, chair_id: chairB.id, squad_size_target: 20, status: 'grading' },
  })
})

afterAll(async () => { await resetDb(); await testDb.$disconnect() })

function get(url: string) { return getAsUser(url, staffA.id, 'association') }

describe('candidate-pool — session lookup scoped to caller\'s own association', () => {
  it('returns only the caller\'s own association\'s session, never another association\'s', async () => {
    const body = JSON.stringify(await (await candidatePool(await get('http://test.local/api'))).json())
    expect(body).toContain(fx.adult.id) // positive control — sees own association's player
    expect(body).not.toContain(playerBDefault.id)
    expect(body).not.toContain(playerBCross.id)
  })
})

describe('coach/squad — real Squad-model access, not the old session guess', () => {
  it('an explicit squadId for another association\'s squad is rejected (403), not silently scoped away', async () => {
    const squadB = await testDb.squad.create({
      data: { association_id: assocB.id, name: 'Squad B', season: '2026' },
    })
    const req = await get(`http://test.local/api?squadId=${squadB.id}`)
    const res = await coachSquad(req)
    expect(res.status).toBe(403)
  })

  it('an explicit squadId for the caller\'s own association\'s squad works (positive control)', async () => {
    const squadA = await testDb.squad.create({
      data: { association_id: fx.association.id, name: 'Squad A', season: '2026' },
    })
    await testDb.squadPlayer.create({ data: { squad_id: squadA.id, player_id: fx.adult.id } })
    const req = await get(`http://test.local/api?squadId=${squadA.id}`)
    const body = JSON.stringify(await (await coachSquad(req)).json())
    expect(body).toContain(fx.adult.id)
  })
})

describe('grading/session — same session-scoping fix', () => {
  it('never returns another association\'s session', async () => {
    const body = JSON.stringify(await (await gradingSession(await get('http://test.local/api'))).json())
    expect(body).toContain(fx.session.id)
    expect(body).not.toContain(sessionB.id)
  })
})

describe('grading/[sessionId]/convergence — sessionId ownership check', () => {
  it('403s when the caller requests a session belonging to a different association', async () => {
    const req = await get(`http://test.local/api/${sessionB.id}/convergence`)
    const res = await convergence(req, { params: { sessionId: sessionB.id } })
    expect(res.status).toBe(403)
  })

  it('does not 403-for-scope on the caller\'s own association\'s session (positive control)', async () => {
    const req = await get(`http://test.local/api/${fx.session.id}/convergence`)
    const res = await convergence(req, { params: { sessionId: fx.session.id } })
    const body = await res.json()
    // Not unlocked in fixtures, so still non-200 — but the specific
    // "not scoped to this association" 403 must not be the reason.
    expect(body.error).not.toBe('Forbidden — not scoped to this association')
  })
})

describe('tracking — visibility_tier actually gates cross-association players', () => {
  it('excludes an association_only player from another association, includes a cross_association one', async () => {
    await testDb.trendAlert.create({
      data: { player_id: fx.adult.id, triggered_at: new Date(), flag_type: 'form_drop' },
    })
    await testDb.trendAlert.create({
      data: { player_id: playerBDefault.id, triggered_at: new Date(), flag_type: 'form_drop' },
    })
    await testDb.trendAlert.create({
      data: { player_id: playerBCross.id, triggered_at: new Date(), flag_type: 'form_drop' },
    })

    const body = JSON.stringify(await (await tracking(await get('http://test.local/api'))).json())
    expect(body, 'own-association player must still appear').toContain(fx.adult.id)
    expect(body, 'association_only player from a different association must NOT leak').not.toContain(playerBDefault.id)
    expect(body, 'cross_association player from a different association SHOULD surface — that is the opt-in working').toContain(playerBCross.id)
  })
})

describe('trial-cycles/[id]/registrations — cycle ownership check', () => {
  it('403s when the cycle belongs to a different association', async () => {
    const req = await get(`http://test.local/api/trial-cycles/${cycleB.id}/registrations`)
    const res = await registrations(req, { params: Promise.resolve({ id: cycleB.id }) })
    expect(res.status).toBe(403)
  })
})
