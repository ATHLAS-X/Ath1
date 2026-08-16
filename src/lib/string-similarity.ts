// Academy-name reconciliation similarity.
//
// A plain whole-string normalised Levenshtein ratio (the original
// implementation) cannot distinguish a genuine abbreviation from a
// different academy that happens to share the same boilerplate suffix —
// "Sharma Cricket Academy" vs "Sharma Cricket Acad." and "Sharma Cricket
// Academy" vs "Verma Cricket Academy" scored IDENTICALLY (0.8636) under the
// old formula, because "Cricket Academy"/"Cricket Acad."/"Cricket Academy"
// all dominate the edit distance regardless of whether the identity-bearing
// word ("Sharma" vs "Verma") matches at all. This was tracked as
// tests/known-defects DEFECT 3.
//
// Fix: split each name into an "identity" token (the word(s) that actually
// distinguish one academy from another — a founder/family/place name) and
// "boilerplate" tokens (generic institutional words every academy's name
// contains some combination of). The identity-token match dominates the
// score; the old whole-string score is kept as a smaller secondary term so
// names with no extractable identity token still degrade gracefully instead
// of collapsing to 0.

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)])
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
    }
  }
  return dp[m][n]
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[.,]/g, '').replace(/\s+/g, ' ').trim()
}

// Character-level similarity of two already-normalised strings/tokens.
function charSim(a: string, b: string): number {
  if (!a.length && !b.length) return 1
  const dist = levenshtein(a, b)
  return 1 - dist / Math.max(a.length, b.length)
}

// Generic institutional words that carry no identifying information on
// their own — present in most academy names, so weighted down rather than
// treated as part of the "who is this" signal. Includes common
// abbreviations of the same words (acad, ca, cc, sc) since ingest sources
// abbreviate inconsistently.
const BOILERPLATE = new Set([
  'cricket', 'academy', 'acad', 'club', 'ca', 'cc', 'sc',
  'sports', 'sport', 'association', 'assn', 'institute',
  'school', 'trust', 'society', 'foundation',
])

function identityTokens(normalized: string): string[] {
  return normalized.split(' ').filter(t => t.length > 1 && !BOILERPLATE.has(t))
}

// Best pairwise match between two names' identity tokens. Symmetric by
// construction (order of the two token lists doesn't affect the max).
// Returns null when either side has no identity tokens at all (e.g. both
// names are pure boilerplate, or the string is too short to tokenise) —
// the caller falls back to whole-string similarity in that case, since
// there's no identity signal to weight against.
function bestIdentityMatch(tokensA: string[], tokensB: string[]): number | null {
  if (tokensA.length === 0 || tokensB.length === 0) return null
  let best = 0
  for (const a of tokensA) {
    for (const b of tokensB) best = Math.max(best, charSim(a, b))
  }
  return best
}

export function similarity(a: string, b: string): number {
  const na = normalize(a), nb = normalize(b)
  if (na === nb) return 1 // exact match after normalisation — bypass weighting entirely

  const wholeSim = charSim(na, nb)
  const idMatch = bestIdentityMatch(identityTokens(na), identityTokens(nb))
  if (idMatch === null) return wholeSim

  // Identity-token agreement dominates; whole-string similarity is kept as
  // a smaller term so near-identical boilerplate still nudges the score up
  // for genuine variants without letting shared boilerplate alone produce
  // a high score for two different academies.
  return 0.7 * idMatch + 0.3 * wholeSim
}

// Best match among an academy's canonical name + all known variants.
export function bestSimilarity(raw: string, academyName: string, variants: string[]): number {
  return Math.max(similarity(raw, academyName), ...variants.map(v => similarity(raw, v)))
}
