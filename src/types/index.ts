/**
 * Core domain types for MOTION//DNA.
 * Everything spatial that lacks real-world calibration is "relative / estimated".
 */

export interface Landmark {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

export interface PoseFrame {
  /** milliseconds since start of the source */
  timestampMs: number;
  /** 33 MediaPipe pose landmarks in image space (x,y in 0..1, z relative). Empty when no pose detected. */
  landmarks: Landmark[];
  worldLandmarks?: Landmark[];
  hasPose: boolean;
}

export type SessionSource = 'video' | 'camera' | 'synthetic';

export type JointId =
  | 'elbowL'
  | 'elbowR'
  | 'kneeL'
  | 'kneeR'
  | 'shoulderL'
  | 'shoulderR'
  | 'hipL'
  | 'hipR';

export interface JointDef {
  id: JointId;
  /** landmark indices: a -> b -> c, angle measured at b */
  a: number;
  b: number;
  c: number;
  /** which landmark index drives the trail for this joint (usually the distal one) */
  trailIndex: number;
}

export interface JointMetrics {
  jointId: JointId;
  angleMeanDeg: number;
  angleMinDeg: number;
  angleMaxDeg: number;
  /** max - min, degrees */
  angleRangeDeg: number;
  /** peak angular velocity, deg/s (estimated) */
  peakAngularVelocityDegS: number;
}

export interface SymmetryInfo {
  /** 0..1, 1 = perfectly symmetric. Orientative only. */
  score: number;
  /** per joint-pair difference in degrees, mean over time */
  pairDiffDeg: Record<string, number>;
}

export interface RhythmInfo {
  /** estimated beats per minute from periodic motion, 0 when not periodic */
  bpm: number;
  /** 0..1 regularity of detected periods */
  regularity: number;
}

export interface MotionMetrics {
  durationMs: number;
  frameCount: number;
  /** frames actually analysed per second */
  fpsProcessed: number;
  joints: JointMetrics[];
  symmetry: SymmetryInfo;
  rhythm: RhythmInfo;
  /** per-frame mean joint speed, relative units (estimated, uncalibrated) */
  speedProfile: number[];
  /** per-frame mean joint acceleration, relative units (estimated) */
  accelProfile: number[];
  /** always true: spatial metrics are relative without calibration */
  estimated: true;
  /** per-frame angles in degrees, keyed by joint id */
  angleSeries: Record<JointId, number[]>;
}

export interface MotionSession {
  id: string;
  name: string;
  source: SessionSource;
  durationMs: number;
  fpsProcessed: number;
  frames: PoseFrame[];
  metrics: MotionMetrics;
  createdAt: string;
  /** dataURL thumbnail (small) */
  thumbnail?: string;
}

/** Normalized 0..1 feature vector describing a movement (for the Motion Signature). */
export interface SignatureVector {
  values: number[];
  labels: string[];
}

export type Phase = 'start' | 'processing' | 'explore';

export type ViewMode =
  | 'video'
  | 'overlay'
  | 'skeleton'
  | 'trails'
  | 'heat'
  | 'explode'
  | 'ghost'
  | 'difference'
  | 'signature';

export interface VideoMeta {
  url: string;
  name: string;
  durationMs: number;
  width: number;
  height: number;
}

export type Lang = 'es' | 'en';
