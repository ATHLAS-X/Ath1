/**
 * Records the specific guardian-consent event at the moment it completes in
 * the player onboarding wizard (Stage 3's dpdpGuardian ConsentPanel), not
 * inferred after the fact from a boolean flag. `consentTextVersion` should
 * be a stable identifier for exactly which copy was shown — see
 * GUARDIAN_CONSENT_TEXT_VERSION in src/app/api/player/onboard/route.ts —
 * so a later copy rewrite never retroactively changes what an earlier
 * guardian is understood to have agreed to.
 *
 * Wired into /api/player/onboard as of 2026-09-21, inside the same
 * transaction that creates the player profile, so a guardian-consent
 * record and the profile it belongs to are never split by a mid-write
 * failure.
 */
import { db } from '@/lib/db'
import type { Prisma } from '@prisma/client'

type DbClient = typeof db | Prisma.TransactionClient

export interface RecordGuardianConsentInput {
  playerId: string
  guardianName: string
  guardianRelation: string
  consentTextVersion: string
  /** "aadhaar_otp_stub" today; "digilocker_token" (or another vendor's
   *  method) once real eKYC lands — a plain string, not a hardcoded enum,
   *  by design (see prisma/schema.prisma's ConsentRecord comment). */
  verificationMethod: string
  verifiedAt: Date
}

export async function recordGuardianConsent(input: RecordGuardianConsentInput, client: DbClient = db) {
  return client.consentRecord.create({
    data: {
      player_id: input.playerId,
      guardian_name: input.guardianName,
      guardian_relation: input.guardianRelation,
      consent_text_version: input.consentTextVersion,
      verification_method: input.verificationMethod,
      verified_at: input.verifiedAt,
    },
  })
}

export async function guardianConsentRecordsForPlayer(playerId: string) {
  return db.consentRecord.findMany({
    where: { player_id: playerId },
    orderBy: { created_at: 'desc' },
  })
}
