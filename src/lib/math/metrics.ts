/**
 * Motion metrics: per-joint angle statistics, speed/acceleration profiles,
 * symmetry score, rhythm estimate, and the 10-feature motion signature.
 *
 * All spatial metrics are relative/uncalibrated — `estimated` is always true.
 * These functions never throw on empty or short input; they return
 * zeroed/empty metrics instead.
 */
import type {
  JointId,
  MotionMetrics,
  MotionSession,
  PoseFrame,
  RhythmInfo,
  SignatureVector,
  SymmetryInfo,
} from '../../types';
import { JOINT_IDS, JOINT_PAIRS, LM } from '../joints';
import { clamp } from '../utils';
import { jointAngleSeries } from './angles';
import { interpolateNaN, movingAverage } from './smoothing';

const SIGNATURE_LABELS = [
  'duration',
  'amplitude',
  'speed',
  'symmetry',
  'rhythm',
  'verticality',
  'legs',
  'arms',
  'smoothness',
  'energy',
] as const;

function zeroAngleSeries(): Record<JointId, number[]> {
  const out = {} as Record<JointId, number[]>;
  for (const id of JOINT_IDS) out[id] = [];
  return out;
}

function finiteMean(values: number[]): number {
  let sum = 0;
  let cnt = 0;
  for (const v of values) {
    if (Number.isFinite(v)) {
      sum += v;
      cnt++;
    }
  }
  return cnt > 0 ? sum / cnt : 0;
}

/** Smooth saturating normalization to [0,1): 0 -> 0, scale -> 0.5, inf -> 1. */
function norm01(x: number, scale: number): number {
  if (!Number.isFinite(x) || x <= 0 || scale <= 0) return 0;
  return clamp(x / (x + scale), 0, 1);
}

function frameDtSeconds(frames: PoseFrame[], i: number, fallback: number): number {
  if (i <= 0 || i >= frames.length) return fallback;
  const d = (frames[i].timestampMs - frames[i - 1].timestampMs) / 1000;
  return d > 0 ? d : fallback;
}

function computeRhythm(speedProfile: number[], fps: number): RhythmInfo {
  const n = speedProfile.length;
  if (n < 8 || fps <= 0) return { bpm: 0, regularity: 0 };
  const s = movingAverage(speedProfile, 3);
  const mean = s.reduce((a, b) => a + b, 0) / n;
  let denom = 0;
  for (const v of s) denom += (v - mean) * (v - mean);
  if (denom <= 0) return { bpm: 0, regularity: 0 };
  const maxLag = n - 1;
  const corr = new Array<number>(maxLag + 1);
  for (let lag = 0; lag <= maxLag; lag++) {
    let num = 0;
    for (let i = 0; i + lag < n; i++) num += (s[i] - mean) * (s[i + lag] - mean);
    corr[lag] = num / denom;
  }
  // First autocorrelation peak with a period longer than 0.25s.
  const minLag = Math.max(1, Math.ceil(0.25 * fps));
  for (let lag = minLag; lag < maxLag; lag++) {
    if (corr[lag] > 0.15 && corr[lag] >= corr[lag - 1] && corr[lag] >= corr[lag + 1]) {
      return { bpm: 60 / (lag / fps), regularity: clamp(corr[lag], 0, 1) };
    }
  }
  return { bpm: 0, regularity: 0 };
}

export function computeMetrics(frames: PoseFrame[], fpsProcessed: number): MotionMetrics {
  const n = frames.length;
  const fps = fpsProcessed > 0 ? fpsProcessed : 30;
  const dt = 1 / fps;

  const durationMs = n > 1 ? frames[n - 1].timestampMs - frames[0].timestampMs : 0;

  if (n === 0) {
    return {
      durationMs: 0,
      frameCount: 0,
      fpsProcessed: fps,
      joints: JOINT_IDS.map((jointId) => ({
        jointId,
        angleMeanDeg: 0,
        angleMinDeg: 0,
        angleMaxDeg: 0,
        angleRangeDeg: 0,
        peakAngularVelocityDegS: 0,
      })),
      symmetry: { score: 0, pairDiffDeg: {} },
      rhythm: { bpm: 0, regularity: 0 },
      speedProfile: [],
      accelProfile: [],
      estimated: true,
      angleSeries: zeroAngleSeries(),
    };
  }

  // Per-joint raw angle series (NaN where no pose) -> interpolate -> light smooth.
  const series = JOINT_IDS.map((id) => {
    const raw = jointAngleSeries(frames, id);
    const smooth = movingAverage(interpolateNaN(raw), 3);
    return { id, raw, smooth };
  });
  const byId = new Map(series.map((s) => [s.id, s] as const));

  const joints = series.map(({ id, raw, smooth }) => {
    const vals = smooth.filter((_, i) => Number.isFinite(raw[i]));
    if (vals.length === 0) {
      return {
        jointId: id,
        angleMeanDeg: 0,
        angleMinDeg: 0,
        angleMaxDeg: 0,
        angleRangeDeg: 0,
        peakAngularVelocityDegS: 0,
      };
    }
    const angleMeanDeg = vals.reduce((a, b) => a + b, 0) / vals.length;
    const angleMinDeg = Math.min(...vals);
    const angleMaxDeg = Math.max(...vals);
    let peakAngularVelocityDegS = 0;
    for (let i = 1; i < n; i++) {
      const a = smooth[i - 1];
      const b = smooth[i];
      if (Number.isFinite(a) && Number.isFinite(b)) {
        const v = Math.abs(b - a) / dt;
        if (v > peakAngularVelocityDegS) peakAngularVelocityDegS = v;
      }
    }
    return {
      jointId: id,
      angleMeanDeg,
      angleMinDeg,
      angleMaxDeg,
      angleRangeDeg: angleMaxDeg - angleMinDeg,
      peakAngularVelocityDegS,
    };
  });

  // Speed profile: per-frame mean over landmarks of ||p(t)-p(t-1)|| / dt.
  const speedProfile = new Array<number>(n).fill(0);
  for (let i = 1; i < n; i++) {
    const prev = frames[i - 1];
    const cur = frames[i];
    if (!prev.hasPose || !cur.hasPose) continue;
    const m = Math.min(prev.landmarks.length, cur.landmarks.length);
    if (m === 0) continue;
    let sum = 0;
    for (let k = 0; k < m; k++) {
      const p = cur.landmarks[k];
      const q = prev.landmarks[k];
      sum += Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z);
    }
    speedProfile[i] = sum / m / frameDtSeconds(frames, i, dt);
  }

  // Acceleration: discrete derivative of the smoothed speed.
  const smoothSpeed = movingAverage(speedProfile, 3);
  const accelProfile = new Array<number>(n).fill(0);
  for (let i = 1; i < n; i++) {
    accelProfile[i] = (smoothSpeed[i] - smoothSpeed[i - 1]) / frameDtSeconds(frames, i, dt);
  }

  // Symmetry: mean absolute left/right angle difference per JOINT_PAIRS.
  const pairDiffDeg: Record<string, number> = {};
  const pairMeans: number[] = [];
  for (const [l, r] of JOINT_PAIRS) {
    const a = byId.get(l);
    const b = byId.get(r);
    let sum = 0;
    let cnt = 0;
    if (a && b) {
      for (let i = 0; i < n; i++) {
        if (Number.isFinite(a.raw[i]) && Number.isFinite(b.raw[i])) {
          sum += Math.abs(a.raw[i] - b.raw[i]);
          cnt++;
        }
      }
    }
    const meanDiff = cnt > 0 ? sum / cnt : 0;
    pairDiffDeg[`${l}/${r}`] = meanDiff;
    if (cnt > 0) pairMeans.push(meanDiff);
  }
  const symmetry: SymmetryInfo = {
    score:
      pairMeans.length > 0
        ? 1 / (1 + pairMeans.reduce((a, b) => a + b, 0) / pairMeans.length / 45)
        : 0,
    pairDiffDeg,
  };

  const rhythm = computeRhythm(speedProfile, fps);

  const angleSeries = {} as Record<JointId, number[]>;
  for (const s of series) angleSeries[s.id] = s.raw;

  return {
    durationMs,
    frameCount: n,
    fpsProcessed: fps,
    joints,
    symmetry,
    rhythm,
    speedProfile,
    accelProfile,
    estimated: true,
    angleSeries,
  };
}

export function computeSignatureVector(session: MotionSession): SignatureVector {
  const m = session.metrics;
  const joints = m?.joints ?? [];
  const rangeOf = (id: JointId): number =>
    joints.find((j) => j.jointId === id)?.angleRangeDeg ?? 0;
  const meanRange = (ids: JointId[]): number =>
    ids.length > 0 ? ids.reduce((a, id) => a + rangeOf(id), 0) / ids.length : 0;

  const duration = clamp((m?.durationMs ?? 0) / 10000, 0, 1);
  const amplitude = clamp(meanRange(JOINT_IDS) / 180, 0, 1);
  const speed = norm01(finiteMean(m?.speedProfile ?? []), 0.1);
  const symmetry = clamp(m?.symmetry.score ?? 0, 0, 1);
  const rhythm = clamp(m?.rhythm.regularity ?? 0, 0, 1);

  // Verticality: range of the hips midpoint y across valid frames (image units).
  let minY = Infinity;
  let maxY = -Infinity;
  for (const f of session.frames) {
    if (!f.hasPose || f.landmarks.length <= LM.rightHip) continue;
    const y = (f.landmarks[LM.leftHip].y + f.landmarks[LM.rightHip].y) / 2;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const verticality = norm01(maxY >= minY ? maxY - minY : 0, 0.05);

  const legs = clamp(meanRange(['kneeL', 'kneeR', 'hipL', 'hipR']) / 180, 0, 1);
  const arms = clamp(meanRange(['elbowL', 'elbowR', 'shoulderL', 'shoulderR']) / 180, 0, 1);

  // Smoothness: 1/(1 + mean jerk), jerk = |d(accel)/dt|.
  let meanJerk = 0;
  const accel = m?.accelProfile ?? [];
  if (accel.length > 1) {
    const fps = m.fpsProcessed > 0 ? m.fpsProcessed : 30;
    let sum = 0;
    let cnt = 0;
    for (let i = 1; i < accel.length; i++) {
      const d = Math.abs(accel[i] - accel[i - 1]) * fps;
      if (Number.isFinite(d)) {
        sum += d;
        cnt++;
      }
    }
    meanJerk = cnt > 0 ? sum / cnt : 0;
  }
  const smoothness = clamp(1 / (1 + meanJerk), 0, 1);
  const energy = clamp(speed * amplitude, 0, 1);

  const values = [
    duration,
    amplitude,
    speed,
    symmetry,
    rhythm,
    verticality,
    legs,
    arms,
    smoothness,
    energy,
  ];
  return { values, labels: [...SIGNATURE_LABELS] };
}

/**
 * Per-frame speed of a single landmark, smoothed and normalized to 0..1
 * (all zeros when the landmark never moves). Frame 0 is always 0.
 */
export function landmarkSpeeds(frames: PoseFrame[], index: number): number[] {
  const n = frames.length;
  if (n === 0) return [];
  const speeds = new Array<number>(n).fill(0);
  for (let i = 1; i < n; i++) {
    const p = frames[i - 1].landmarks[index];
    const q = frames[i].landmarks[index];
    if (!p || !q) continue;
    const dt = frameDtSeconds(frames, i, 1 / 30);
    speeds[i] = Math.hypot(q.x - p.x, q.y - p.y, q.z - p.z) / dt;
  }
  const smooth = movingAverage(speeds, 3);
  const max = Math.max(...smooth);
  const out = !(max > 0) ? smooth.map(() => 0) : smooth.map((v) => clamp(v / max, 0, 1));
  if (out.length > 0) out[0] = 0; // frame 0 has no predecessor: speed undefined
  return out;
}
