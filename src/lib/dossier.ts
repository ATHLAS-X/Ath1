/**
 * W3 — pre-camp dossier generation.
 *
 * A dossier is generated lazily on first view and is immutable once created
 * (matching the same "compute once, cache, self-heal via regeneration only
 * if explicitly requested" convention used elsewhere in this codebase —
 * there is no scheduled job runner to pre-generate these).
 *
 * Two shapes:
 *  - Full dossier: the registrant has at least one association-approved
 *    Performance row (real tournament history). Batting/bowling summary and
 *    AthlasX score come from calculateAthlasXScore, fed real Performance
 *    data joined to its Match's Tournament level — the same input contract
 *    every other verified-data consumer in this codebase already uses.
 *  - Thin dossier: no Performance rows exist. `has_match_history: false`,
 *    no score/percentile — never a fabricated number.
 */
import { db } from '@/lib/db'
import { calculateAthlasXScore, type VerifiedPerformanceRow } from '@/lib/athlasx-score'
import type { PlayingRole } from '@/types'

const MIN_COHORT_FOR_PERCENTILE = 5

export interface DossierContents {
  batting: number
  bowling: number
  total: number
  match_count: number
  data_sources: string[]
  cohort_size: number
  recent_form: { level: string; batting_runs: number | null; bowling_wickets: number | null }[]
}

async function playerVerifiedPerformances(playerId: string): Promise<VerifiedPerformanceRow[]> {
  const rows = await db.performance.findMany({
    where: { player_id: playerId, association_approval_status: 'approved' },
    include: { match: { include: { tournament: { select: { level: true } } } } },
    orderBy: { id: 'desc' },
  })
  return rows.map(r => ({
    level: r.match.tournament.level,
    batting_runs: r.batting_runs ?? undefined,
    batting_balls: r.batting_balls ?? undefined,
    batting_dismissed: r.batting_dismissed ?? undefined,
    bowling_overs: r.bowling_overs ?? undefined,
    bowling_wickets: r.bowling_wickets ?? undefined,
    bowling_runs_conceded: r.bowling_runs_conceded ?? undefined,
  }))
}

function scoreFor(role: PlayingRole | null, performances: VerifiedPerformanceRow[]) {
  return calculateAthlasXScore({
    playingRole: role ?? 'Batsman',
    performances,
    yearsExperience: 3, // not collected at registration time; a neutral default, same as my-record's placeholder
  })
}

/** Rank-based percentile among the trial cycle's other registrants who also
 *  have real match history. Hand-rolled sorted rank, not a library — same
 *  convention as every other cohort calculation planned/used in this
 *  codebase. Returns null below the cohort floor so a thin cohort never
 *  produces a misleadingly precise number. */
async function cohortPercentile(trialCycleId: string, registrationId: string, playerTotal: number): Promise<{ percentile: number | null; cohortSize: number }> {
  const cohortRegs = await db.registration.findMany({
    where: { trial_cycle_id: trialCycleId, id: { not: registrationId } },
    select: { player_id: true, player: { select: { playing_role: true } } },
  })

  const cohortScores: number[] = []
  for (const reg of cohortRegs) {
    const perfs = await playerVerifiedPerformances(reg.player_id)
    if (perfs.length === 0) continue
    cohortScores.push(scoreFor(reg.player.playing_role as PlayingRole | null, perfs).total)
  }

  if (cohortScores.length < MIN_COHORT_FOR_PERCENTILE) {
    return { percentile: null, cohortSize: cohortScores.length }
  }

  const below = cohortScores.filter(s => s < playerTotal).length
  const percentile = Math.round((below / cohortScores.length) * 1000) / 10
  return { percentile, cohortSize: cohortScores.length }
}

export async function getOrGenerateDossier(registrationId: string) {
  const existing = await db.dossier.findUnique({ where: { registration_id: registrationId } })
  if (existing) return existing

  const registration = await db.registration.findUnique({
    where: { id: registrationId },
    include: { player: true },
  })
  if (!registration) return null

  const performances = await playerVerifiedPerformances(registration.player_id)
  const hasHistory = performances.length > 0

  let contents: DossierContents
  let percentile: number | null = null

  if (hasHistory) {
    const breakdown = scoreFor(registration.player.playing_role as PlayingRole | null, performances)
    const { percentile: pct, cohortSize } = await cohortPercentile(registration.trial_cycle_id, registrationId, breakdown.total)
    percentile = pct
    contents = {
      batting: breakdown.batting,
      bowling: breakdown.bowling,
      total: breakdown.total,
      match_count: breakdown.verifiedMatchCount,
      data_sources: ['association-verified match data'],
      cohort_size: cohortSize,
      recent_form: performances.slice(0, 5).map(p => ({
        level: p.level,
        batting_runs: p.batting_runs ?? null,
        bowling_wickets: p.bowling_wickets ?? null,
      })),
    }
  } else {
    contents = {
      batting: 0,
      bowling: 0,
      total: 0,
      match_count: 0,
      data_sources: [],
      cohort_size: 0,
      recent_form: [],
    }
  }

  return db.dossier.create({
    data: {
      registration_id: registrationId,
      player_id: registration.player_id,
      trial_cycle_id: registration.trial_cycle_id,
      generated_at: new Date(),
      has_match_history: hasHistory,
      percentile_vs_cohort: percentile,
      contents_snapshot: contents as object,
    },
  })
}
