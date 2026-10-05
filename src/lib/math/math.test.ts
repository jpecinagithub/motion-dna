/**
 * Tests for the math module (vec/angles/smoothing/normalize/dtw/metrics).
 */
import { describe, expect, it } from 'vitest';
import type { JointId, Landmark, PoseFrame } from '../../types';
import { JOINT_IDS } from '../joints';
import { angleAt, jointAngleSeries, jointAngles } from './angles';
import { bestOffsetFrames, dtw } from './dtw';
import { computeMetrics, computeSignatureVector, landmarkSpeeds } from './metrics';
import { normalizeLandmarks, normalizedPoseVector } from './normalize';
import { exponentialSmooth, interpolateNaN, movingAverage } from './smoothing';

function lm(x: number, y: number, z = 0, visibility = 1): Landmark {
  return { x, y, z, visibility };
}

/** 33-landmark pose with the left elbow bent at `angleDeg` (sine-test rig). */
function syntheticPose(angleDeg: number): Landmark[] {
  const p: Landmark[] = Array.from({ length: 33 }, () => lm(0.5, 0.5, 0, 1));
  p[11] = lm(0.4, 0.3); // left shoulder
  p[13] = lm(0.4, 0.5); // left elbow
  const phi = Math.PI * (1 - angleDeg / 180);
  p[15] = lm(0.4 + 0.2 * Math.sin(phi), 0.5 + 0.2 * Math.cos(phi)); // left wrist
  p[23] = lm(0.4, 0.6);
  p[24] = lm(0.6, 0.6);
  return p;
}

/** Frames at 20fps, left elbow swinging sinusoidally 30..150 deg with the given period. */
function syntheticFrames(count = 20, anglePeriod = count): PoseFrame[] {
  const frames: PoseFrame[] = [];
  for (let i = 0; i < count; i++) {
    const angleDeg = 90 + 60 * Math.sin((2 * Math.PI * i) / anglePeriod);
    frames.push({
      timestampMs: i * 50,
      landmarks: syntheticPose(angleDeg),
      hasPose: true,
    });
  }
  return frames;
}

describe('angleAt', () => {
  it('returns 90 for a right angle', () => {
    expect(angleAt(lm(1, 0), lm(0, 0), lm(0, 1))).toBeCloseTo(90, 10);
  });
  it('returns 180 for a straight line', () => {
    expect(angleAt(lm(1, 0), lm(0, 0), lm(-1, 0))).toBeCloseTo(180, 10);
  });
  it('returns 0 for degenerate (zero-length) vectors', () => {
    expect(angleAt(lm(0, 0), lm(0, 0), lm(1, 0))).toBe(0);
    expect(angleAt(lm(1, 0), lm(0, 0), lm(0, 0))).toBe(0);
  });
  it('stays within [0, 180]', () => {
    const v = angleAt(lm(0.3, -0.7), lm(0, 0), lm(-0.2, 0.9));
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThanOrEqual(180);
  });
});

describe('jointAngles / jointAngleSeries', () => {
  it('returns null for every joint when landmarks are short', () => {
    const out = jointAngles([lm(0, 0)]);
    for (const id of JOINT_IDS) expect(out[id]).toBeNull();
  });
  it('returns NaN where a frame has no pose', () => {
    const frames: PoseFrame[] = [
      { timestampMs: 0, landmarks: [], hasPose: false },
      { timestampMs: 50, landmarks: syntheticPose(90), hasPose: true },
    ];
    const s = jointAngleSeries(frames, 'elbowL');
    expect(s[0]).toBeNaN();
    expect(s[1]).toBeCloseTo(90, 6);
  });
  it('tracks the synthetic elbow sine', () => {
    const s = jointAngleSeries(syntheticFrames(), 'elbowL');
    expect(Math.min(...s)).toBeCloseTo(30, 4);
    expect(Math.max(...s)).toBeCloseTo(150, 4);
  });
});

describe('movingAverage', () => {
  it('computes a centered window with edge clamping', () => {
    const out = movingAverage([1, 2, 3, 4, 5], 3);
    expect(out).toHaveLength(5);
    expect(out[0]).toBeCloseTo(4 / 3, 10);
    expect(out[1]).toBeCloseTo(2, 10);
    expect(out[2]).toBeCloseTo(3, 10);
    expect(out[3]).toBeCloseTo(4, 10);
    expect(out[4]).toBeCloseTo(14 / 3, 10);
  });
  it('handles empty input and window 1', () => {
    expect(movingAverage([], 3)).toEqual([]);
    expect(movingAverage([2, 4], 1)).toEqual([2, 4]);
  });
});

describe('exponentialSmooth / interpolateNaN', () => {
  it('smooths exponentially', () => {
    const out = exponentialSmooth([0, 10, 10], 0.5);
    expect(out[0]).toBe(0);
    expect(out[1]).toBeCloseTo(5, 10);
    expect(out[2]).toBeCloseTo(7.5, 10);
  });
  it('fills NaN runs linearly and edges with nearest values', () => {
    const out = interpolateNaN([NaN, NaN, 2, NaN, 8, NaN]);
    expect(out[0]).toBe(2);
    expect(out[1]).toBe(2);
    expect(out[2]).toBe(2);
    expect(out[3]).toBeCloseTo(5, 10);
    expect(out[4]).toBe(8);
    expect(out[5]).toBe(8);
  });
});

describe('normalizeLandmarks', () => {
  it('puts the hips midpoint at the origin and keeps visibility', () => {
    const p: Landmark[] = Array.from({ length: 33 }, () => lm(0.5, 0.5, 0, 0.9));
    p[23] = lm(0.4, 0.6, 0.1, 0.7);
    p[24] = lm(0.6, 0.6, -0.1, 0.8);
    p[11] = lm(0.45, 0.3);
    p[12] = lm(0.55, 0.3);
    const n = normalizeLandmarks(p);
    const hipsX = (n[23].x + n[24].x) / 2;
    const hipsY = (n[23].y + n[24].y) / 2;
    const hipsZ = (n[23].z + n[24].z) / 2;
    expect(hipsX).toBeCloseTo(0, 10);
    expect(hipsY).toBeCloseTo(0, 10);
    expect(hipsZ).toBeCloseTo(0, 10);
    // torso (0.3 units) scaled to 1
    const sx = (n[11].x + n[12].x) / 2;
    const sy = (n[11].y + n[12].y) / 2;
    expect(Math.hypot(sx - hipsX, sy - hipsY)).toBeCloseTo(1, 10);
    expect(n[23].visibility).toBe(0.7);
    expect(n[24].visibility).toBe(0.8);
  });
  it('flattens to 99 numbers', () => {
    const p: Landmark[] = Array.from({ length: 33 }, () => lm(0.5, 0.5, 0, 1));
    p[23] = lm(0.4, 0.6);
    p[24] = lm(0.6, 0.6);
    p[11] = lm(0.45, 0.3);
    p[12] = lm(0.55, 0.3);
    expect(normalizedPoseVector(p)).toHaveLength(99);
  });
});

describe('dtw', () => {
  it('returns distance 0 for identical sequences', () => {
    const seq = [
      [0, 0],
      [1, 2],
      [3, 1],
    ];
    const r = dtw(seq, seq);
    expect(r.distance).toBeCloseTo(0, 10);
    expect(r.path).toEqual([
      [0, 0],
      [1, 1],
      [2, 2],
    ]);
  });
  it('handles empty input without throwing', () => {
    expect(dtw([], [[1]]).distance).toBe(0);
    expect(dtw([], [[1]]).path).toEqual([]);
  });
  it('bestOffsetFrames finds the integer shift aligning b onto a', () => {
    const a = [[0], [1], [2], [3]];
    const b = [[1], [2], [3], [4]]; // b[j] == a[j] + 1 -> b leads a by 1
    expect(bestOffsetFrames(a, a)).toBe(0);
    expect(bestOffsetFrames(a, b)).toBe(-1);
  });
});

describe('computeMetrics', () => {
  it('never throws on empty input and returns zeroed metrics', () => {
    const m = computeMetrics([], 20);
    expect(m.estimated).toBe(true);
    expect(m.frameCount).toBe(0);
    expect(m.joints).toHaveLength(8);
    for (const j of m.joints) {
      expect(j.angleMeanDeg).toBe(0);
      expect(j.peakAngularVelocityDegS).toBe(0);
    }
    expect(Object.keys(m.angleSeries)).toHaveLength(8);
  });

  it('handles 20 synthetic sine frames: no NaN, estimated, 8 angle series', () => {
    const frames = syntheticFrames(20);
    const m = computeMetrics(frames, 20);
    expect(m.estimated).toBe(true);
    expect(m.frameCount).toBe(20);
    expect(m.joints).toHaveLength(8);
    for (const j of m.joints) {
      expect(Number.isFinite(j.angleMeanDeg)).toBe(true);
      expect(Number.isFinite(j.angleMinDeg)).toBe(true);
      expect(Number.isFinite(j.angleMaxDeg)).toBe(true);
      expect(Number.isFinite(j.angleRangeDeg)).toBe(true);
      expect(Number.isFinite(j.peakAngularVelocityDegS)).toBe(true);
    }
    const elbow = m.joints.find((j) => j.jointId === 'elbowL');
    expect(elbow).toBeDefined();
    expect(elbow!.angleRangeDeg).toBeGreaterThan(100);
    expect(elbow!.peakAngularVelocityDegS).toBeGreaterThan(0);
    // angleSeries: 8 keys, NaN preserved nowhere here (all frames have pose)
    const keys = Object.keys(m.angleSeries).sort();
    expect(keys).toEqual([...JOINT_IDS].sort() as JointId[]);
    for (const k of keys) {
      expect(m.angleSeries[k as JointId]).toHaveLength(20);
      expect(m.angleSeries[k as JointId].every(Number.isFinite)).toBe(true);
    }
    // profiles
    expect(m.speedProfile).toHaveLength(20);
    expect(m.speedProfile.every(Number.isFinite)).toBe(true);
    expect(m.accelProfile).toHaveLength(20);
    expect(m.accelProfile.every(Number.isFinite)).toBe(true);
    // symmetry + rhythm are sane
    expect(m.symmetry.score).toBeGreaterThanOrEqual(0);
    expect(m.symmetry.score).toBeLessThanOrEqual(1);
    expect(Number.isFinite(m.rhythm.bpm)).toBe(true);
    expect(m.rhythm.regularity).toBeGreaterThanOrEqual(0);
    expect(m.rhythm.regularity).toBeLessThanOrEqual(1);
  });

  it('detects the sine period via rhythm autocorrelation', () => {
    // 40 frames, elbow period 20 frames (1s) -> speed period 10 frames -> ~120 bpm
    const m = computeMetrics(syntheticFrames(40, 20), 20);
    expect(m.rhythm.bpm).toBeCloseTo(120, 0);
    expect(m.rhythm.regularity).toBeGreaterThan(0.5);
  });

  it('produces a valid 10-feature signature vector', () => {
    const frames = syntheticFrames(20);
    const metrics = computeMetrics(frames, 20);
    const sig = computeSignatureVector({
      id: 'test',
      name: 'test',
      source: 'synthetic',
      durationMs: metrics.durationMs,
      fpsProcessed: 20,
      frames,
      metrics,
      createdAt: new Date().toISOString(),
    });
    expect(sig.labels).toEqual([
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
    ]);
    expect(sig.values).toHaveLength(10);
    for (const v of sig.values) {
      expect(Number.isFinite(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });
});

describe('landmarkSpeeds', () => {
  it('returns normalized 0..1 per-frame speeds', () => {
    const frames = syntheticFrames(20);
    const s = landmarkSpeeds(frames, 15); // left wrist moves
    expect(s).toHaveLength(20);
    expect(s[0]).toBe(0);
    for (const v of s) {
      expect(Number.isFinite(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
    expect(Math.max(...s)).toBeCloseTo(1, 10);
  });
  it('returns zeros for a static landmark and [] for empty frames', () => {
    const frames = syntheticFrames(20);
    expect(landmarkSpeeds(frames, 0).every((v) => v === 0)).toBe(true);
    expect(landmarkSpeeds([], 15)).toEqual([]);
  });
});
