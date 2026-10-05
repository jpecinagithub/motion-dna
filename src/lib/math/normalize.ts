/**
 * Pose normalization: translate hips midpoint to the origin and scale so the
 * torso (hips midpoint <-> shoulders midpoint) has length 1.
 */
import type { Landmark } from '../../types';
import { LANDMARK_COUNT, LM } from '../joints';

function midpoint(p: Landmark, q: Landmark): { x: number; y: number; z: number } {
  return {
    x: (p.x + q.x) / 2,
    y: (p.y + q.y) / 2,
    z: (p.z + q.z) / 2,
  };
}

export function normalizeLandmarks(landmarks: Landmark[]): Landmark[] {
  if (!landmarks || landmarks.length < LANDMARK_COUNT) return landmarks.slice();
  const hips = midpoint(landmarks[LM.leftHip], landmarks[LM.rightHip]);
  const shoulders = midpoint(landmarks[LM.leftShoulder], landmarks[LM.rightShoulder]);
  const torso = Math.hypot(shoulders.x - hips.x, shoulders.y - hips.y, shoulders.z - hips.z);
  const s = torso > 1e-9 ? 1 / torso : 1;
  return landmarks.map((p) => ({
    x: (p.x - hips.x) * s,
    y: (p.y - hips.y) * s,
    z: (p.z - hips.z) * s,
    visibility: p.visibility,
  }));
}

/** Flattened xyz of the normalized pose (33 * 3 = 99 numbers). */
export function normalizedPoseVector(landmarks: Landmark[]): number[] {
  const n = normalizeLandmarks(landmarks);
  const out = new Array<number>(n.length * 3);
  for (let i = 0; i < n.length; i++) {
    out[i * 3] = n[i].x;
    out[i * 3 + 1] = n[i].y;
    out[i * 3 + 2] = n[i].z;
  }
  return out;
}
