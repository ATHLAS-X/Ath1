/**
 * AthlasX Score Engine — v1.0
 *
 * Produces a 0–100 composite score from verified match data only.
 * Self-reported inputs (fitness, mindset) are NOT accepted — those come
 * from supervised assessments and coach behavioral evaluations only.
 *
 * Tournament Quality Index (TQI) weighting:
 *   State 1.0x · District 0.75x · Academy/Local 0.5x
 *
 * Batting and Bowling are scored from scorecard data.
 * Fielding and Keeping are NOT scored — scorecard data records only
 * successful attempts (catches, stumpings) and is blind to drops/misses.
 */

export type TournamentLevel = 'local' | 'district' | 'state' | 'national'
export type PlayingRole = 'Batsman' | 'Bowler' | 'All-rounder' | 'Wicket-keeper Batsman'

// TQI multipliers — applied to each performance row before aggregation
export const TQI: Record<TournamentLevel, number> = {
  national: 1.0,
  state:    1.0,
  district: 0.75,
  local:    0.5,
}

export interface VerifiedPerformanceRow {
  level:       TournamentLevel
  // Batting
  runs?:       number
  balls?:      number
  // Bowling
  overs?:      number
  wickets?:    number
  runsConceded?: number
}

export interface AthlasXScoreInput {
  playingRole:  PlayingRole
  performances: VerifiedPerformanceRow[]  // from association-verified match data only
  // Coach evaluation — supervised, not self-reported
  coachFitnessRating?:    number  // 1–5, set by coach or AthlasX ops. Absent = not yet evaluated
  coachBehaviourRating?:  number  // 1–5, set by coach based on behavioural observation
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
  // Provenance
  verifiedMatchCount: number
  tqiWeightedMatches: number  // effective match count after TQI weighting
}

function clamp(v: number, lo = 0, hi = 100) {
  return Math.max(lo, Math.min(hi, v))
}

function safe(n: number | undefined) {
  return n && isFinite(n) && n > 0 ? n : 0
}

// ── Aggregate TQI-weighted batting stats ───────────────────────────────────────
function aggregateBatting(rows: VerifiedPerformanceRow[]) {
  let weightedRuns = 0, weightedBalls = 0, inningsCount = 0

  for (const r of rows) {
    if (r.runs === undefined) continue
    const w = TQI[r.level]
    weightedRuns  += r.runs  * w
    weightedBalls += (r.balls ?? 0) * w
    inningsCount++
  }

  const avg = inningsCount > 0 ? weightedRuns / inningsCount : 0
  const sr  = weightedBalls > 0 ? (weightedRuns / weightedBalls) * 100 : 0
  return { avg, sr, inningsCount }
}

// ── Aggregate TQI-weighted bowling stats ───────────────────────────────────────
function aggregateBowling(rows: VerifiedPerformanceRow[]) {
  let weightedWickets = 0, weightedRuns = 0, weightedOvers = 0, bowlingInnings = 0

  for (const r of rows) {
    if (r.overs === undefined) continue
    const w = TQI[r.level]
    weightedWickets += (r.wickets      ?? 0) * w
    weightedRuns    += (r.runsConceded ?? 0) * w
    weightedOvers   += r.overs * w
    bowlingInnings++
  }

  const economy = weightedOvers > 0 ? weightedRuns / weightedOvers : 0
  const avg     = weightedWickets > 0 ? weightedRuns / weightedWickets : 99
  const sr      = weightedWickets > 0 ? (weightedOvers * 6) / weightedWickets : 999
  return { economy, avg, sr, weightedWickets, bowlingInnings }
}

// ── 0–10 batting display score ─────────────────────────────────────────────────
// Benchmarks: District-quality batsman avg ~25, SR ~120
function battingDisplayScore(avg: number, sr: number): number {
  if (avg === 0 && sr === 0) return 0
  const avgScore = clamp((avg / 35) * 10, 0, 10)
  const srScore  = clamp((sr  / 140) * 10, 0, 10)
  return Math.round((avgScore * 0.55 + srScore * 0.45) * 10) / 10
}

// ── 0–10 bowling display score ─────────────────────────────────────────────────
// Benchmarks: District-quality bowler economy ~7.5, avg ~28
function bowlingDisplayScore(economy: number, avg: number, sr: number): number {
  if (economy === 0) return 0
  const ecoScore = clamp(((10 - economy) / 4) * 10, 0, 10)   // 6.5 eco → 10, 10.5 eco → 0
  const avgScore = clamp(((40 - avg)     / 25) * 10, 0, 10)  // 15 avg → 10, 40 avg → 0
  return Math.round((ecoScore * 0.55 + avgScore * 0.45) * 10) / 10
}

// ── Performance component (0–40) ───────────────────────────────────────────────
function calcPerformance(input: AthlasXScoreInput): { score: number; battingDisplay: number; bowlingDisplay: number } {
  const { playingRole, performances } = input
  const bat = aggregateBatting(performances)
  const bwl = aggregateBowling(performances)

  const battingDisplay = battingDisplayScore(bat.avg, bat.sr)
  const bowlingDisplay = bowlingDisplayScore(bwl.economy, bwl.avg, bwl.sr)

  // Normalise to 0–40
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
  const totalMatches = input.performances.length
  const tqiWeighted  = input.performances.reduce((sum, r) => sum + TQI[r.level], 0)

  const matchVol  = clamp((tqiWeighted / 30) * 8, 0, 8)   // 30 TQI-weighted matches → full
  const yearsScore = clamp((input.yearsExperience / 8) * 4, 0, 4)

  // Highest level reached
  const levels = input.performances.map(r => r.level)
  const levelScore =
    levels.includes('national') ? 3 :
    levels.includes('state')    ? 3 :
    levels.includes('district') ? 2 :
    1

  return clamp(matchVol + yearsScore + levelScore, 0, 15)
}

// ── Fitness component (0–15) — supervised only ─────────────────────────────────
function calcFitness(rating?: number): number {
  if (!rating) return 0  // not yet assessed — no score, not a penalty
  return clamp((rating / 5) * 15, 0, 15)
}

// ── Behaviour component (0–10) — coach evaluation only ────────────────────────
function calcBehaviour(rating?: number): number {
  if (!rating) return 0  // not yet evaluated
  return clamp((rating / 5) * 10, 0, 10)
}

// ── Volume component (0–10) ────────────────────────────────────────────────────
function calcVolume(performances: VerifiedPerformanceRow[]): number {
  const tqiWeighted = performances.reduce((sum, r) => sum + TQI[r.level], 0)
  return clamp((tqiWeighted / 25) * 10, 0, 10)
}

// ── Main export ────────────────────────────────────────────────────────────────
export function calculateAthlasXScore(input: AthlasXScoreInput): AthlasXScoreBreakdown {
  const perf      = calcPerformance(input)
  const experience = calcExperience(input)
  const fitness   = calcFitness(input.coachFitnessRating)
  const behaviour = calcBehaviour(input.coachBehaviourRating)
  const volume    = calcVolume(input.performances)

  const total = Math.round(perf.score + experience + fitness + behaviour + volume)

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
  return `${count} verified matches · ${levelLabel} level · TQI ${tqiWeighted.toFixed(1)}x`
}
