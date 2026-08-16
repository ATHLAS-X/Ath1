/**
 * AthlasX Score Engine — v1.2
 *
 * Produces a 0–100 composite score from verified match data only.
 *
 * v1.2 — coach fitness/behaviour ratings are structurally isolated out of
 * the score entirely (tests/known-defects DEFECT 1: there was no
 * `coachRatingSource` provenance check, so any caller could pass a
 * self-reported rating and it would be scored as if a coach supervised it,
 * for up to 25 of 100 points). Rather than adding a provenance field and
 * keeping the scoring weight, the decision (confirmed explicitly, not
 * assumed) was to remove coach ratings from the score's inputs altogether
 * — the score is now 100% verified-match-data-only (performance +
 * experience + volume), matching this file's own original doc-comment
 * promise ("Produces a 0–100 composite score from verified match data
 * only") which the fitness/behaviour components had actually been
 * contradicting. Coach ratings still exist as a real, separately-stored,
 * advisory-only signal — see src/lib/coach-advisory.ts and the
 * CoachAdvisoryNote model — visible to selectors as context, carrying zero
 * weight in this score.
 *
 * `coachFitnessRating`/`coachBehaviourRating` remain on AthlasXScoreInput
 * (deprecated, ignored) purely so existing callers don't need to change —
 * calculateAthlasXScore never reads them.
 *
 * Tournament Quality Index (TQI) weighting:
 *   State 1.0x · District 0.75x · Academy/Local 0.5x
 *
 * Batting and Bowling are scored from scorecard data.
 * Fielding and Keeping are NOT scored — scorecard data records only
 * successful attempts (catches, stumpings) and is blind to drops/misses.
 */

import type { TournamentLevel, PlayingRole } from '@/types'

export type { TournamentLevel, PlayingRole }

// TQI multipliers — applied as a quality discount on aggregated stats
export const TQI: Record<TournamentLevel, number> = {
  national: 1.0,
  state:    1.0,
  district: 0.75,
  local:    0.5,
}

// A resolved, verified performance row (Performance + its match's tournament
// level, joined) — field names mirror the canonical `Performance` type in
// src/types/index.ts so this isn't a second, drifting shape of the same data.
export interface VerifiedPerformanceRow {
  level:                  TournamentLevel
  batting_runs?:          number
  batting_balls?:         number
  batting_dismissed?:     boolean
  bowling_overs?:         number
  bowling_wickets?:       number
  bowling_runs_conceded?: number
}

export interface AthlasXScoreInput {
  playingRole:  PlayingRole
  performances: VerifiedPerformanceRow[]  // from association-verified match data only
  /** @deprecated No longer read by calculateAthlasXScore (DEFECT 1 fix,
   *  see file header) — coach ratings are structurally isolated from the
   *  score. Kept on the type only so existing call sites still compile;
   *  the real advisory rating lives in CoachAdvisoryNote. */
  coachFitnessRating?:    number
  /** @deprecated Same as coachFitnessRating — never read. */
  coachBehaviourRating?:  number
  yearsExperience:        number
}

export interface AthlasXScoreBreakdown {
  total:        number   // 0–100
  batting:      number   // 0–10 (display card, verified data only)
  bowling:      number   // 0–10 (display card, verified data only)
  performance:  number   // 0–40 (weighted by TQI)
  experience:   number   // 0–15
  fitness:      number   // 0–15 (coach-supervised only, 0 if not yet assessed)
  behaviour:    number   // 0–10 (coach behavioural evaluation, 0 if not yet assessed)
  volume:       number   // 0–10
  fitnessAssessed:   boolean
  behaviourAssessed: boolean
  // Provenance
  verifiedMatchCount: number
  tqiWeightedMatches: number  // effective match count after TQI weighting
}

function clamp(v: number, lo = 0, hi = 100) {
  return Math.max(lo, Math.min(hi, v))
}

// ── Aggregate batting stats, TQI applied as a quality discount ─────────────────
// Average is runs per DISMISSAL, not per innings — an unbeaten innings does
// not count against the divisor. TQI is applied once, as a multiplicative
// discount on the finished rate stats (not baked into both the numerator and
// denominator of the rate itself, which would mostly cancel out).
function aggregateBatting(rows: VerifiedPerformanceRow[]) {
  let runs = 0, balls = 0, dismissals = 0, matches = 0, tqiSum = 0

  for (const r of rows) {
    if (r.batting_runs === undefined) continue
    runs += r.batting_runs
    balls += r.batting_balls ?? 0
    if (r.batting_dismissed) dismissals++
    matches++
    tqiSum += TQI[r.level]
  }

  if (matches === 0) return { avg: 0, sr: 0, matches: 0 }

  const qualityFactor = tqiSum / matches
  const rawAvg = dismissals > 0 ? runs / dismissals : runs / matches
  const rawSr  = balls > 0 ? (runs / balls) * 100 : 0

  return { avg: rawAvg * qualityFactor, sr: rawSr * qualityFactor, matches }
}

// ── Aggregate bowling stats, TQI applied as a quality discount ─────────────────
// Economy and average are "lower is better," so a discount for playing mostly
// weak competition must make them worse (divide), the mirror of batting.
function aggregateBowling(rows: VerifiedPerformanceRow[]) {
  let wickets = 0, runsConceded = 0, overs = 0, matches = 0, tqiSum = 0

  for (const r of rows) {
    if (r.bowling_overs === undefined) continue
    wickets += r.bowling_wickets ?? 0
    runsConceded += r.bowling_runs_conceded ?? 0
    overs += r.bowling_overs
    matches++
    tqiSum += TQI[r.level]
  }

  if (matches === 0 || overs === 0) return { economy: 0, avg: 0, matches: 0 }

  const qualityFactor = Math.max(tqiSum / matches, 0.01)
  const rawEconomy = runsConceded / overs
  const rawAvg = wickets > 0 ? runsConceded / wickets : rawEconomy * 6 // no wicket yet: economy-implied ceiling, not a fixed 99

  return { economy: rawEconomy / qualityFactor, avg: rawAvg / qualityFactor, matches }
}

// ── 0–10 batting display score ─────────────────────────────────────────────────
// Benchmarks: District-quality batsman avg ~35, SR ~140
function battingDisplayScore(avg: number, sr: number): number {
  const avgScore = clamp((avg / 35) * 10, 0, 10)
  const srScore  = clamp((sr  / 140) * 10, 0, 10)
  return Math.round((avgScore * 0.55 + srScore * 0.45) * 10) / 10
}

// ── 0–10 bowling display score ─────────────────────────────────────────────────
// Benchmarks: District-quality bowler economy ~6.5, avg ~28.
// An economy of exactly 0 (a maiden-only spell) is the best possible outcome,
// not "no data" — absence of bowling data is gated by the caller instead.
function bowlingDisplayScore(economy: number, avg: number): number {
  const ecoScore = clamp(((10 - economy) / 4) * 10, 0, 10)   // 6.5 eco → 10, 10.5 eco → 0
  const avgScore = clamp(((40 - avg)     / 25) * 10, 0, 10)  // 15 avg → 10, 40 avg → 0
  return Math.round((ecoScore * 0.55 + avgScore * 0.45) * 10) / 10
}

// ── Performance component (0–40) ───────────────────────────────────────────────
function calcPerformance(input: AthlasXScoreInput): { score: number; battingDisplay: number; bowlingDisplay: number } {
  const { playingRole, performances } = input
  const bat = aggregateBatting(performances)
  const bwl = aggregateBowling(performances)

  const battingDisplay = bat.matches > 0 ? battingDisplayScore(bat.avg, bat.sr) : 0
  const bowlingDisplay = bwl.matches > 0 ? bowlingDisplayScore(bwl.economy, bwl.avg) : 0

  let score: number
  if (playingRole === 'Batsman' || playingRole === 'Wicket-keeper Batsman') {
    score = (battingDisplay / 10) * 40
  } else if (playingRole === 'Bowler') {
    score = (bowlingDisplay / 10) * 40
  } else {
    // All-rounder: weighted average (batting heavier at this tier)
    score = ((battingDisplay * 0.55 + bowlingDisplay * 0.45) / 10) * 40
  }

  return { score: clamp(score, 0, 40), battingDisplay, bowlingDisplay }
}

// ── Experience component (0–15) ────────────────────────────────────────────────
function calcExperience(input: AthlasXScoreInput): number {
  const tqiWeighted = input.performances.reduce((sum, r) => sum + TQI[r.level], 0)

  const matchVol   = clamp((tqiWeighted / 30) * 8, 0, 8)   // 30 TQI-weighted matches → full
  const yearsScore = clamp((input.yearsExperience / 8) * 4, 0, 4)

  const levels = input.performances.map(r => r.level)
  const levelScore =
    levels.includes('national') || levels.includes('state') ? 3 :
    levels.includes('district') ? 2 :
    1

  return clamp(matchVol + yearsScore + levelScore, 0, 15)
}

// ── Fitness component (0–15) — supervised only ─────────────────────────────────
function calcFitness(rating?: number): number {
  if (!rating) return 0
  return clamp((rating / 5) * 15, 0, 15)
}

// ── Behaviour component (0–10) — coach evaluation only ────────────────────────
function calcBehaviour(rating?: number): number {
  if (!rating) return 0
  return clamp((rating / 5) * 10, 0, 10)
}

// ── Volume component (0–10) ────────────────────────────────────────────────────
function calcVolume(performances: VerifiedPerformanceRow[]): number {
  const tqiWeighted = performances.reduce((sum, r) => sum + TQI[r.level], 0)
  return clamp((tqiWeighted / 25) * 10, 0, 10)
}

// ── Main export ────────────────────────────────────────────────────────────────
// Fitness/behaviour are always "not assessed" here and never contribute
// points — DEFECT 1 fix, see file header. activeMax is therefore always the
// fixed sum of performance+experience+volume; there is no renormalisation
// branch left to isolate a coach rating from, by construction.
const MAX_POINTS = { performance: 40, experience: 15, volume: 10 }

export function calculateAthlasXScore(input: AthlasXScoreInput): AthlasXScoreBreakdown {
  const perf       = calcPerformance(input)
  const experience = calcExperience(input)
  const fitnessAssessed   = false
  const behaviourAssessed = false
  const fitness     = calcFitness(undefined)
  const behaviour   = calcBehaviour(undefined)
  const volume      = calcVolume(input.performances)

  const rawSum = perf.score + experience + volume
  const activeMax = MAX_POINTS.performance + MAX_POINTS.experience + MAX_POINTS.volume

  const total = Math.round((rawSum / activeMax) * 100)

  const tqiWeightedMatches = input.performances.reduce((sum, r) => sum + TQI[r.level], 0)

  return {
    total:             clamp(total),
    batting:           perf.battingDisplay,
    bowling:           perf.bowlingDisplay,
    performance:       Math.round(perf.score  * 10) / 10,
    experience:        Math.round(experience  * 10) / 10,
    fitness:           Math.round(fitness     * 10) / 10,
    behaviour:         Math.round(behaviour   * 10) / 10,
    volume:            Math.round(volume      * 10) / 10,
    fitnessAssessed,
    behaviourAssessed,
    verifiedMatchCount:  input.performances.length,
    tqiWeightedMatches:  Math.round(tqiWeightedMatches * 10) / 10,
  }
}

// ── Score tier label ───────────────────────────────────────────────────────────
export function getScoreTier(score: number): { label: string; color: string; description: string } {
  if (score >= 85) return { label: 'Elite',      color: '#22c55e', description: 'State-ready. Top district-level talent.' }
  if (score >= 70) return { label: 'Advanced',   color: '#3b82f6', description: 'Consistent district performer. State pathway clear.' }
  if (score >= 55) return { label: 'Developing', color: '#f59e0b', description: 'Solid foundation. Keep building match volume.' }
  return              { label: 'Rising',     color: '#a855f7', description: 'Early career. Accumulate verified match data.' }
}

// ── Provenance label for the Quick View card ───────────────────────────────────
export function getProvenanceLabel(count: number, tqiWeighted: number, topLevel: TournamentLevel): string {
  const levelLabel = topLevel === 'state' || topLevel === 'national' ? 'State' : 'District'
  return `${count} verified matches · ${levelLabel} level · TQI-weighted ${tqiWeighted.toFixed(1)}`
}
