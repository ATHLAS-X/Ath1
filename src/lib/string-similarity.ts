// Normalised Levenshtein similarity, 0 (no match) – 1 (identical).
// Good enough for academy-name reconciliation: "Tara Cricket Academy" vs
// "Tara Cricket Acad." vs "tara cricket academy, kanpur" should all score high.
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

export function similarity(a: string, b: string): number {
  const na = normalize(a), nb = normalize(b)
  if (!na.length && !nb.length) return 1
  const dist = levenshtein(na, nb)
  return 1 - dist / Math.max(na.length, nb.length)
}

// Best match among an academy's canonical name + all known variants.
export function bestSimilarity(raw: string, academyName: string, variants: string[]): number {
  return Math.max(similarity(raw, academyName), ...variants.map(v => similarity(raw, v)))
}
