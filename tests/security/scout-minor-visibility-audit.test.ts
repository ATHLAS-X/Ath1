/**
 * SAFETY AUDIT — empirical, not a re-description of the code.
 *
 * Question: with FRANCHISE_SCOUT_ENABLED=true and scout self-serve live,
 * is a minor's data ever reachable through an approved scout account, by
 * ANY route that scout can call — not just /api/scout/candidates, the one
 * screen the adult-only disclosure copy appears on?
 *
 * Every check below calls the REAL exported route handler (unmocked
 * business logic) against the isolated athlasx_test schema — same
 * technique as every other integration test in this repo. Nothing here
 * touches the live "athlasx" schema.
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { testDb, resetDb, assertIsTestSchema } from '../helpers/test-db'
import { sessionCookieFor } from '../helpers/auth'

vi.mock('@/lib/db', async () => ({
  db: (await import('../helpers/test-db')).testDb,
}))

const { GET: scoutCandidates } = await import('@/app/api/scout/candidates/route')
const { GET: tracking } = await import('@/app/api/tracking/route')
const { POST: trackingNote } = await import('@/app/api/tracking/[playerId]/note/route')
const { GET: coachSquad } = await import('@/app/api/coach/squad/route')
const { GET: candidatePool } = await import('@/app/api/candidate-pool/route')
const { adultDobCutoff, isAdult } = await import('@/lib/player-visibility')

function getWithCookie(url: string, cookie: string) {
  return new NextRequest(url, { headers: { cookie } })
}

const now = Date.now()
const yearsAgo = (y: number) => new Date(now - y * 365.25 * 24 * 3600 * 1000)

let assocId: string
let adultId: string
let minorCrossAssocId: string
let minorFranchiseScoutId: string
let boundaryAdultId: string
let boundaryMinorId: string
let scoutUserId: string
let scoutCookie: string

beforeAll(async () => {
  await assertIsTestSchema()
})

beforeEach(async () => {
  await resetDb()

  const assoc = await testDb.association.create({
    data: { name: 'Audit Assoc', type: 'state', state: 'AuditState', data_sharing_signed: true },
  })
  assocId = assoc.id

  const adult = await testDb.playerProfile.create({
    data: {
      full_name: 'Audit Adult Player', dob: yearsAgo(20), district: 'AuditDistrict', state: 'AuditState',
      playing_role: 'Batsman', profile_source: 'ingest', association_id: assocId,
      claim_status: 'unclaimed', consent_status: 'granted', visibility_tier: 'franchise_scout',
    },
  })
  adultId = adult.id

  // THE AUDIT TARGET: a minor who self-selected cross_association — the
  // ONLY tier /api/player/visibility lets any player pick, with zero age
  // check in that route. If any scout-reachable endpoint treats
  // cross_association the same as it treats association-staff visibility
  // (i.e. with no separate adult gate), this minor leaks.
  const minorCrossAssoc = await testDb.playerProfile.create({
    data: {
      full_name: 'Audit Minor CrossAssoc', dob: yearsAgo(15), district: 'AuditDistrict', state: 'AuditState',
      playing_role: 'Bowler', profile_source: 'ingest', association_id: assocId,
      claim_status: 'unclaimed', consent_status: 'granted', visibility_tier: 'cross_association',
    },
  })
  minorCrossAssocId = minorCrossAssoc.id

  // Control: a minor who picked franchise_scout directly — the DIRECT
  // scout route's own adult check must reject this one.
  const minorFranchiseScout = await testDb.playerProfile.create({
    data: {
      full_name: 'Audit Minor FranchiseScout', dob: yearsAgo(15), district: 'AuditDistrict', state: 'AuditState',
      playing_role: 'All_rounder', profile_source: 'ingest', association_id: assocId,
      claim_status: 'unclaimed', consent_status: 'granted', visibility_tier: 'franchise_scout',
    },
  })
  minorFranchiseScoutId = minorFranchiseScout.id

  const boundaryAdult = await testDb.playerProfile.create({
    data: {
      full_name: 'Audit Boundary TurnsAdultToday', dob: adultDobCutoff(), district: 'AuditDistrict', state: 'AuditState',
      playing_role: 'Batsman', profile_source: 'ingest', association_id: assocId,
      claim_status: 'unclaimed', consent_status: 'granted', visibility_tier: 'franchise_scout',
    },
  })
  boundaryAdultId = boundaryAdult.id

  const boundaryMinor = await testDb.playerProfile.create({
    data: {
      full_name: 'Audit Boundary OneDayMinor', dob: new Date(adultDobCutoff().getTime() + 24 * 3600 * 1000),
      district: 'AuditDistrict', state: 'AuditState',
      playing_role: 'Batsman', profile_source: 'ingest', association_id: assocId,
      claim_status: 'unclaimed', consent_status: 'granted', visibility_tier: 'franchise_scout',
    },
  })
  boundaryMinorId = boundaryMinor.id

  // TrendAlert + PlayerWeek rows so /api/tracking actually surfaces these
  // players (it only lists players that currently have a TrendAlert).
  for (const id of [adultId, minorCrossAssocId, minorFranchiseScoutId]) {
    await testDb.playerWeek.create({
      data: { player_id: id, week_start: yearsAgo(0), matches_played: 1, rolling_4week_average: 50, coach_note: `secret-coach-note-${id}` },
    })
    await testDb.trendAlert.create({
      data: { player_id: id, flag_type: 'skill_below_threshold', skill_dimension: 'batting', consecutive_declining_weeks: 3, triggered_at: new Date() },
    })
  }

  const scoutUser = await testDb.user.create({
    data: { email: 'audit-scout@test.local', role: 'scout', password_hash: 'x' },
  })
  scoutUserId = scoutUser.id
  await testDb.scoutProfile.create({
    data: { user_id: scoutUserId, org_name: 'Audit Franchise', org_type: 'franchise', verification_status: 'approved' },
  })
  scoutCookie = await sessionCookieFor(scoutUserId, 'scout')
})

afterAll(async () => {
  await resetDb()
})

describe('CHECK 1 — direct scout-facing endpoint (/api/scout/candidates)', () => {
  it('shows the adult, excludes both minors, and gets the 18-year boundary exactly right', async () => {
    const res = await scoutCandidates(getWithCookie('http://test.local/api/scout/candidates', scoutCookie))
    expect(res.status).toBe(200)
    const names: string[] = (await res.json()).candidates.map((c: { name: string }) => c.name)

    expect(names).toContain('Audit Adult Player')
    expect(names).not.toContain('Audit Minor CrossAssoc')
    expect(names, 'a minor who picked franchise_scout directly must still be rejected by the adult check').not.toContain('Audit Minor FranchiseScout')
    expect(names, 'a player whose dob IS the cutoff (turns 18 today) must count as adult').toContain('Audit Boundary TurnsAdultToday')
    expect(names, 'a player one day short of the cutoff must still count as a minor').not.toContain('Audit Boundary OneDayMinor')
  })
})

describe('CHECK 2 (PRIORITY) — /api/tracking, an indirect ops route with no scout-specific gate', () => {
  it('does NOT leak the cross_association minor (or their coach note) to an approved scout', async () => {
    const res = await tracking(getWithCookie('http://test.local/api/tracking', scoutCookie))
    expect(res.status).toBe(200)
    const body = await res.json()
    const players: { name: string; coach_note?: string }[] = body.players

    const leaked = players.find((p) => p.name === 'Audit Minor CrossAssoc')
    expect(
      leaked,
      'PRIORITY-ONE FINDING if this fails: visibilityWhere() ORs in visibility_tier === "cross_association" ' +
        'with NO age check at all, and /api/tracking uses visibilityWhere() (the generic association-crossing ' +
        'filter) rather than franchiseScoutWhere() (the adult-gated one /api/scout/candidates uses). A minor who ' +
        'self-selects cross_association via /api/player/visibility (which has zero age check of its own) becomes ' +
        'visible through this route to ANY authenticated caller with empty association scope — including a scout ' +
        '— completely bypassing the adult-only franchise_scout design. This is confirmed, not hypothetical: this ' +
        'test failing IS the exploit.',
    ).toBeUndefined()

    // The franchise_scout-tier minor must ALSO be absent here — this route
    // has no adult carve-out for that tier either.
    expect(players.find((p) => p.name === 'Audit Minor FranchiseScout')).toBeUndefined()
  })
})

describe('CHECK 3 — /api/tracking/[playerId]/note: can a scout write into a minor\'s record?', () => {
  it('FINDING (write-side, not disclosure): requireAuth-only means no ownership/role check blocks this', async () => {
    const req = new NextRequest('http://test.local/api/tracking/x/note', {
      method: 'POST',
      body: JSON.stringify({ note: 'planted by a scout account' }),
      headers: { 'content-type': 'application/json', cookie: scoutCookie },
    })
    const res = await trackingNote(req, { params: { playerId: minorCrossAssocId } })
    // This documents the existing, already-known gap (no role/ownership
    // check on this route) applied specifically to a MINOR's record — a
    // scout account can tamper with a minor's tracking note despite never
    // being authorized to interact with that player at all.
    expect(res.status, 'a scout account should not be able to write a note against a minor\'s record').toBe(200)
  })
})

describe('CHECK 4 — squad and candidate-pool routes correctly return nothing for a scout', () => {
  it('/api/coach/squad: scout has no squad membership and no association scope', async () => {
    const res = await coachSquad(getWithCookie('http://test.local/api/coach/squad', scoutCookie))
    expect(res.status).toBe(200)
    expect((await res.json()).squad).toEqual([])
  })

  it('/api/candidate-pool: empty association scope short-circuits to an empty list', async () => {
    const res = await candidatePool(getWithCookie('http://test.local/api/candidate-pool', scoutCookie))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.candidates).toEqual([])
  })
})

describe('CHECK 5 — isAdult()/adultDobCutoff() are computed fresh per call, not cached', () => {
  it('two calls straddling a mocked system-clock advance produce different cutoffs', () => {
    // vi.useFakeTimers()+setSystemTime overrides `new Date()` itself (not
    // just the Date.now() static), which is what adultDobCutoff() actually
    // calls — a plain `Date.now` stub wouldn't touch that at all.
    vi.useFakeTimers()
    try {
      vi.setSystemTime(new Date('2020-01-01T00:00:00Z'))
      const cutoff2020 = adultDobCutoff()

      vi.setSystemTime(new Date('2025-01-01T00:00:00Z'))
      const cutoff2025 = adultDobCutoff()

      expect(cutoff2020.getTime()).not.toBe(cutoff2025.getTime())
      expect(cutoff2025.getFullYear() - cutoff2020.getFullYear()).toBe(5)

      // A fixed dob that is a minor under the 2020 cutoff must become an
      // adult under the 2025 cutoff — proves the function recomputes
      // against "now" every call rather than memoizing at import time or
      // at profile-creation time.
      const fixedDob = new Date('2005-06-01T00:00:00Z')
      vi.setSystemTime(new Date('2020-01-01T00:00:00Z'))
      const wasMinorIn2020 = isAdult(fixedDob)
      vi.setSystemTime(new Date('2025-01-01T00:00:00Z'))
      const isAdultIn2025 = isAdult(fixedDob)

      expect(wasMinorIn2020).toBe(false)
      expect(isAdultIn2025).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })
})
