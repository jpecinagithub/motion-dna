/**
 * MediaPipe Pose (33 landmarks) topology: indices, bone connections,
 * joint-angle definitions and helpers to map landmarks into scene space.
 */
import type { JointDef, JointId, Landmark } from '../types';

export const LANDMARK_COUNT = 33;

/** MediaPipe pose landmark indices (subset most used, full list in comments). */
export const LM = {
  nose: 0,
  leftShoulder: 11,
  rightShoulder: 12,
  leftElbow: 13,
  rightElbow: 14,
  leftWrist: 15,
  rightWrist: 16,
  leftHip: 23,
  rightHip: 24,
  leftKnee: 25,
  rightKnee: 26,
  leftAnkle: 27,
  rightAnkle: 28,
  leftHeel: 29,
  rightHeel: 30,
  leftFootIndex: 31,
  rightFootIndex: 32,
} as const;

/** Bone connections for skeleton rendering (2D overlay + 3D). */
export const BONES: Array<[number, number]> = [
  [11, 12], // shoulders
  [11, 13], [13, 15], // left arm
  [12, 14], [14, 16], // right arm
  [15, 17], [15, 19], [15, 21], // left hand
  [16, 18], [16, 20], [16, 22], // right hand
  [11, 23], [12, 24], // torso sides
  [23, 24], // hips
  [23, 25], [25, 27], // left leg
  [24, 26], [26, 28], // right leg
  [27, 29], [29, 31], // left foot
  [28, 30], [30, 32], // right foot
  [0, 1], [1, 2], [2, 3], [3, 7], // face left
  [0, 4], [4, 5], [5, 6], [6, 8], // face right
  [9, 10], // mouth
];

/** The 8 tracked joints: angle measured at b between a->b and c->b. */
export const JOINTS: Record<JointId, JointDef> = {
  elbowL: { id: 'elbowL', a: LM.leftShoulder, b: LM.leftElbow, c: LM.leftWrist, trailIndex: LM.leftWrist },
  elbowR: { id: 'elbowR', a: LM.rightShoulder, b: LM.rightElbow, c: LM.rightWrist, trailIndex: LM.rightWrist },
  kneeL: { id: 'kneeL', a: LM.leftHip, b: LM.leftKnee, c: LM.leftAnkle, trailIndex: LM.leftAnkle },
  kneeR: { id: 'kneeR', a: LM.rightHip, b: LM.rightKnee, c: LM.rightAnkle, trailIndex: LM.rightAnkle },
  shoulderL: { id: 'shoulderL', a: LM.leftElbow, b: LM.leftShoulder, c: LM.leftHip, trailIndex: LM.leftWrist },
  shoulderR: { id: 'shoulderR', a: LM.rightElbow, b: LM.rightShoulder, c: LM.rightHip, trailIndex: LM.rightWrist },
  hipL: { id: 'hipL', a: LM.leftShoulder, b: LM.leftHip, c: LM.leftKnee, trailIndex: LM.leftAnkle },
  hipR: { id: 'hipR', a: LM.rightShoulder, b: LM.rightHip, c: LM.rightKnee, trailIndex: LM.rightAnkle },
};

export const JOINT_IDS: JointId[] = [
  'elbowL', 'elbowR', 'kneeL', 'kneeR',
  'shoulderL', 'shoulderR', 'hipL', 'hipR',
];

/** Left/right joint pairs used for the symmetry score. */
export const JOINT_PAIRS: Array<[JointId, JointId]> = [
  ['elbowL', 'elbowR'],
  ['kneeL', 'kneeR'],
  ['shoulderL', 'shoulderR'],
  ['hipL', 'hipR'],
];

/** Default trail landmarks (wrists + ankles). */
export const DEFAULT_TRAIL_INDICES = [LM.leftWrist, LM.rightWrist, LM.leftAnkle, LM.rightAnkle];

const HIPS = [LM.leftHip, LM.rightHip];
const TORSO_TOP = [LM.leftShoulder, LM.rightShoulder];

function mid(a: Landmark, b: Landmark): Landmark {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 };
}

/**
 * Map image-space landmarks to a centered 3D scene space:
 * hips at origin, Y up, subject ~2 units tall, Z = relative depth.
 * Returns null when there is no usable pose.
 */
export function landmarksToScene(landmarks: Landmark[]): Array<[number, number, number]> | null {
  if (!landmarks || landmarks.length < LANDMARK_COUNT) return null;
  const hips = mid(landmarks[HIPS[0]], landmarks[HIPS[1]]);
  const shoulders = mid(landmarks[TORSO_TOP[0]], landmarks[TORSO_TOP[1]]);
  const torsoH =
    Math.hypot(shoulders.x - hips.x, shoulders.y - hips.y, shoulders.z - hips.z) || 1;
  // normalize so torso ~= 1 unit; subject ~2 units tall
  const s = 1 / torsoH;
  return landmarks.map((p) => [
    (p.x - hips.x) * s,
    (hips.y - p.y) * s, // flip: image y grows downward
    -(p.z - hips.z) * s,
  ]);
}

/** Simple visibility-weighted pose quality 0..1. */
export function poseQuality(landmarks: Landmark[]): number {
  if (!landmarks || landmarks.length === 0) return 0;
  let sum = 0;
  for (const p of landmarks) sum += p.visibility ?? 0.5;
  return sum / landmarks.length;
}
