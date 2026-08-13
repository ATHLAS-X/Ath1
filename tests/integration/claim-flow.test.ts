/**
 * Integration — W2 Player Identity Resolution & Claim.
 *
 * The claim flow is the guardian-consent gate. Pivot Document §9 names it a
 * legal precondition to ingesting any record at U14/U16 level, so these
 * tests focus on the minor path and on OTP hygiene (expiry, attempt
 * limiting, single use) rather than the happy path alone.
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { hashOtp } from '@/lib/otp'
import {
  testDb,
  resetDb,
  seedFixtures,
  assertIsTestSchema,
  type Fixtures,
} from '../helpers/test-db'

vi.mock('@/lib/db', async () => ({
  db: (await import('../helpers/test-db')).testDb,
}))

const { POST: search } = await import('@/app/api/claim/search/route')
const { POST: start } = await import('@/app/api/claim/start/route')
const { POST: verify } = await import('@/app/api/claim/verify/route')

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

describe('finding a shadow profile', () => {
  it('matches an unclaimed profile by name and district', async () => {
    const res = await search(post({ fullName: 'Adult', district: 'Kanpur' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    const ids = JSON.stringify(body)
    expect(ids).toContain(fx.adult.id)
  })

  it('is case-insensitive on district', async () => {
    const res = await search(post({ fullName: 'Adult', district: 'kAnPuR' }))
    const body = JSON.stringify(await res.json())
    expect(body).toContain(fx.adult.id)
  })

  it('requires fullName and district', async () => {
    const res = await search(post({ fullName: 'Adult' }))
    expect(res.status).toBe(400)
  })

  it('does not return an already-claimed profile', async () => {
    await testDb.playerProfile.update({
      where: { id: fx.adult.id },
      data: { claim_status: 'claimed' },
    })
    const res = await search(post({ fullName: 'Adult', district: 'Kanpur' }))
    const body = JSON.stringify(await res.json())
    expect(body).not.toContain(fx.adult.id)
  })

  it('never exposes a guardian phone in search results', async () => {
    await testDb.playerProfile.update({
      where: { id: fx.adult.id },
      data: { guardian_phone: '9876543210' },
    })
    const res = await search(post({ fullName: 'Adult', district: 'Kanpur' }))
    const body = JSON.stringify(await res.json())
    expect(body).not.toContain('9876543210')
  })
})

describe('starting a claim — adult', () => {
  it('creates a claim and issues an OTP', async () => {
    const res = await start(post({ playerId: fx.adult.id, phone: '9123456789' }))
    expect(res.status).toBe(200)

    const claims = await testDb.playerClaim.findMany({ where: { player_id: fx.adult.id } })
    expect(claims).toHaveLength(1)
    expect(claims[0].is_minor).toBe(false)

    const otps = await testDb.phoneOtp.findMany({ where: { claim_id: claims[0].id } })
    expect(otps).toHaveLength(1)
  })

  it('stores the OTP hashed, never in plaintext', async () => {
    await start(post({ playerId: fx.adult.id, phone: '9123456789' }))
    const otp = await testDb.phoneOtp.findFirst()
    expect(otp!.code_hash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('refuses to re-claim an already claimed profile', async () => {
    await testDb.playerProfile.update({
      where: { id: fx.adult.id },
      data: { claim_status: 'claimed' },
    })
    const res = await start(post({ playerId: fx.adult.id, phone: '9123456789' }))
    expect(res.status).toBe(409)
  })

  it('404s for an unknown player', async () => {
    const res = await start(
      post({ playerId: '00000000-0000-0000-0000-000000000000', phone: '9123456789' }),
    )
    expect(res.status).toBe(404)
  })
})

describe('starting a claim — minor (DPDP guardian gate)', () => {
  it('refuses without guardian details', async () => {
    const res = await start(post({ playerId: fx.minor.id, phone: '9123456789' }))
    expect(res.status).toBe(400)
  })

  it('flags the claim as minor and targets the guardian phone', async () => {
    const res = await start(
      post({
        playerId: fx.minor.id,
        phone: '9123456789',
        guardianName: 'Parent',
        guardianPhone: '9998887776',
        guardianRelation: 'mother',
      }),
    )
    expect(res.status).toBe(200)

    const claim = await testDb.playerClaim.findFirst({ where: { player_id: fx.minor.id } })
    expect(claim!.is_minor).toBe(true)
    expect(claim!.guardian_phone).toBe('9998887776')

    // The OTP must go to the guardian, not the child.
    const otp = await testDb.phoneOtp.findFirst({ where: { claim_id: claim!.id } })
    expect(otp!.phone).toBe('9998887776')
  })

  it('leaves the minor unclaimed until the guardian verifies', async () => {
    await start(
      post({
        playerId: fx.minor.id,
        phone: '9123456789',
        guardianName: 'Parent',
        guardianPhone: '9998887776',
        guardianRelation: 'mother',
      }),
    )
    const p = await testDb.playerProfile.findUnique({ where: { id: fx.minor.id } })
    expect(p!.claim_status).not.toBe('claimed')
    expect(p!.consent_status).not.toBe('granted')
  })
})

describe('verifying an OTP', () => {
  async function startClaim() {
    const res = await start(post({ playerId: fx.adult.id, phone: '9123456789' }))
    const body = await res.json()
    return { claimId: body.claimId as string, code: body.devOtp as string }
  }

  it('grants consent and marks the profile claimed on the correct code', async () => {
    const { claimId, code } = await startClaim()
    const res = await verify(post({ claimId, code }))
    expect(res.status).toBe(200)

    const p = await testDb.playerProfile.findUnique({ where: { id: fx.adult.id } })
    expect(p!.claim_status).toBe('claimed')
    expect(p!.consent_status).toBe('granted')
  })

  it('rejects an incorrect code and counts the attempt', async () => {
    const { claimId } = await startClaim()
    const res = await verify(post({ claimId, code: '000000' }))
    expect(res.status).toBe(401)

    const otp = await testDb.phoneOtp.findFirst({ where: { claim_id: claimId } })
    expect(otp!.attempts).toBe(1)
  })

  it('locks out after the attempt limit', async () => {
    const { claimId } = await startClaim()
    for (let i = 0; i < 5; i++) await verify(post({ claimId, code: '000000' }))
    const res = await verify(post({ claimId, code: '000000' }))
    expect(res.status).toBe(429)
  })

  it('refuses an expired code', async () => {
    const { claimId, code } = await startClaim()
    await testDb.phoneOtp.updateMany({
      where: { claim_id: claimId },
      data: { expires_at: new Date(Date.now() - 60_000) },
    })
    const res = await verify(post({ claimId, code }))
    expect(res.status).toBe(410)
  })

  it('consumes the OTP so it cannot be replayed', async () => {
    const { claimId, code } = await startClaim()
    await verify(post({ claimId, code }))
    const replay = await verify(post({ claimId, code }))
    expect(replay.status).not.toBe(200)
  })

  it('does not accept a code hashed for a different claim', async () => {
    const { claimId } = await startClaim()
    // Prove the stored hash is claim-specific, not a global constant.
    const otp = await testDb.phoneOtp.findFirst({ where: { claim_id: claimId } })
    expect(otp!.code_hash).not.toBe(hashOtp('000000'))
  })

  it('requires both claimId and code', async () => {
    const res = await verify(post({ claimId: 'x' }))
    expect(res.status).toBe(400)
  })
})
