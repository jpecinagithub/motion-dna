/**
 * Small helpers: frame lookup, time formatting, downloads, ids.
 */
import type { PoseFrame } from '../types';

/** Binary search: index of the last frame with timestampMs <= timeMs. */
export function frameIndexAtTime(frames: PoseFrame[], timeMs: number): number {
  if (frames.length === 0) return -1;
  let lo = 0;
  let hi = frames.length - 1;
  if (timeMs <= frames[0].timestampMs) return 0;
  if (timeMs >= frames[hi].timestampMs) return hi;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (frames[mid].timestampMs <= timeMs) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

export function frameAtTime(frames: PoseFrame[], timeMs: number): PoseFrame | null {
  const i = frameIndexAtTime(frames, timeMs);
  return i >= 0 ? frames[i] : null;
}

/** ms -> "m:ss.mmm" */
export function formatTime(ms: number): string {
  const total = Math.max(0, ms);
  const m = Math.floor(total / 60000);
  const s = Math.floor((total % 60000) / 1000);
  const r = Math.floor(total % 1000);
  return `${m}:${s.toString().padStart(2, '0')}.${r.toString().padStart(3, '0')}`;
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function uid(prefix = 'id'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Clamp a value into [min, max]. */
export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}
