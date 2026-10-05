/**
 * App-wide configuration.
 */
export const AUTHOR_NAME = 'Jon Peciña';

export const APP_NAME = 'MOTION//DNA';
export const APP_TAGLINE = 'Upload a video. See the movement hidden inside it.';

export const PROCESSING = {
  /** analysis frame rate (fps) — higher costs more time, rarely more insight */
  targetFps: 20,
  /** refuse videos longer than this (seconds) to protect the main thread */
  maxDurationSec: 90,
  /** minimum pose visibility to accept a detection */
  minVisibility: 0.3,
} as const;

export const LIBRARY_MAX_SESSIONS = 10;

export const COLORS = {
  bg: '#05070d',
  bgPanel: '#0a0f1c',
  ink: '#e8eefc',
  inkDim: '#8b98b8',
  electric: '#3b82f6',
  violet: '#8b5cf6',
  coral: '#fb7185',
  mint: '#34d399',
  amber: '#fbbf24',
} as const;

/** per-joint accent colors for trails / arcs */
export const JOINT_COLORS: Record<string, string> = {
  elbowL: '#3b82f6',
  elbowR: '#60a5fa',
  kneeL: '#8b5cf6',
  kneeR: '#a78bfa',
  shoulderL: '#34d399',
  shoulderR: '#6ee7b7',
  hipL: '#fb7185',
  hipR: '#fda4af',
};

export const MEDIAPIPE_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';
