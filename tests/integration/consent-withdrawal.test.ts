/**
 * Integration — proves consent withdrawal is honoured on all 6 read paths
 * named in the implementation audit: candidate-pool, tracking, coach/squad,
 * dashboard, my-record, and claim/search (the 6th path, found independently
 * of the audit's own wording — see the comparison report).
 *
 * candidate-pool/tracking/coach/squad/dashboard/my-record are now
 * auth-gated (see tests/security/auth-and-consent.test.ts's S1), so a
 * request with no session would 401 regardless of consent logic — that
 * would make this test pass for the wrong reason. Every gated route here
 * is called with a real, signed session JWT (via next-auth/jwt#encode,
 * the same secret require-auth.ts#getSessionUser verifies against) so the
 * assertion is actually exercising the consent filter, not the auth gate.
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
import { getAsUser as getAsUserShared } from '../helpers/auth'

vi.mock('@/lib/db', async () => ({
  db: (await import('../helpers/test-db')).testDb,
}))

const { GET: candidatePool } = await import('@/app/api/candidate-pool/route')
const { GET: tracking } = await import('@/app/api/tracking/route')
const { GET: coachSquad } = await import('@/app/api/coach/squad/route')
const { GET: dashboard } = await import('@/app/api/dashboard/route')
const { GET: myRecord } = await import('@/app/api/my-record/route')
const { POST: claimSearch } = await import('@/app/api/claim/search/route')

const getAsUser = (userId: string, role: string) => getAsUserShared('http://test.local/api', userId, role)

const post = (body: unknown) =>
  new NextRequest('http://test.local/api', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })

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

describe('consent withdrawal — all 6 read paths', () => {
  beforeEach(async () => {
    // Claimed + linked, with a squad/session membership, a tracking alert,
    // and a coach-visible flag — visible on every path before withdrawal.
    await testDb.playerProfile.update({
      where: { id: fx.adult.id },
      data: { claim_status: 'claimed', consent_status: 'granted' },
    })
    await testDb.trendAlert.create({
      data: {
        player_id: fx.adult.id,
        flag_type: 'on_form',
        triggered_at: new Date(),
        consecutive_declining_weeks: 0,
      },
    })
    await testDb.user.update({ where: { id: fx.chair.id }, data: { linked_player_id: fx.adult.id } })

    // coach/squad now resolves a real Squad (W7), not a session guess —
    // fx.chair needs a genuine SquadCoach row for coach/squad's default
    // (no ?squadId=) resolution path to find fx.adult at all.
    const squad = await testDb.squad.create({
      data: { association_id: fx.association.id, name: 'Test Squad', season: '2026' },
    })
    await testDb.squadPlayer.create({ data: { squad_id: squad.id, player_id: fx.adult.id } })
    await testDb.squadCoach.create({ data: { squad_id: squad.id, user_id: fx.chair.id } })
  })

  // claim/search only ever returns unclaimed profiles — fx.adult is
  // claimed above, so it can never appear there regardless of consent.
  // A separate, still-unclaimed shadow profile is needed to exercise
  // claim/search's own consent filter specifically.
  async function seedUnclaimedShadowProfile() {
    return testDb.playerProfile.create({
      data: {
        full_name: 'Shadow Searchable',
        dob: new Date('2001-02-02'),
        district: 'Kanpur',
        state: 'Uttar Pradesh',
        claim_status: 'unclaimed',
        consent_status: 'granted',
        profile_source: 'ingest',
        association_id: fx.association.id,
      },
    })
  }

  it('is visible on every path before withdrawal, then excluded from all 6 after', async () => {
    const staffAuth = await getAsUser(fx.chair.id, 'association')
    const shadow = await seedUnclaimedShadowProfile()

    // ── Before withdrawal: precondition, not the actual assertion ──
    const beforeCandidate = JSON.stringify(await (await candidatePool(staffAuth)).json())
    const beforeTracking = JSON.stringify(await (await tracking(staffAuth)).json())
    const beforeSquad = JSON.stringify(await (await coachSquad(staffAuth)).json())
    // dashboard's response never embeds a raw player id (only kpis/pipeline/
    // trends/activeFlags-by-name/activity-text) — check for the player's
    // name instead, which is what actually appears in activeFlags/activity.
    const beforeDashboard = JSON.stringify(await (await dashboard(staffAuth)).json())
    const beforeMine = JSON.stringify(await (await myRecord(await getAsUser(fx.chair.id, 'player'))).json())
    // claim/search only ever returns unclaimed profiles — exercised against
    // the separate shadow profile above, not fx.adult (which is claimed).
    const beforeSearch = JSON.stringify(
      await (await claimSearch(post({ fullName: 'Shadow', district: 'Kanpur', dob: '2001-02-02' }))).json(),
    )
    expect(beforeCandidate.includes(fx.adult.id), 'precondition: visible in candidate-pool').toBe(true)
    expect(beforeTracking.includes(fx.adult.id), 'precondition: visible in tracking').toBe(true)
    expect(beforeSquad.includes(fx.adult.id), 'precondition: visible in coach/squad').toBe(true)
    expect(beforeDashboard.includes(fx.adult.full_name), 'precondition: visible in dashboard').toBe(true)
    expect(beforeMine.includes(fx.adult.id), 'precondition: visible in my-record').toBe(true)
    expect(beforeSearch.includes(shadow.id), 'precondition: visible in claim/search').toBe(true)

    // ── Withdraw ──
    await testDb.playerProfile.update({
      where: { id: fx.adult.id },
      data: { consent_status: 'withdrawn' },
    })
    await testDb.playerProfile.update({
      where: { id: shadow.id },
      data: { consent_status: 'withdrawn' },
    })

    // ── After withdrawal: the actual assertion, all 6 paths ──
    const afterCandidate = JSON.stringify(await (await candidatePool(staffAuth)).json())
    const afterTracking = JSON.stringify(await (await tracking(staffAuth)).json())
    const afterSquad = JSON.stringify(await (await coachSquad(staffAuth)).json())
    const afterDashboard = JSON.stringify(await (await dashboard(staffAuth)).json())
    const afterMine = JSON.stringify(await (await myRecord(await getAsUser(fx.chair.id, 'player'))).json())
    const afterSearch = JSON.stringify(
      await (await claimSearch(post({ fullName: 'Shadow', district: 'Kanpur', dob: '2001-02-02' }))).json(),
    )

    expect(afterCandidate.includes(fx.adult.id), 'candidate-pool still returns the withdrawn player').toBe(false)
    expect(afterTracking.includes(fx.adult.id), 'tracking still returns the withdrawn player').toBe(false)
    expect(afterSquad.includes(fx.adult.id), 'coach/squad still returns the withdrawn player').toBe(false)
    expect(afterDashboard.includes(fx.adult.full_name), 'dashboard still returns the withdrawn player').toBe(false)
    expect(afterMine.includes(fx.adult.id), 'my-record still returns the withdrawn player’s own data').toBe(false)
    expect(afterSearch.includes(shadow.id), 'claim/search still returns the withdrawn player').toBe(false)
  }, 60_000) // 12 real HTTP-handler calls with DB round trips (6 paths x before/after) against Neon's real latency exceed vitest's 30s default
})
