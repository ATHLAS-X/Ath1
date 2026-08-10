/**
 * Cricket performance math used by Step 5 (StepStats) and the AthlasX scoring engine.
 */

export interface BattingInputs {
  matches: number;
  innings: number;
  runs: number;
  not_outs: number;
  highest_score: number;
  fifties: number;
  hundreds: number;
  powerplay_sr: number | null;
  middle_avg: number | null;
  death_sr: number | null;
}

export interface BowlingInputs {
  overs_bowled: number;
  wickets: number;
  economy: number | null;
  bowl_avg: number | null;
  bowl_sr: number | null;
  best_figures: string | null;
}

export function battingAverage(b: BattingInputs): number {
  const dismissals = Math.max(1, b.innings - b.not_outs);
  return b.runs / dismissals;
}

/** Representative SR = average of phase SRs that are present; falls back to 100. */
export function representativeSR(b: BattingInputs): number {
  const xs: number[] = [];
  if (b.powerplay_sr != null && b.powerplay_sr > 0) xs.push(b.powerplay_sr);
  if (b.death_sr != null && b.death_sr > 0) xs.push(b.death_sr);
  if (!xs.length) return 100;
  return xs.reduce((a, c) => a + c, 0) / xs.length;
}

/** BPI = Average × (SR / 100). */
export function calculateBPI(b: BattingInputs): number {
  const avg = battingAverage(b);
  const sr = representativeSR(b);
  return Number((avg * (sr / 100)).toFixed(2));
}

/** CBR = cube root of (economy × avg × SR). Lower-is-better metrics, so smaller CBR is better. */
export function calculateCBR(b: BowlingInputs): number {
  const e = b.economy ?? 0;
  const a = b.bowl_avg ?? 0;
  const s = b.bowl_sr ?? 0;
  if (e <= 0 || a <= 0 || s <= 0) return 0;
  return Number(Math.cbrt(e * a * s).toFixed(2));
}

export interface RoadmapGaps {
  bpi: number;
  cbr: number;
  bpi_district: number;
  bpi_state: number;
  bpi_national: number;
  bpi_ipl: number;
  bpi_gap_to_state: number;
  cbr_district: number;
  cbr_state: number;
  cbr_national: number;
  cbr_ipl: number;
  cbr_gap_to_state: number;
}

export const BPI_BENCHMARKS = { district: 22, state: 28, national: 36, ipl: 40.5 };
export const CBR_BENCHMARKS = { district: 24, state: 22, national: 20, ipl: 15 };

/** For CBR lower is better, so "gap" = current - target. For BPI higher is better, so gap = target - current. */
export function roadmapGaps(bpi: number, cbr: number): RoadmapGaps {
  return {
    bpi,
    cbr,
    bpi_district: BPI_BENCHMARKS.district,
    bpi_state: BPI_BENCHMARKS.state,
    bpi_national: BPI_BENCHMARKS.national,
    bpi_ipl: BPI_BENCHMARKS.ipl,
    bpi_gap_to_state: Number((BPI_BENCHMARKS.state - bpi).toFixed(2)),
    cbr_district: CBR_BENCHMARKS.district,
    cbr_state: CBR_BENCHMARKS.state,
    cbr_national: CBR_BENCHMARKS.national,
    cbr_ipl: CBR_BENCHMARKS.ipl,
    cbr_gap_to_state: Number((cbr - CBR_BENCHMARKS.state).toFixed(2)),
  };
}
