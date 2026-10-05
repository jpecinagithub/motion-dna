/**
 * src/lib/mediapipe/index.ts — public surface of the pose engine module.
 */
export { createPoseEngine } from './pose-engine';
export type { PoseEngine, PoseEngineStage } from './pose-engine';
export { loadVideoFile, processVideoFrames } from './video-processor';
export type { VideoFile, ProcessCallbacks } from './video-processor';
export { generateSyntheticSession } from './synthetic';
export type { SyntheticKind } from './synthetic';
