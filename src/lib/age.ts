/**
 * Single shared age/minor calculation — audit finding: this logic was
 * duplicated 6+ times across the codebase (src/app/api/player/onboard,
 * src/app/player/onboarding/page.tsx, src/app/api/claim/start,
 * src/app/api/academy/join/[academyId]/submit, src/app/(dashboard)/academy/
 * add-players/page.tsx, src/app/join/[academyId]/page.tsx,
 * src/lib/academy/players.ts x2), several of them using naive
 * `now.getFullYear() - dob.getFullYear()` subtraction — wrong by one year
 * for anyone whose birthday hasn't happened yet this calendar year.
 *
 * Zero external imports so this is safe to use from BOTH client and server
 * code — unlike src/lib/player-cohort.ts (which already had a correct
 * ageFromDob, but pulls in @/lib/db and can't be imported from a client
 * component). player-cohort.ts now re-exports ageFromDob from here instead
 * of keeping its own duplicate.
 */
export function ageFromDob(dob: Date, now: Date = new Date()): number {
  let age = now.getFullYear() - dob.getFullYear()
  const m = now.getMonth() - dob.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--
  return age
}

export function isUnder18(dob: Date | string, now: Date = new Date()): boolean {
  const d = typeof dob === 'string' ? new Date(dob) : dob
  return ageFromDob(d, now) < 18
}
