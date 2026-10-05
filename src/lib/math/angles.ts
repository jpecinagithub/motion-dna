/**
 * Joint-angle geometry on MediaPipe pose landmarks.
 */
import type { JointId, Landmark, PoseFrame } from '../../types';
import { JOINT_IDS, JOINTS, LANDMARK_COUNT } from '../joints';
import { vdot, vlen, vsub } from './vec';

/**
 * Angle in degrees at `b` between vectors b->a and b->c, in [0,180].
 * Degenerate (zero-length) vectors -> 0.
 */
export function angleAt(a: Landmark, b: Landmark, c: Landmark): number {
  const ba = vsub([a.x, a.y, a.z], [b.x, b.y, b.z]);
  const bc = vsub([c.x, c.y, c.z], [b.x, b.y, b.z]);
  const la = vlen(ba);
  const lc = vlen(bc);
  if (la < 1e-9 || lc < 1e-9) return 0;
  const cos = Math.min(1, Math.max(-1, vdot(ba, bc) / (la * lc)));
  const deg = (Math.acos(cos) * 180) / Math.PI;
  return Math.min(180, Math.max(0, deg));
}

/** Angles for the 8 tracked JOINTS; null for every joint when landmarks are empty/short. */
export function jointAngles(landmarks: Landmark[]): Record<JointId, number | null> {
  const out = {} as Record<JointId, number | null>;
  const ok = !!landmarks && landmarks.length >= LANDMARK_COUNT;
  for (const id of JOINT_IDS) {
    if (!ok) {
      out[id] = null;
      continue;
    }
    const j = JOINTS[id];
    out[id] = angleAt(landmarks[j.a], landmarks[j.b], landmarks[j.c]);
  }
  return out;
}

/** Per-frame angle for one joint; NaN where the frame has no pose (or landmarks are empty). */
export function jointAngleSeries(frames: PoseFrame[], id: JointId): number[] {
  return frames.map((f) => {
    if (!f.hasPose || !f.landmarks || f.landmarks.length === 0) return NaN;
    const v = jointAngles(f.landmarks)[id];
    return v === null ? NaN : v;
  });
}
