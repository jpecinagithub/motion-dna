/**
 * Playhead: single source of truth for the current playback time (ms).
 * When a <video> element is attached, the video drives time; otherwise a
 * virtual clock (for synthetic/library sessions without video) is advanced
 * by the playback driver each animation frame.
 */

let videoEl: HTMLVideoElement | null = null;
let virtualMs = 0;

export function setVideoElement(el: HTMLVideoElement | null): void {
  videoEl = el;
  if (el) virtualMs = 0;
}

export function getVideoElement(): HTMLVideoElement | null {
  return videoEl;
}

export function hasVideo(): boolean {
  return !!videoEl;
}

/** Current time in ms. */
export function getTimeMs(): number {
  if (videoEl && Number.isFinite(videoEl.duration) && videoEl.duration > 0) {
    return videoEl.currentTime * 1000;
  }
  return virtualMs;
}

/** Seek (clamped by caller). */
export function setTimeMs(ms: number): void {
  const clamped = Math.max(0, ms);
  if (videoEl && Number.isFinite(videoEl.duration) && videoEl.duration > 0) {
    videoEl.currentTime = Math.min(clamped, videoEl.duration * 1000) / 1000;
  } else {
    virtualMs = clamped;
  }
}

/** Advance the virtual clock (only used when no video element drives time). */
export function advanceVirtual(dtMs: number): void {
  if (!videoEl) virtualMs = Math.max(0, virtualMs + dtMs);
}

export function resetPlayhead(): void {
  virtualMs = 0;
  if (videoEl) {
    try {
      videoEl.currentTime = 0;
    } catch {
      /* ignore */
    }
  }
}
