/**
 * synthetic.ts — procedural 33-landmark demo sessions (no video required).
 * Builds a plausible standing base pose in image space (x,y in 0..1, y DOWN,
 * z small) and animates it per kind: jump / squat / dance.
 */
import type { Landmark, MotionSession, PoseFrame } from '../../types';
import { computeMetrics } from '../math';
import { uid } from '../utils';
import { JOINT_IDS, LANDMARK_COUNT, LM } from '../joints';

export type SyntheticKind = 'jump' | 'squat' | 'dance';

const FPS = 20;

/** Standing person centred at x=0.5: head y≈0.15, hips y≈0.55, feet y≈0.95. */
function basePose(): Landmark[] {
  const P = (x: number, y: number, z = 0): Landmark => ({ x, y, z, visibility: 0.99 });
  const pts: Landmark[] = new Array<Landmark>(LANDMARK_COUNT);

  // face detail (0..10) clustered near the head
  pts[0] = P(0.5, 0.12);
  pts[1] = P(0.485, 0.105);
  pts[2] = P(0.475, 0.105);
  pts[3] = P(0.465, 0.105);
  pts[4] = P(0.515, 0.105);
  pts[5] = P(0.525, 0.105);
  pts[6] = P(0.535, 0.105);
  pts[7] = P(0.455, 0.115);
  pts[8] = P(0.545, 0.115);
  pts[9] = P(0.49, 0.135);
  pts[10] = P(0.51, 0.135);

  // arms, slightly out and down
  pts[LM.leftShoulder] = P(0.42, 0.28);
  pts[LM.rightShoulder] = P(0.58, 0.28);
  pts[LM.leftElbow] = P(0.36, 0.4);
  pts[LM.rightElbow] = P(0.64, 0.4);
  pts[LM.leftWrist] = P(0.32, 0.52);
  pts[LM.rightWrist] = P(0.68, 0.52);
  // hand detail (17..22) near the wrists
  pts[17] = P(0.305, 0.535);
  pts[18] = P(0.695, 0.535);
  pts[19] = P(0.315, 0.545);
  pts[20] = P(0.685, 0.545);
  pts[21] = P(0.33, 0.53);
  pts[22] = P(0.67, 0.53);

  // hips, legs, feet
  pts[LM.leftHip] = P(0.44, 0.55);
  pts[LM.rightHip] = P(0.56, 0.55);
  pts[LM.leftKnee] = P(0.44, 0.72);
  pts[LM.rightKnee] = P(0.56, 0.72);
  pts[LM.leftAnkle] = P(0.44, 0.9);
  pts[LM.rightAnkle] = P(0.56, 0.9);
  pts[LM.leftHeel] = P(0.435, 0.945);
  pts[LM.rightHeel] = P(0.565, 0.945);
  pts[LM.leftFootIndex] = P(0.455, 0.955);
  pts[LM.rightFootIndex] = P(0.545, 0.955);

  return pts;
}

/** Animation function: clone of base pose moved for time tSec. */
type Animator = (base: Landmark[], tSec: number) => Landmark[];

/** Clone the base pose and expose an additive offset helper. */
function withOffsets(base: Landmark[]): { out: Landmark[]; add: (i: number, dx: number, dy: number, dz?: number) => void } {
  const out = base.map((p) => ({ ...p }));
  const add = (i: number, dx: number, dy: number, dz = 0) => {
    const q = out[i];
    q.x += dx;
    q.y += dy;
    q.z += dz;
  };
  return { out, add };
}

const FACE = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const ARMS_L = [LM.leftShoulder, LM.leftElbow, LM.leftWrist, 17, 19, 21];
const ARMS_R = [LM.rightShoulder, LM.rightElbow, LM.rightWrist, 18, 20, 22];
const HIPS = [LM.leftHip, LM.rightHip];
const FEET = [LM.leftAnkle, LM.rightAnkle, LM.leftHeel, LM.rightHeel, LM.leftFootIndex, LM.rightFootIndex];

/** Smooth 0→1→0 envelope over the normalized phase window [a, b]. */
function sineEnvelope(p: number, a: number, b: number): number {
  if (p < a || p > b) return 0;
  return Math.sin((Math.PI * (p - a)) / (b - a));
}

/** jump — 2.4s: crouch → explosive extension (arms up) → soft land. */
function animateJump(base: Landmark[], tSec: number): Landmark[] {
  const p = tSec / 2.4;
  const { out, add } = withOffsets(base);

  const crouch = sineEnvelope(p, 0.05, 0.34);
  const extend = sineEnvelope(p, 0.34, 0.64);
  const land = sineEnvelope(p, 0.64, 1.0);

  const bodyRise = -0.28 * extend; // whole body leaves the ground

  // hips: dip in crouch, rise in extension, absorb on landing
  for (const i of HIPS) add(i, 0, bodyRise + 0.12 * crouch + 0.08 * land);
  // knees bend: dip + drift outward + come forward (z)
  add(LM.leftKnee, -0.02 * crouch, bodyRise + 0.08 * crouch + 0.05 * land, 0.05 * crouch);
  add(LM.rightKnee, 0.02 * crouch, bodyRise + 0.08 * crouch + 0.05 * land, 0.05 * crouch);
  // feet: tucked slightly higher in the air, replant on landing
  for (const i of FEET) add(i, 0, bodyRise + 0.1 * extend);
  // head / face: slight dip with the crouch
  for (const i of FACE) add(i, 0, bodyRise + 0.06 * crouch + 0.03 * land);
  // shoulders ride the body
  add(LM.leftShoulder, 0, bodyRise + 0.08 * crouch + 0.04 * land);
  add(LM.rightShoulder, 0, bodyRise + 0.08 * crouch + 0.04 * land);
  // arms: swing down in crouch, explode overhead in extension
  const wristUp = 0.08; // target overhead wrist y
  const wristDyL = base[LM.leftWrist].y;
  const wristDyR = base[LM.rightWrist].y;
  const elbowDyL = base[LM.leftElbow].y;
  const elbowDyR = base[LM.rightElbow].y;
  add(LM.leftElbow, 0, bodyRise + 0.06 * crouch + (0.3 - elbowDyL) * extend * 0.7);
  add(LM.rightElbow, 0, bodyRise + 0.06 * crouch + (0.3 - elbowDyR) * extend * 0.7);
  add(LM.leftWrist, 0, bodyRise + 0.06 * crouch + (wristUp - wristDyL) * extend, 0.02 * extend);
  add(LM.rightWrist, 0, bodyRise + 0.06 * crouch + (wristUp - wristDyR) * extend, 0.02 * extend);
  for (const i of [17, 19, 21]) add(i, 0, bodyRise + 0.06 * crouch + (wristUp - base[i].y) * extend, 0.02 * extend);
  for (const i of [18, 20, 22]) add(i, 0, bodyRise + 0.06 * crouch + (wristUp - base[i].y) * extend, 0.02 * extend);

  return out;
}

/** squat — 3.2s: two smooth reps, hips down, knees bend forward. */
function animateSquat(base: Landmark[], tSec: number): Landmark[] {
  const p = tSec / 3.2;
  const { out, add } = withOffsets(base);

  const e = 0.5 - 0.5 * Math.cos(2 * Math.PI * 2 * p); // two reps, 0..1..0 x2

  // hips drop ~0.20 at the bottom
  for (const i of HIPS) add(i, 0, 0.2 * e);
  // knees bend: down + forward (z toward camera)
  add(LM.leftKnee, -0.015 * e, 0.1 * e, 0.05 * e);
  add(LM.rightKnee, 0.015 * e, 0.1 * e, 0.05 * e);
  // torso follows the hips
  for (const i of FACE) add(i, 0, 0.12 * e);
  add(LM.leftShoulder, 0, 0.12 * e);
  add(LM.rightShoulder, 0, 0.12 * e);
  // arms drift forward for balance
  for (const i of ARMS_L) add(i, 0, 0.05 * e, 0.08 * e);
  for (const i of ARMS_R) add(i, 0, 0.05 * e, 0.08 * e);
  // ankles/knees: depth life
  add(LM.leftAnkle, 0, 0, 0.02 * e);
  add(LM.rightAnkle, 0, 0, 0.02 * e);

  return out;
}

/** dance — 4s: side sway, alternating arm waves, hip bounce. */
function animateDance(base: Landmark[], tSec: number): Landmark[] {
  const p = tSec / 4;
  const { out, add } = withOffsets(base);

  const sway = Math.sin(2 * Math.PI * 2 * p); // ±0.08 side sway
  const bounce = -0.03 * (0.5 - 0.5 * Math.cos(2 * Math.PI * 4 * p));
  const armWave = Math.sin(2 * Math.PI * 2 * p + Math.PI / 2); // arm phase

  // hips: sway + bounce
  for (const i of HIPS) add(i, 0.08 * sway, bounce);
  // knees follow with a lag
  add(LM.leftKnee, 0.05 * sway, bounce * 0.5, 0.03 * Math.sin(2 * Math.PI * 2 * p + 1));
  add(LM.rightKnee, 0.05 * sway, bounce * 0.5, 0.03 * Math.sin(2 * Math.PI * 2 * p + 2));
  // feet planted: smaller sway
  for (const i of FEET) add(i, 0.015 * sway, 0);
  // shoulders + head follow, slightly delayed
  add(LM.leftShoulder, 0.06 * sway, bounce * 0.7);
  add(LM.rightShoulder, 0.06 * sway, bounce * 0.7);
  for (const i of FACE) add(i, 0.07 * sway, bounce * 0.7);
  // arms: alternate up/down
  const liftL = Math.max(0, armWave);
  const liftR = Math.max(0, -armWave);
  add(LM.leftElbow, 0.02 * sway, -0.16 * liftL + bounce * 0.7, 0.05 * Math.sin(2 * Math.PI * 3 * p));
  add(LM.rightElbow, 0.02 * sway, -0.16 * liftR + bounce * 0.7, 0.05 * Math.sin(2 * Math.PI * 3 * p + 1));
  add(LM.leftWrist, 0.03 * sway, -0.24 * liftL + bounce * 0.7, 0.05 * Math.sin(2 * Math.PI * 3 * p));
  add(LM.rightWrist, 0.03 * sway, -0.24 * liftR + bounce * 0.7, 0.05 * Math.sin(2 * Math.PI * 3 * p + 1));
  for (const i of [17, 19, 21]) add(i, 0.03 * sway, -0.24 * liftL + bounce * 0.7, 0.05 * Math.sin(2 * Math.PI * 3 * p));
  for (const i of [18, 20, 22]) add(i, 0.03 * sway, -0.24 * liftR + bounce * 0.7, 0.05 * Math.sin(2 * Math.PI * 3 * p + 1));

  return out;
}

function buildFrames(durationSec: number, animate: Animator): PoseFrame[] {
  const base = basePose();
  const n = Math.round(durationSec * FPS);
  const frames: PoseFrame[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / FPS;
    const landmarks = animate(base, t);
    frames.push({
      timestampMs: Math.round(t * 1000),
      landmarks,
      worldLandmarks: landmarks.map((p) => ({ ...p, z: p.z * 2 })),
      hasPose: true,
      visibleJoints: [...JOINT_IDS],
    });
  }
  return frames;
}

const DEFS: Record<SyntheticKind, { name: string; durationSec: number; animate: Animator }> = {
  jump: { name: 'Demo · Salto vertical', durationSec: 2.4, animate: animateJump },
  squat: { name: 'Demo · Sentadilla', durationSec: 3.2, animate: animateSquat },
  dance: { name: 'Demo · Baile', durationSec: 4.0, animate: animateDance },
};

/** Procedural 33-landmark sequence (no video) with computed metrics. */
export function generateSyntheticSession(kind: SyntheticKind): MotionSession {
  const def = DEFS[kind];
  const frames = buildFrames(def.durationSec, def.animate);
  const metrics = computeMetrics(frames, FPS);
  return {
    id: uid('sess'),
    name: def.name,
    source: 'synthetic',
    durationMs: Math.round((frames.length * 1000) / FPS),
    fpsProcessed: FPS,
    frames,
    metrics,
    createdAt: new Date().toISOString(),
  };
}
