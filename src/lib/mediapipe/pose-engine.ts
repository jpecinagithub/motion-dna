/**
 * pose-engine.ts — lazy MediaPipe PoseLandmarker wrapper.
 *
 * The @mediapipe/tasks-vision import is intentionally dynamic (inside init),
 * so the initial app bundle never includes the vision library or its wasm.
 */
import type { PoseLandmarker } from '@mediapipe/tasks-vision';
import type { Landmark, PoseFrame } from '../../types';
import { MEDIAPIPE_MODEL_URL } from '../../config';

export type PoseEngineStage = 'wasm' | 'model' | 'ready';

export interface PoseEngine {
  readonly ready: boolean;
  init(onStage?: (stage: PoseEngineStage) => void): Promise<void>;
  /** VIDEO running mode detection for an already-seeked video element */
  detectVideoFrame(video: HTMLVideoElement, timestampMs: number): Promise<PoseFrame | null>;
  dispose(): Promise<void>;
}

const WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.29/wasm';
/** Lenient acceptance threshold for synthetic/demo-friendly detection. */
const MIN_VISIBILITY = 0.2;

function toLandmark(p: { x: number; y: number; z: number; visibility?: number }): Landmark {
  return { x: p.x, y: p.y, z: p.z, visibility: p.visibility ?? 0 };
}

/**
 * Lazy-loads @mediapipe/tasks-vision (dynamic import) + the pose model.
 * The returned engine must be initialised via init() before detection.
 */
export async function createPoseEngine(): Promise<PoseEngine> {
  let landmarker: PoseLandmarker | null = null;
  let ready = false;

  const engine: PoseEngine = {
    get ready() {
      return ready;
    },

    async init(onStage?: (stage: PoseEngineStage) => void): Promise<void> {
      if (ready && landmarker) return;
      // Lazy: this dynamic import is the only place tasks-vision is loaded.
      const vision = await import('@mediapipe/tasks-vision');

      onStage?.('wasm');
      const fileset = await vision.FilesetResolver.forVisionTasks(WASM_URL);

      onStage?.('model');
      const options = (delegate: 'GPU' | 'CPU') => ({
        baseOptions: { modelAssetPath: MEDIAPIPE_MODEL_URL, delegate },
        runningMode: 'VIDEO' as const,
        numPoses: 1,
      });
      try {
        landmarker = await vision.PoseLandmarker.createFromOptions(fileset, options('GPU'));
      } catch {
        // GPU delegate failed — fall back to CPU with the same wasm fileset.
        landmarker = await vision.PoseLandmarker.createFromOptions(fileset, options('CPU'));
      }
      ready = true;
      onStage?.('ready');
    },

    async detectVideoFrame(video: HTMLVideoElement, timestampMs: number): Promise<PoseFrame | null> {
      if (!landmarker) return null;
      let result;
      try {
        result = landmarker.detectForVideo(video, timestampMs);
      } catch {
        return null;
      }
      const raw = result.landmarks?.[0];
      if (!raw || raw.length === 0) return null;
      const landmarks = raw.map(toLandmark);
      const meanVisibility =
        landmarks.reduce((sum, p) => sum + (p.visibility ?? 0), 0) / landmarks.length;
      const hasPose = meanVisibility >= MIN_VISIBILITY;
      const world = result.worldLandmarks?.[0];
      const worldLandmarks = world ? world.map(toLandmark) : undefined;
      return { timestampMs, landmarks, worldLandmarks, hasPose };
    },

    async dispose(): Promise<void> {
      landmarker?.close();
      landmarker = null;
      ready = false;
    },
  };

  return engine;
}
