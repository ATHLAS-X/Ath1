/**
 * KNOWN DEFECTS — these tests are EXPECTED TO FAIL.
 *
 * They are an executable specification of open findings from the
 * implementation audit. Each asserts the behaviour the Pivot Document or
 * the project's own documentation promises; each fails against the code as
 * committed. When a defect is fixed, its test turns green — that is the
 * signal the finding is closed.
 *
 * Run in isolation:  npx vitest run tests/known-defects
 *
 * Do not "fix" these by weakening the assertion.
 */
import { describe, it, expect } from 'vitest'
import { similarity } from '@/lib/string-similarity'
import { calculateAthlasXScore, type AthlasXScoreInput } from '@/lib/athlasx-score'

// ─────────────────────────────────────────────────────────────────────────────
// DEFECT 1 — Pivot_Changes_ATHLASX.docx claims the score engine rejects
// self-reported coach ratings:
//
//   "coachFitnessRating and coachBehaviourRating accepted only when
//    source = 'coach' or 'supervisor'. Self-reported values are rejected at
//    the engine level."
//
// No `source` field exists on AthlasXScoreInput and no validation is
// performed. This matters because verified-data-only is the trust guarantee
// sold to associations (Pivot Document §4.1).
// ─────────────────────────────────────────────────────────────────────────────
describe('DEFECT: coach ratings carry no provenance and are never rejected', () => {
  it('should expose a source field so self-reported ratings can be distinguished', () => {
    const input = {
      playingRole: 'Batsman',
      performances: [],
      yearsExperience: 0,
      coachFitnessRating: 5,
      coachBehaviourRating: 5,
    } as AthlasXScoreInput & Record<string, unknown>

    // The documented contract requires provenance on the rating.
    expect(
      Object.prototype.hasOwnProperty.call(input, 'coachRatingSource'),
      'AthlasXScoreInput has no coachRatingSource — any caller can supply a ' +
        'self-reported rating and the engine will score it as supervised',
    ).toBe(true)
  })

  it('should not award fitness/behaviour points for an unattributed rating', () => {
    const unattributed = calculateAthlasXScore({
      playingRole: 'Batsman',
      performances: [],
      yearsExperience: 0,
      coachFitnessRating: 5,
      coachBehaviourRating: 5,
    })
    // With no way to prove a coach supplied these, they should not count.
    expect(
      unattributed.fitness + unattributed.behaviour,
      'unattributed ratings still contribute points to the score',
    ).toBe(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// DEFECT 2 — src/lib/athlasx-score.ts documents its own bowling benchmark as
// "6.5 eco → 10, 10.5 eco → 0" but implements ((10 - economy) / 4) * 10,
// which yields 8.75 at an economy of 6.5. The completion document states a
// third, different formula again. One of the three must be authoritative.
// ─────────────────────────────────────────────────────────────────────────────
describe('DEFECT: bowling economy benchmark disagrees with its own comment', () => {
  const bowlerAt = (economy: number) =>
    calculateAthlasXScore({
      playingRole: 'Bowler',
      performances: [
        {
          level: 'state',
          bowling_overs: 10,
          bowling_wickets: 5,
          bowling_runs_conceded: economy * 10,
        },
      ],
      yearsExperience: 0,
    })

  it('should score a 6.5 economy as 10/10, as the code comment claims', () => {
    expect(
      bowlerAt(6.5).bowling,
      'code comment says "6.5 eco → 10" but the formula gives 8.75',
    ).toBe(10)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// DEFECT 3 — W8 academy reconciliation cannot separate a genuine
// abbreviation from a different academy. Normalised Levenshtein has no
// notion of which token carries identity ("Sharma") versus which is
// boilerplate ("Cricket Academy"), so both land on the same score.
//
// Mitigated today because prisma/seed.ts only *suggests* (>= 0.55) and a
// human confirms. It becomes a live data-integrity bug the moment an
// auto-confirm threshold is introduced — which the Pivot Document's W8
// notes explicitly contemplate.
// ─────────────────────────────────────────────────────────────────────────────
describe('DEFECT: academy matcher cannot distinguish a variant from a rival', () => {
  it('should rank a true abbreviation above a different academy', () => {
    const trueVariant = similarity('Sharma Cricket Academy', 'Sharma Cricket Acad.')
    const differentAcademy = similarity('Sharma Cricket Academy', 'Verma Cricket Academy')

    expect(
      trueVariant,
      `true variant scored ${trueVariant.toFixed(4)}, a DIFFERENT academy scored ` +
        `${differentAcademy.toFixed(4)} — the reconciliation queue cannot rank them`,
    ).toBeGreaterThan(differentAcademy)
  })

  it('should keep two different family names below a plausible auto-merge line', () => {
    expect(
      similarity('Sharma Cricket Academy', 'Verma Cricket Academy'),
      'two unrelated academies score high enough to auto-merge at 0.85',
    ).toBeLessThan(0.85)
  })
})
