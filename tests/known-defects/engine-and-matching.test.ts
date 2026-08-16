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
// FIXED — confirmed remediation: rather than adding a coachRatingSource
// provenance field and keeping the scoring weight, coach ratings were
// structurally isolated out of the score entirely (src/lib/athlasx-score.ts
// v1.2). AthlasXScoreInput.coachFitnessRating/coachBehaviourRating are now
// deprecated no-ops — calculateAthlasXScore never reads them, so there is no
// "self-reported vs. supervised" distinction left to make: NO rating, of any
// provenance, affects the score. The real advisory-only signal now lives in
// CoachAdvisoryNote (prisma/schema.prisma), which has zero relationship to
// scoring.
//
// The original assertion here checked a hardcoded object literal's own keys
// (`hasOwnProperty(input, 'coachRatingSource')`) — that could only ever pass
// by editing the literal itself, and its premise (add a provenance field)
// doesn't match the remediation actually chosen (remove the inputs
// entirely). Replaced with a direct proof of the real invariant: supplying
// the ratings changes nothing about the output, at all.
// ─────────────────────────────────────────────────────────────────────────────
describe('DEFECT: coach ratings carry no provenance and are never rejected', () => {
  it('produces an identical score whether or not coach ratings are supplied', () => {
    const performances: AthlasXScoreInput['performances'] = [
      { level: 'state', batting_runs: 45, batting_balls: 32, batting_dismissed: true },
      { level: 'state', batting_runs: 60, batting_balls: 40, batting_dismissed: false },
      { level: 'district', batting_runs: 20, batting_balls: 25, batting_dismissed: true },
    ]

    const withoutRating = calculateAthlasXScore({
      playingRole: 'Batsman',
      performances,
      yearsExperience: 4,
    })
    const withRating = calculateAthlasXScore({
      playingRole: 'Batsman',
      performances,
      yearsExperience: 4,
      coachFitnessRating: 5,
      coachBehaviourRating: 5,
    })

    // Not just the total — the whole breakdown, so a rating sneaking points
    // into any individual component (not just the final rollup) would still
    // be caught.
    expect(
      withRating,
      'supplying coachFitnessRating/coachBehaviourRating changed the score — ' +
        'they must be provably inert, not just absent from a hardcoded input literal',
    ).toEqual(withoutRating)
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
