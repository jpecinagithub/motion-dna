/**
 * video-processor.ts — load a user video file and run pose detection on it,
 * frame by frame, at a target fps by sequentially seeking the video element.
 */
import type { PoseFrame } from '../../types';
import type { PoseEngine } from './pose-engine';
import { PROCESSING } from '../../config';

export interface VideoFile {
  video: HTMLVideoElement;
  url: string;
  name: string;
  durationMs: number;
  width: number;
  height: number;
}

export interface ProcessCallbacks {
  onProgress: (done: number, total: number, preview: PoseFrame | null) => void;
  signal?: AbortSignal;
}

const METADATA_TIMEOUT_MS = 15000;
const SEEK_TIMEOUT_MS = 5000;

/**
 * Validates the file, creates an object URL + muted video element and waits
 * for metadata. Never autoplays. Throws Error('incompatible') for non-video
 * files or load failures, Error('tooLong') when the duration exceeds the cap.
 */
export function loadVideoFile(file: File): Promise<VideoFile> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('video/')) {
      reject(new Error('incompatible'));
      return;
    }
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.muted = true;
    video.setAttribute('playsinline', 'true');
    video.preload = 'auto';

    const timer = window.setTimeout(() => {
      cleanup();
      URL.revokeObjectURL(url);
      reject(new Error('incompatible'));
    }, METADATA_TIMEOUT_MS);

    const cleanup = () => {
      window.clearTimeout(timer);
      video.removeEventListener('loadedmetadata', onMetadata);
      video.removeEventListener('error', onError);
    };

    const onMetadata = () => {
      cleanup();
      const durationMs = video.duration * 1000;
      if (!Number.isFinite(durationMs) || durationMs <= 0) {
        URL.revokeObjectURL(url);
        reject(new Error('incompatible'));
        return;
      }
      if (durationMs > PROCESSING.maxDurationSec * 1000) {
        URL.revokeObjectURL(url);
        reject(new Error('tooLong'));
        return;
      }
      resolve({
        video,
        url,
        name: file.name,
        durationMs,
        width: video.videoWidth,
        height: video.videoHeight,
      });
    };

    const onError = () => {
      cleanup();
      URL.revokeObjectURL(url);
      reject(new Error('incompatible'));
    };

    video.addEventListener('loadedmetadata', onMetadata);
    video.addEventListener('error', onError);
    video.src = url;
  });
}

/** Seek and wait for 'seeked'; resolves false on timeout/error (skip the frame). */
function seekTo(video: HTMLVideoElement, timeSec: number): Promise<boolean> {
  return new Promise((resolve) => {
    if (Math.abs(video.currentTime - timeSec) < 0.05) {
      resolve(true);
      return;
    }
    const timer = window.setTimeout(() => {
      cleanup();
      resolve(false);
    }, SEEK_TIMEOUT_MS);
    const cleanup = () => {
      window.clearTimeout(timer);
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('error', onError);
    };
    const onSeeked = () => {
      cleanup();
      resolve(true);
    };
    const onError = () => {
      cleanup();
      resolve(false);
    };
    video.addEventListener('seeked', onSeeked);
    video.addEventListener('error', onError);
    try {
      video.currentTime = timeSec;
    } catch {
      cleanup();
      resolve(false);
    }
  });
}

function abortError(): DOMException {
  return new DOMException('The operation was aborted.', 'AbortError');
}

/**
 * Sequentially seeks the (muted, preloaded) video through time at targetFps
 * steps, runs engine.detectVideoFrame per step and yields to the UI between
 * frames. Never rejects on a single bad frame: stores
 * {hasPose:false, landmarks:[]} instead. Throws DOMException AbortError when
 * the abort signal fires.
 */
export async function processVideoFrames(
  video: HTMLVideoElement,
  engine: PoseEngine,
  targetFps: number,
  cb: ProcessCallbacks,
): Promise<PoseFrame[]> {
  const { onProgress, signal } = cb;
  if (!video.paused) video.pause();

  const durationSec = Number.isFinite(video.duration) ? video.duration : 0;
  const total = Math.max(1, Math.floor(durationSec * targetFps));

  const frames: PoseFrame[] = [];
  let preview: PoseFrame | null = null;

  for (let i = 0; i < total; i++) {
    if (signal?.aborted) throw abortError();
    const t = i / targetFps;
    const timestampMs = t * 1000;
    try {
      const seeked = await seekTo(video, t);
      let frame: PoseFrame | null = null;
      if (seeked) {
        try {
          frame = await engine.detectVideoFrame(video, timestampMs);
        } catch {
          frame = null;
        }
      }
      const stored: PoseFrame = frame ?? { timestampMs, landmarks: [], hasPose: false, visibleJoints: [] };
      if (stored.hasPose) preview = stored;
      frames.push(stored);
    } catch {
      // One bad frame must never reject the whole run.
      if (signal?.aborted) throw abortError();
      frames.push({ timestampMs, landmarks: [], hasPose: false, visibleJoints: [] });
    }
    onProgress(i + 1, total, preview);
    // Yield to the UI between frames.
    await new Promise<void>((r) => window.setTimeout(r, 0));
  }
  return frames;
}
