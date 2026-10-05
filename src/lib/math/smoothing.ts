/**
 * 1D series smoothing helpers.
 */

/** Centered moving average; edges are clamped (replicated). window >= 1. */
export function movingAverage(series: number[], window: number): number[] {
  const n = series.length;
  if (n === 0) return [];
  const w = Math.max(1, Math.floor(window));
  const half = Math.floor(w / 2);
  const out = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    let sum = 0;
    for (let k = -half; k <= w - half - 1; k++) {
      const idx = Math.min(n - 1, Math.max(0, i + k));
      sum += series[idx];
    }
    out[i] = sum / w;
  }
  return out;
}

/** Exponential smoothing. out[0] = series[0]; alpha clamped to [0,1]. */
export function exponentialSmooth(series: number[], alpha: number): number[] {
  const n = series.length;
  if (n === 0) return [];
  const a = Math.min(1, Math.max(0, alpha));
  const out = new Array<number>(n);
  out[0] = series[0];
  for (let i = 1; i < n; i++) {
    out[i] = a * series[i] + (1 - a) * out[i - 1];
  }
  return out;
}

/**
 * Linearly interpolates interior NaN runs; leading/trailing NaN runs are
 * filled with the nearest valid value. All-NaN input is returned as-is.
 */
export function interpolateNaN(series: number[]): number[] {
  const n = series.length;
  const out = series.slice();
  const valid: number[] = [];
  for (let i = 0; i < n; i++) {
    if (Number.isFinite(out[i])) valid.push(i);
  }
  if (valid.length === 0) return out;
  const first = valid[0];
  const last = valid[valid.length - 1];
  for (let i = 0; i < first; i++) out[i] = out[first];
  for (let k = 0; k < valid.length - 1; k++) {
    const i0 = valid[k];
    const i1 = valid[k + 1];
    const v0 = out[i0];
    const v1 = out[i1];
    for (let i = i0 + 1; i < i1; i++) {
      const t = (i - i0) / (i1 - i0);
      out[i] = v0 + (v1 - v0) * t;
    }
  }
  for (let i = last + 1; i < n; i++) out[i] = out[last];
  return out;
}
