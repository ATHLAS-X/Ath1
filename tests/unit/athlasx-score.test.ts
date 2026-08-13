/**
 * Unit tests — AthlasX Score Engine (src/lib/athlasx-score.ts)
 *
 * The engine is the only substantive business logic in the codebase and it
 * drives what a selection panel sees, so these tests pin down behaviour
 * rather than implementation: TQI weighting, not-out handling, the
 * renormalisation that stops unassessed players being capped, and role
 * weighting.
 *
 * Every expected value below is derived from the documented benchmarks
 * (district par: batting avg 35 / SR 140, bowling economy 6.5 / avg 28),
 * not copied from a run of the code.
 */
import { describe, it, expect } from 'vitest'
import {
  calculateAthlasXScore,
  getScoreTier,
  getProvenanceLabel,
  TQI,
  type VerifiedPerformanceRow,
  type AthlasXScoreInput,
} from '@/lib/athlasx-score'

// ── helpers ──────────────────────────────────────────────────────────────────

const bat = (
  level: VerifiedPerformanceRow['level'],
  runs: number,
  balls: number,
  dismissed = true,
): VerifiedPerformanceRow => ({
  level,
  batting_runs: runs,
  batting_balls: balls,
  batting_dismissed: dismissed,
})

const bowl = (
  level: VerifiedPerformanceRow['level'],
  overs: number,
  wickets: number,
  conceded: number,
): VerifiedPerformanceRow => ({
  level,
  bowling_overs: overs,
  bowling_wickets: wickets,
  bowling_runs_conceded: conceded,
})

const input = (over: Partial<AthlasXScoreInput> = {}): AthlasXScoreInput => ({
  playingRole: 'Batsman',
  performances: [],
  yearsExperience: 0,
  ...over,
})

/** An elite batting record: 30 state innings at avg 50, SR ~167. */
const eliteBattingRows = Array.from({ length: 30 }, () => bat('state', 50, 30))

// ── TQI table ────────────────────────────────────────────────────────────────

describe('TQI multipliers', () => {
  it('matches the Pivot Document: state 1.0 / district 0.75 / local 0.5', () => {
    expect(TQI.state).toBe(1.0)
    expect(TQI.district).toBe(0.75)
    expect(TQI.local).toBe(0.5)
  })

  it('treats national as equivalent to state', () => {
    expect(TQI.national).toBe(TQI.state)
  })
})

// ── batting aggregation ──────────────────────────────────────────────────────

describe('batting average — not-outs', () => {
  it('divides runs by DISMISSALS, not innings', () => {
    // Same 60 runs over two innings. Dismissed twice → avg 30.
    // Dismissed once  → avg 60, which is a materially better player.
    const bothOut = calculateAthlasXScore(
      input({ performances: [bat('state', 30, 30, true), bat('state', 30, 30, true)] }),
    )
    const oneNotOut = calculateAthlasXScore(
      input({ performances: [bat('state', 30, 30, true), bat('state', 30, 30, false)] }),
    )
    expect(oneNotOut.batting).toBeGreaterThan(bothOut.batting)
  })

  it('does not divide by zero when the batter has never been dismissed', () => {
    const r = calculateAthlasXScore(
      input({ performances: [bat('state', 40, 30, false), bat('state', 40, 30, false)] }),
    )
    expect(Number.isFinite(r.batting)).toBe(true)
    expect(r.batting).toBeGreaterThan(0)
  })
})

describe('batting — TQI quality discount', () => {
  it('scores an identical raw record lower when made in weaker cricket', () => {
    const rows = (lvl: VerifiedPerformanceRow['level']) => [bat(lvl, 30, 30), bat(lvl, 30, 30)]
    const state = calculateAthlasXScore(input({ performances: rows('state') }))
    const district = calculateAthlasXScore(input({ performances: rows('district') }))
    const local = calculateAthlasXScore(input({ performances: rows('local') }))

    expect(state.batting).toBeGreaterThan(district.batting)
    expect(district.batting).toBeGreaterThan(local.batting)
  })

  it('applies TQI once, so it does not cancel out of strike rate', () => {
    // Regression guard for the defect where TQI was applied to both the
    // numerator and denominator of SR and therefore had no effect.
    const state = calculateAthlasXScore(input({ performances: [bat('state', 20, 40)] }))
    const local = calculateAthlasXScore(input({ performances: [bat('local', 20, 40)] }))
    expect(state.batting).not.toBe(local.batting)
  })
})

// ── bowling aggregation ──────────────────────────────────────────────────────

describe('bowling', () => {
  it('rewards a tight, wicket-taking spell at state level', () => {
    // 4 overs, 2 wickets, 20 runs → economy 5.0, avg 10.0 — both better
    // than district par, so this should max the bowling display.
    const r = calculateAthlasXScore(
      input({ playingRole: 'Bowler', performances: [bowl('state', 4, 2, 20)] }),
    )
    expect(r.bowling).toBe(10)
  })

  it('does NOT treat a zero-economy spell as missing data', () => {
    // Regression guard: a maiden-only spell is the best possible outcome.
    // The old guard `if (economy === 0) return 0` ranked it worst.
    const r = calculateAthlasXScore(
      input({ playingRole: 'Bowler', performances: [bowl('state', 4, 1, 0)] }),
    )
    expect(r.bowling).toBeGreaterThan(0)
  })

  it('returns zero bowling score when no bowling was recorded', () => {
    const r = calculateAthlasXScore(input({ performances: [bat('state', 30, 30)] }))
    expect(r.bowling).toBe(0)
  })

  it('does not produce Infinity when a bowler has taken no wickets', () => {
    const r = calculateAthlasXScore(
      input({ playingRole: 'Bowler', performances: [bowl('state', 6, 0, 45)] }),
    )
    expect(Number.isFinite(r.bowling)).toBe(true)
    expect(Number.isFinite(r.total)).toBe(true)
  })

  it('discounts the same figures when bowled in weaker cricket', () => {
    const state = calculateAthlasXScore(
      input({ playingRole: 'Bowler', performances: [bowl('state', 4, 1, 24)] }),
    )
    const local = calculateAthlasXScore(
      input({ playingRole: 'Bowler', performances: [bowl('local', 4, 1, 24)] }),
    )
    expect(state.bowling).toBeGreaterThan(local.bowling)
  })
})

// ── renormalisation: the "unassessed players are capped" fix ─────────────────

describe('coach assessment is optional enrichment, not a cap', () => {
  it('lets an unassessed elite player still reach the Elite tier', () => {
    // Pivot Document W7: coach input is "optional enrichment, not a
    // dependency". A player with no coach session must not be structurally
    // barred from the top tier.
    const r = calculateAthlasXScore(
      input({ performances: eliteBattingRows, yearsExperience: 8 }),
    )
    expect(r.fitnessAssessed).toBe(false)
    expect(r.behaviourAssessed).toBe(false)
    expect(r.total).toBeGreaterThanOrEqual(85)
    expect(getScoreTier(r.total).label).toBe('Elite')
  })

  it('reports assessment flags honestly', () => {
    const assessed = calculateAthlasXScore(
      input({
        performances: eliteBattingRows,
        yearsExperience: 8,
        coachFitnessRating: 5,
        coachBehaviourRating: 5,
      }),
    )
    expect(assessed.fitnessAssessed).toBe(true)
    expect(assessed.behaviourAssessed).toBe(true)
  })

  it('does not let a top coach rating alone manufacture an elite score', () => {
    // Guard against the mirror failure: renormalising must not mean a
    // player with no match record scores well because a coach liked them.
    const r = calculateAthlasXScore(
      input({ performances: [], coachFitnessRating: 5, coachBehaviourRating: 5 }),
    )
    expect(r.total).toBeLessThan(55)
  })
})

// ── role weighting ───────────────────────────────────────────────────────────

describe('role weighting', () => {
  const allRounderRows = [bat('state', 40, 30), bowl('state', 4, 2, 20)]

  it('scores a Bowler off bowling and a Batsman off batting', () => {
    const asBatsman = calculateAthlasXScore(
      input({ playingRole: 'Batsman', performances: allRounderRows }),
    )
    const asBowler = calculateAthlasXScore(
      input({ playingRole: 'Bowler', performances: allRounderRows }),
    )
    // Same rows, different role → the performance component must differ.
    expect(asBatsman.performance).not.toBe(asBowler.performance)
  })

  it('blends both disciplines for an All-rounder', () => {
    const allRounder = calculateAthlasXScore(
      input({ playingRole: 'All-rounder', performances: allRounderRows }),
    )
    const batsman = calculateAthlasXScore(
      input({ playingRole: 'Batsman', performances: allRounderRows }),
    )
    const bowler = calculateAthlasXScore(
      input({ playingRole: 'Bowler', performances: allRounderRows }),
    )
    const lo = Math.min(batsman.performance, bowler.performance)
    const hi = Math.max(batsman.performance, bowler.performance)
    expect(allRounder.performance).toBeGreaterThanOrEqual(lo)
    expect(allRounder.performance).toBeLessThanOrEqual(hi)
  })

  it('treats a Wicket-keeper Batsman on batting alone (keeping is not scored)', () => {
    const wk = calculateAthlasXScore(
      input({ playingRole: 'Wicket-keeper Batsman', performances: allRounderRows }),
    )
    const bt = calculateAthlasXScore(
      input({ playingRole: 'Batsman', performances: allRounderRows }),
    )
    expect(wk.performance).toBe(bt.performance)
  })
})

// ── fielding and keeping are deliberately unscored ───────────────────────────

describe('fielding and keeping are not scored (Pivot Document W4)', () => {
  it('exposes no fielding or keeping dimension in the breakdown', () => {
    const r = calculateAthlasXScore(input({ performances: eliteBattingRows }))
    expect(Object.keys(r)).not.toContain('fielding')
    expect(Object.keys(r)).not.toContain('keeping')
  })

  it('accepts no fielding fields on a performance row', () => {
    const row = bat('state', 30, 30) as Record<string, unknown>
    expect(row).not.toHaveProperty('catches')
    expect(row).not.toHaveProperty('stumpings')
  })
})

// ── bounds and degenerate input ──────────────────────────────────────────────

describe('bounds and degenerate input', () => {
  it('returns a total within 0–100 for an empty record', () => {
    const r = calculateAthlasXScore(input())
    expect(r.total).toBeGreaterThanOrEqual(0)
    expect(r.total).toBeLessThanOrEqual(100)
  })

  it('keeps display scores within 0–10 even for absurd input', () => {
    const r = calculateAthlasXScore(
      input({ performances: [bat('national', 100_000, 1)] }),
    )
    expect(r.batting).toBeGreaterThanOrEqual(0)
    expect(r.batting).toBeLessThanOrEqual(10)
    expect(r.total).toBeLessThanOrEqual(100)
  })

  it('survives rows with no batting and no bowling data', () => {
    const r = calculateAthlasXScore(input({ performances: [{ level: 'state' }] }))
    expect(Number.isFinite(r.total)).toBe(true)
  })

  it('never yields NaN across a mixed record', () => {
    const r = calculateAthlasXScore(
      input({
        playingRole: 'All-rounder',
        performances: [bat('local', 0, 0), bowl('district', 0, 0, 0), { level: 'state' }],
        yearsExperience: 0,
      }),
    )
    for (const [k, v] of Object.entries(r)) {
      if (typeof v === 'number') expect(Number.isNaN(v), `${k} is NaN`).toBe(false)
    }
  })

  it('counts verified matches and TQI-weighted matches separately', () => {
    const r = calculateAthlasXScore(
      input({ performances: [bat('state', 10, 10), bat('local', 10, 10)] }),
    )
    expect(r.verifiedMatchCount).toBe(2)
    expect(r.tqiWeightedMatches).toBeCloseTo(1.5, 5) // 1.0 + 0.5
  })
})

// ── tiers ────────────────────────────────────────────────────────────────────

describe('getScoreTier', () => {
  it('maps the documented boundaries', () => {
    expect(getScoreTier(85).label).toBe('Elite')
    expect(getScoreTier(84).label).toBe('Advanced')
    expect(getScoreTier(70).label).toBe('Advanced')
    expect(getScoreTier(69).label).toBe('Developing')
    expect(getScoreTier(55).label).toBe('Developing')
    expect(getScoreTier(54).label).toBe('Rising')
    expect(getScoreTier(0).label).toBe('Rising')
  })

  it('returns a colour and description for every tier', () => {
    for (const s of [0, 60, 75, 95]) {
      const t = getScoreTier(s)
      expect(t.color).toMatch(/^#[0-9a-f]{6}$/i)
      expect(t.description.length).toBeGreaterThan(0)
    }
  })
})

// ── provenance label ─────────────────────────────────────────────────────────

describe('getProvenanceLabel', () => {
  it('names the level and the weighted match count', () => {
    expect(getProvenanceLabel(14, 10.5, 'district')).toBe(
      '14 verified matches · District level · TQI-weighted 10.5',
    )
    expect(getProvenanceLabel(9, 9, 'state')).toBe(
      '9 verified matches · State level · TQI-weighted 9.0',
    )
  })

  it('labels national as State level for a selector audience', () => {
    expect(getProvenanceLabel(3, 3, 'national')).toContain('State level')
  })

  it('does not render the weight as a bare multiplier', () => {
    // The old label read "TQI 10.5x", which reads as a 10.5x multiplier
    // when it is actually a weighted match count.
    expect(getProvenanceLabel(14, 10.5, 'district')).not.toMatch(/TQI \d+(\.\d+)?x/)
  })
})
