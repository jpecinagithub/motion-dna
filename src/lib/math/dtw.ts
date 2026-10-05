/**
 * Classic dynamic time warping on sequences of feature vectors,
 * plus an integer frame-offset search for aligning one sequence onto another.
 */

export interface DtwResult {
  distance: number;
  path: Array<[number, number]>;
}

function frameDist(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
}

/** Classic DTW with euclidean frame distance. Empty input -> { distance: 0, path: [] }. */
export function dtw(a: number[][], b: number[][]): DtwResult {
  const n = a.length;
  const m = b.length;
  if (n === 0 || m === 0) return { distance: 0, path: [] };
  const D: number[][] = Array.from({ length: n + 1 }, () =>
    new Array<number>(m + 1).fill(Infinity),
  );
  D[0][0] = 0;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const cost = frameDist(a[i - 1], b[j - 1]);
      D[i][j] = cost + Math.min(D[i - 1][j], D[i][j - 1], D[i - 1][j - 1]);
    }
  }
  const path: Array<[number, number]> = [];
  let i = n;
  let j = m;
  while (i > 0 && j > 0) {
    path.push([i - 1, j - 1]);
    const diag = D[i - 1][j - 1];
    const up = D[i - 1][j];
    const left = D[i][j - 1];
    if (diag <= up && diag <= left) {
      i--;
      j--;
    } else if (up <= left) {
      i--;
    } else {
      j--;
    }
  }
  path.reverse();
  return { distance: D[n][m], path };
}

/**
 * Integer frame shift `s` aligning b onto a, trying s in [-n/2, n/2]
 * (n = a.length) and picking the shift with the smallest mean frame distance
 * over the overlapping region. Returns s such that b[i+s] best matches a[i].
 */
export function bestOffsetFrames(a: number[][], b: number[][]): number {
  const n = a.length;
  if (n === 0 || b.length === 0) return 0;
  const half = Math.floor(n / 2);
  let best = 0;
  let bestDist = Infinity;
  for (let s = -half; s <= half; s++) {
    let sum = 0;
    let cnt = 0;
    for (let i = 0; i < n; i++) {
      const j = i + s;
      if (j < 0 || j >= b.length) continue;
      sum += frameDist(a[i], b[j]);
      cnt++;
    }
    if (cnt === 0) continue;
    const mean = sum / cnt;
    if (mean < bestDist - 1e-12) {
      bestDist = mean;
      best = s;
    }
  }
  return best;
}
