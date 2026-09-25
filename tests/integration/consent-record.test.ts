/**
 * ConsentRecord — pushed live 2026-09-21 (explicit go-ahead) and wired
 * into /api/player/onboard's real submit flow. Unskipped accordingly.
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import { testDb, resetDb, seedFixtures, assertIsTestSchema, type Fixtures } from '../helpers/test-db'

vi.mock('@/lib/db', async () => ({
  db: (await import('../helpers/test-db')).testDb,
}))

const { recordGuardianConsent, guardianConsentRecordsForPlayer } = await import('@/lib/consent-record')

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

describe('ConsentRecord — guardian consent completion', () => {
  it('creates a record linked to the minor player, not a free-text name only', async () => {
    const verifiedAt = new Date()

    const record = await recordGuardianConsent({
      playerId: fx.minor.id,
      guardianName: 'Test Guardian',
      guardianRelation: 'Mother',
      consentTextVersion: 'guardian_dpdp_v1',
      verificationMethod: 'aadhaar_otp_stub',
      verifiedAt,
    })

    expect(record.player_id).toBe(fx.minor.id)
    expect(record.consent_text_version).toBe('guardian_dpdp_v1')
    expect(record.verification_method).toBe('aadhaar_otp_stub')
    expect(record.verified_at.getTime()).toBe(verifiedAt.getTime())
  })

  it('is queryable independently of the player’s own identity-verification record', async () => {
    await recordGuardianConsent({
      playerId: fx.minor.id,
      guardianName: 'Test Guardian',
      guardianRelation: 'Father',
      consentTextVersion: 'guardian_dpdp_v1',
      verificationMethod: 'aadhaar_otp_stub',
      verifiedAt: new Date(),
    })

    const records = await guardianConsentRecordsForPlayer(fx.minor.id)
    expect(records).toHaveLength(1)
    expect(records[0].guardian_relation).toBe('Father')

    // The adult fixture never went through guardian consent — its own
    // query must come back empty, proving records are per-player, not
    // shared or global.
    const adultRecords = await guardianConsentRecordsForPlayer(fx.adult.id)
    expect(adultRecords).toHaveLength(0)
  })
})
