/**
 * Cohort percentile for a player's own record view (pivot doc W6: "Percentile
 * vs cohort — age, district, role"). No existing age-category scheme is
 * shared across the app for players generally (academy batches use their own
 * U-10/U-13/U-17/Senior groups, scoped to batch scheduling, not this) — the
 * buckets below are introduced for this feature only.
 */
import { db } from '@/lib/db'
import { calculateAthlasXScore } from '@/lib/athlasx-score'
import { dbRoleMap } from '@/lib/mock-performance-seed'
import { verifiedPerformancesByPlayer } from '@/lib/verified-performances'
import type { PlayingRoleEnum } from '@prisma/client'

export type AgeCategory = 'U-14' | 'U-16' | 'U-19' | 'U-23' | 'Senior'

export function ageFromDob(dob: Date, now: Date = new Date()): number {
  let age = now.getFullYear() - dob.getFullYear()
  const m = now.getMonth() - dob.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--
  return age
}

export function ageCategoryForDob(dob: Date, now: Date = new Date()): AgeCategory {
  const age = ageFromDob(dob, now)
  if (age < 14) return 'U-14'
  if (age < 16) return 'U-16'
  if (age < 19) return 'U-19'
  if (age < 23) return 'U-23'
  return 'Senior'
}

/** Never show a percentile computed against a handful of players — too
 *  precise-looking a number for too thin a sample. */
export const MIN_COHORT_FOR_PERCENTILE = 5

export interface CohortPercentileResult {
  percentile: number | null
  cohortSize: number
  ageCategory: AgeCategory
}

/**
 * Percentile rank of `playerScore` among other PlayerProfile rows sharing
 * the same age category (derived from dob), district, and playing role.
 * Scores aren't cached anywhere (PlayerProfile.athlasx_score is a dead
 * column — every other consumer of AthlasX Score computes it on the fly
 * too, see candidate-pool/route.ts and coach/squad/route.ts), so cohort
 * members' scores are recomputed the same way the caller's own score is.
 */
export async function computeCohortPercentile(
  excludePlayerId: string,
  district: string,
  playingRole: PlayingRoleEnum | null,
  dob: Date,
  playerScore: number,
): Promise<CohortPercentileResult> {
  const ageCategory = ageCategoryForDob(dob)
  const now = new Date()

  const candidates = await db.playerProfile.findMany({
    where: {
      id: { not: excludePlayerId },
      district: { equals: district, mode: 'insensitive' },
      playing_role: playingRole,
      consent_status: { not: 'withdrawn' },
    },
    select: { id: true, dob: true },
  })

  const cohortIds = candidates.filter((c) => ageCategoryForDob(c.dob, now) === ageCategory).map((c) => c.id)

  if (cohortIds.length < MIN_COHORT_FOR_PERCENTILE - 1) {
    // -1 because the caller isn't in `candidates` (excluded above) but does
    // count toward the cohort themselves.
    return { percentile: null, cohortSize: cohortIds.length + 1, ageCategory }
  }

  const performancesByPlayer = await verifiedPerformancesByPlayer(cohortIds)
  const role = dbRoleMap[playingRole ?? 'Batsman'] ?? 'Batsman'

  const cohortScores = cohortIds.map((id) =>
    calculateAthlasXScore({ playingRole: role, performances: performancesByPlayer[id], yearsExperience: 3 }).total,
  )
  cohortScores.push(playerScore)

  const below = cohortScores.filter((s) => s < playerScore).length
  const percentile = Math.round((below / cohortScores.length) * 1000) / 10

  return { percentile, cohortSize: cohortScores.length, ageCategory }
}
