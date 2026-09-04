/**
 * SECURITY — these tests are EXPECTED TO FAIL against the current code.
 *
 * They are an executable specification of the security findings from the
 * implementation audit. Each asserts the behaviour the Pivot Document
 * requires; each fails today. When a finding is remediated, its test turns
 * green.
 *
 * Run in isolation:  npm run test:security
 *
 * Do NOT weaken these assertions to make the suite pass.
 *
 * Findings covered:
 *   S1  No authentication on any API route.
 *   S2  Caller-supplied identity — anyone can act as any selector or chair.
 *   S3  claim/start returns the OTP in its own response body.
 *   S4  Consent withdrawal does not stop processing on read paths.
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
import { getAsUser, postAsUser } from '../helpers/auth'

vi.mock('@/lib/db', async () => ({
  db: (await import('../helpers/test-db')).testDb,
}))

const { POST: submitGrade } = await import('@/app/api/grading/[sessionId]/grade/route')
const { POST: unlock } = await import('@/app/api/grading/[sessionId]/unlock/route')
const { POST: claimStart } = await import('@/app/api/claim/start/route')
const { POST: claimWithdraw } = await import('@/app/api/claim/withdraw/route')
const { GET: candidatePool } = await import('@/app/api/candidate-pool/route')
const { GET: tracking } = await import('@/app/api/tracking/route')
const { GET: dashboard } = await import('@/app/api/dashboard/route')

const post = (body: unknown) =>
  new NextRequest('http://test.local/api', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
const get = () => new NextRequest('http://test.local/api')

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

// ─────────────────────────────────────────────────────────────────────────────
// S1 — No authentication. Every route serves anyone.
// ─────────────────────────────────────────────────────────────────────────────
describe('S1: API routes must require authentication', () => {
  it('should not serve the candidate pool to an anonymous caller', async () => {
    const res = await candidatePool(get())
    expect(
      res.status,
      'candidate-pool returned player PII with no credentials',
    ).toBe(401)
  })

  it('should not serve weekly tracking to an anonymous caller', async () => {
    const res = await tracking(get())
    expect(res.status, 'tracking returned player data with no credentials').toBe(401)
  })

  it('should not serve the association dashboard to an anonymous caller', async () => {
    const res = await dashboard(get())
    expect(res.status, 'dashboard returned association data with no credentials').toBe(401)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// S2 — Identity comes from the request body, so anyone may impersonate.
// This is what makes the blind-grading guarantee bypassable in practice:
// the enforcement is real, but the identity it enforces against is not.
// ─────────────────────────────────────────────────────────────────────────────
describe('S2: caller-supplied identity must not be trusted', () => {
  it('should reject a grade submitted as another selector', async () => {
    // An attacker knows only a player id and a session id. They submit a
    // grade "as" the chair. Nothing verifies they are the chair.
    const res = await submitGrade(
      post({ selectorId: fx.chair.id, playerId: fx.adult.id, grade: 1 }),
      { params: { sessionId: fx.session.id } },
    )
    expect(
      res.status,
      'a grade was recorded on behalf of the chair by an unauthenticated caller',
    ).not.toBe(200)
  })

  it('should not let an anonymous caller unlock convergence by naming the chair', async () => {
    // Defeats blind grading entirely: unlock, then read every selector's grade.
    const res = await unlock(post({ chairId: fx.chair.id }), {
      params: { sessionId: fx.session.id },
    })
    expect(
      res.status,
      'convergence was unlocked by an unauthenticated caller supplying the chair id',
    ).not.toBe(200)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// S3 — claim/start returns the OTP it just issued.
// Combined with S1 this is a complete profile-takeover primitive against
// any player, including minors.
// ─────────────────────────────────────────────────────────────────────────────
describe('S3: the OTP must never be returned to the caller', () => {
  it('should not include the code in the claim/start response', async () => {
    const res = await claimStart(
      post({ playerId: fx.adult.id, phone: '9123456789' }),
    )
    const body = await res.json()
    const raw = JSON.stringify(body)

    expect(
      body.devOtp,
      'claim/start returned the OTP; anyone can claim any profile',
    ).toBeUndefined()
    expect(raw, 'a 6-digit code appears in the claim/start response').not.toMatch(/\b\d{6}\b/)
  })

  it('should not let a caller claim a minor’s profile without the guardian', async () => {
    const res = await claimStart(
      post({
        playerId: fx.minor.id,
        phone: '9123456789',
        guardianName: 'Attacker',
        guardianPhone: '9999999999',
        guardianRelation: 'father',
      }),
    )
    const body = await res.json().catch(() => ({}))
    expect(
      body.devOtp,
      'the guardian OTP for a minor was returned to the caller',
    ).toBeUndefined()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// S4 — Consent withdrawal flips a flag but no read path honours it.
// Pivot Document W2 / DPDP: withdrawal must stop processing, not merely
// record an intention.
// ─────────────────────────────────────────────────────────────────────────────
describe('S4: withdrawing consent must stop the player being surfaced', () => {
  beforeEach(async () => {
    // Put the adult player into a claimed+granted state, then withdraw.
    await testDb.playerProfile.update({
      where: { id: fx.adult.id },
      data: { claim_status: 'claimed', consent_status: 'granted' },
    })
  })

  it('removes the player from the candidate pool after withdrawal', async () => {
    await testDb.playerProfile.update({
      where: { id: fx.adult.id },
      data: { consent_status: 'withdrawn' },
    })

    const res = await candidatePool(await getAsUser('http://test.local/api', fx.chair.id, 'association'))
    const raw = JSON.stringify(await res.json())

    expect(
      raw.includes(fx.adult.id),
      'a player who withdrew consent is still returned by candidate-pool',
    ).toBe(false)
  })

  it('removes the player from weekly tracking after withdrawal', async () => {
    // Without an alert the player never appears in tracking at all, so the
    // assertion would pass for the wrong reason. Make them visible first.
    await testDb.trendAlert.create({
      data: {
        player_id: fx.adult.id,
        flag_type: 'on_form',
        triggered_at: new Date(),
        consecutive_declining_weeks: 0,
      },
    })
    const staffGet = () => getAsUser('http://test.local/api', fx.chair.id, 'association')
    const before = JSON.stringify(await (await tracking(await staffGet())).json())
    expect(before.includes(fx.adult.id), 'precondition: player is visible in tracking').toBe(true)

    await testDb.playerProfile.update({
      where: { id: fx.adult.id },
      data: { consent_status: 'withdrawn' },
    })

    const res = await tracking(await staffGet())
    const raw = JSON.stringify(await res.json())

    expect(
      raw.includes(fx.adult.id),
      'a player who withdrew consent is still returned by tracking',
    ).toBe(false)
  })

  it('honours withdrawal made through the withdraw route itself', async () => {
    const claim = await testDb.playerClaim.create({
      data: {
        player_id: fx.adult.id,
        phone: '9123456789',
        method: 'phone_otp',
        consent_status: 'granted',
        consent_granted_at: new Date(),
        verified_at: new Date(),
      },
    })

    // claim/withdraw is now auth-gated and self-service only (previously
    // had NO auth check at all — any caller who knew a claimId could
    // withdraw someone else's consent). selectorB stands in as the real
    // account linked to this player, same pattern used throughout this
    // suite for turning a fixture user into a real signed-in identity.
    await testDb.user.update({ where: { id: fx.selectorB.id }, data: { linked_player_id: fx.adult.id } })
    const withdrawRes = await claimWithdraw(
      await postAsUser('http://test.local/api', fx.selectorB.id, 'player', { claimId: claim.id }),
    )
    expect(withdrawRes.status).toBe(200)

    const res = await candidatePool(await getAsUser('http://test.local/api', fx.chair.id, 'association'))
    const raw = JSON.stringify(await res.json())
    expect(
      raw.includes(fx.adult.id),
      'withdraw route flipped the flag but the player is still surfaced',
    ).toBe(false)
  })

  it('refuses to withdraw a claim that is not the caller\'s own', async () => {
    const claim = await testDb.playerClaim.create({
      data: {
        player_id: fx.adult.id,
        phone: '9123456789',
        method: 'phone_otp',
        consent_status: 'granted',
        consent_granted_at: new Date(),
        verified_at: new Date(),
      },
    })

    // selectorB has no linked_player_id at all here — a real authenticated
    // caller with no relationship to this claim must not be able to
    // withdraw someone else's consent just by knowing/guessing a claimId.
    const res = await claimWithdraw(
      await postAsUser('http://test.local/api', fx.selectorB.id, 'player', { claimId: claim.id }),
    )
    expect(res.status).toBe(403)

    const stillGranted = await testDb.playerClaim.findUnique({ where: { id: claim.id } })
    expect(stillGranted?.consent_status).toBe('granted')
  })

  it('401s an anonymous caller attempting to withdraw', async () => {
    const claim = await testDb.playerClaim.create({
      data: {
        player_id: fx.adult.id,
        phone: '9123456789',
        method: 'phone_otp',
        consent_status: 'granted',
        consent_granted_at: new Date(),
        verified_at: new Date(),
      },
    })
    const res = await claimWithdraw(post({ claimId: claim.id }))
    expect(res.status).toBe(401)
  })
})
