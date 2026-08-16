/**
 * W8 — ranked academy production view.
 *
 * There is no direct PlayerProfile → Academy foreign key in this schema
 * (players carry a free-text `academy` string from ingest, never a
 * confirmed academy_id — the confirm/reject queue only reconciles the raw
 * strings against the registry, it doesn't relink player rows). So
 * "affiliation" here is computed live, the same way academy-capture.ts
 * decides auto-attach: bestSimilarity(player.academy, academy.name,
 * academy.name_variants) >= AUTO_ATTACH_THRESHOLD, reusing the same
 * threshold and the same (now-fixed, see string-similarity.ts) matcher so
 * the reconciliation queue and this ranking never disagree about what
 * counts as "the same academy".
 *
 * "Advanced to district+ level" is read literally: this schema's
 * TournamentLevel is local/district/state/national (district is a real
 * middle tier, not the ceiling), so district+ = level != 'local'.
 */
import { db } from '@/lib/db'
import { bestSimilarity } from '@/lib/string-similarity'
import { AUTO_ATTACH_THRESHOLD } from '@/lib/academy-capture'

export interface AcademyProductionRow {
  academyId: string
  name: string
  district: string
  affiliatedPlayers: number
  advancedPlayers: number
}

export async function getAcademyProduction(): Promise<AcademyProductionRow[]> {
  const [academies, players] = await Promise.all([
    db.academy.findMany({ select: { id: true, name: true, district: true, name_variants: true } }),
    db.playerProfile.findMany({
      where: { academy: { not: null } },
      select: {
        id: true,
        academy: true,
        performances: {
          where: { association_approval_status: 'approved' },
          select: { match: { select: { tournament: { select: { level: true } } } } },
        },
      },
    }),
  ])

  const playerAdvanced = new Map<string, boolean>()
  for (const p of players) {
    playerAdvanced.set(p.id, p.performances.some(perf => perf.match.tournament.level !== 'local'))
  }

  const rows: AcademyProductionRow[] = academies.map(a => {
    let affiliated = 0
    let advanced = 0
    for (const p of players) {
      if (!p.academy) continue
      const score = bestSimilarity(p.academy, a.name, a.name_variants)
      if (score < AUTO_ATTACH_THRESHOLD) continue
      affiliated++
      if (playerAdvanced.get(p.id)) advanced++
    }
    return { academyId: a.id, name: a.name, district: a.district, affiliatedPlayers: affiliated, advancedPlayers: advanced }
  })

  return rows.sort((a, b) => b.advancedPlayers - a.advancedPlayers || b.affiliatedPlayers - a.affiliatedPlayers)
}
