/**
 * Computes the Levenshtein (edit) distance between two strings.
 * The edit distance is the minimum number of single-character insertions,
 * deletions, or substitutions required to transform one string into the other.
 */
export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0) as number[]);
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

/**
 * Returns up to {@link maxResults} candidate strings whose Levenshtein distance
 * to {@link target} is at most {@link maxDistance}. Comparison is case-insensitive.
 * Results are sorted by ascending distance.
 */
export function findSimilar(
  target: string,
  candidates: string[],
  maxDistance = 3,
  maxResults = 5,
): string[] {
  const lower = target.toLowerCase();
  return candidates
    .map((c) => ({ name: c, dist: levenshtein(lower, c.toLowerCase()) }))
    .filter((s) => s.dist <= maxDistance)
    .sort((a, b) => a.dist - b.dist)
    .slice(0, maxResults)
    .map((s) => s.name);
}
