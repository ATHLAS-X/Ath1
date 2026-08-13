/**
 * Unit tests — academy name matching (src/lib/string-similarity.ts)
 *
 * Pivot Document W8: academy names arrive as free text and must be
 * reconciled into a registry. The doc's stated bias is to prefer false
 * negatives (an unmatched stub) over false positives (two different
 * academies merged), because a bad merge is harder to unwind.
 */
import { describe, it, expect } from 'vitest'
import { similarity, bestSimilarity } from '@/lib/string-similarity'

describe('similarity', () => {
  it('scores identical strings as 1', () => {
    expect(similarity('Tara Cricket Academy', 'Tara Cricket Academy')).toBe(1)
  })

  it('is case-insensitive', () => {
    expect(similarity('Tara Cricket Academy', 'tara cricket academy')).toBe(1)
  })

  it('ignores punctuation and collapses whitespace', () => {
    expect(similarity('Tara Cricket Academy', 'Tara  Cricket, Academy')).toBe(1)
  })

  it('is symmetric', () => {
    const a = similarity('Sharma Cricket Academy', 'Sharma CA Lucknow')
    const b = similarity('Sharma CA Lucknow', 'Sharma Cricket Academy')
    expect(a).toBeCloseTo(b, 10)
  })

  it('returns a value in [0, 1] for arbitrary input', () => {
    const pairs: [string, string][] = [
      ['', 'x'],
      ['abc', ''],
      ['a', 'b'],
      ['long academy name here', 'x'],
    ]
    for (const [a, b] of pairs) {
      const s = similarity(a, b)
      expect(s).toBeGreaterThanOrEqual(0)
      expect(s).toBeLessThanOrEqual(1)
    }
  })

  it('treats two empty strings as identical', () => {
    expect(similarity('', '')).toBe(1)
  })

  it('scores an abbreviation higher than an unrelated name', () => {
    const abbrev = similarity('Tara Cricket Academy', 'Tara Cricket Acad.')
    const other = similarity('Tara Cricket Academy', 'Gupta Sports Club')
    expect(abbrev).toBeGreaterThan(other)
  })

  it('scores a branch-suffixed variant above an unrelated name', () => {
    const branch = similarity('Sharma Cricket Academy', 'Sharma Cricket Academy Lucknow')
    const other = similarity('Sharma Cricket Academy', 'Kanpur Youth Club')
    expect(branch).toBeGreaterThan(other)
  })

  it('scores clearly unrelated names below the 0.55 suggestion threshold', () => {
    // prisma/seed.ts queues a suggestion at >= 0.55. Names with nothing in
    // common must fall below it and stay unmatched.
    expect(similarity('Tara Cricket Academy', 'Prime Sports Academy')).toBeLessThan(0.55)
  })
})

describe('bestSimilarity', () => {
  it('matches against the canonical name when no variant is closer', () => {
    expect(bestSimilarity('Tara Cricket Academy', 'Tara Cricket Academy', [])).toBe(1)
  })

  it('picks the best-scoring known variant', () => {
    const score = bestSimilarity('SCA Lucknow', 'Sharma Cricket Academy', [
      'Sharma CA',
      'SCA Lucknow',
    ])
    expect(score).toBe(1)
  })

  it('never scores below the canonical-name match', () => {
    const canonical = similarity('Tara Cricket Acad.', 'Tara Cricket Academy')
    const best = bestSimilarity('Tara Cricket Acad.', 'Tara Cricket Academy', ['zzz'])
    expect(best).toBeGreaterThanOrEqual(canonical)
  })

  it('handles an empty variant list without throwing', () => {
    expect(() => bestSimilarity('x', 'y', [])).not.toThrow()
  })
})
