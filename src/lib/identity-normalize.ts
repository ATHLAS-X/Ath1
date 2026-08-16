/**
 * Ported from feat/w1-w8-and-association-auth's lib/identity-normalize.ts
 * — pure functions, no schema dependency, so this ports near-verbatim onto
 * Prisma/src rather than needing a redesign.
 */

const HONORIFICS = new Set([
  "mr", "mrs", "ms", "miss", "shri", "smt", "dr", "capt", "master", "kumari",
]);

export function normalizeName(raw: string): string {
  const nfkd = raw.normalize("NFKD").replace(/[̀-ͯ]/g, ""); // strip diacritics
  const stripped = nfkd
    .toLowerCase()
    .replace(/[^\w\s]/g, " ") // strip punctuation
    .split(/\s+/)
    .filter((tok) => tok.length > 0 && !HONORIFICS.has(tok));
  return stripped.sort().join(" "); // token-sort neutralizes name-order variance
}

export function normalizeDistrict(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\bdist(rict)?\.?\b/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

/** Normalized-Levenshtein ratio in [0, 1]. Same shape as src/lib/string-similarity.ts's
 *  `similarity()` — deliberately NOT reused here, because that function is what has the
 *  already-documented disambiguation collision (can't rank a true variant above a rival).
 *  This function is never used to auto-rank candidates directly; resolveIdentity() only
 *  ever uses it as a binary >=0.85 threshold gate plus independent DOB/district
 *  corroboration, which is what avoids that collision class of bug. */
export function nameSimilarity(a: string, b: string): number {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (na.length === 0 && nb.length === 0) return 1;
  const dist = levenshtein(na, nb);
  return 1 - dist / Math.max(na.length, nb.length, 1);
}

export const NAME_SIMILARITY_HIGH_CONFIDENCE = 0.85;
