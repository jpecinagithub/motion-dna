# MOTION//DNA — Module Contracts

Single source of truth for cross-module APIs. Every module MUST implement
exactly the signatures below. Read `src/types/index.ts`, `src/config.ts`,
`src/lib/joints.ts`, `src/stores/app.ts`, `src/i18n.ts` before coding.

Global rules:
- TypeScript strict. `noUnusedLocals` / `noUnusedParameters` are ON — no unused imports/vars.
- `verbatimModuleSyntax` is ON — use `import type { X }` for type-only imports.
- No placeholder buttons: every control must do something real.
- i18n: use `useT()` from `src/i18n.ts` → `const { t } = useT(); t('timeline.play')`.
  If you need a new string, add it to BOTH `es` and `en` in `src/i18n.ts`.
- State: zustand `useAppStore` from `src/stores/app.ts`. Playhead time: `src/lib/playhead.ts`
  (`getTimeMs()`, `setTimeMs(ms)`, `advanceVirtual(dt)`, `resetPlayhead()`, `setVideoElement`, `hasVideo`).
- Colors: `src/config.ts` (`COLORS`, `JOINT_COLORS`, `AUTHOR_NAME`).

---

## 1. Math — `src/lib/math/` (files: vec.ts, angles.ts, smoothing.ts, normalize.ts, dtw.ts, metrics.ts, index.ts)

```ts
// vec.ts
export type V3 = [number, number, number];
export function vsub(a: V3, b: V3): V3;
export function vdot(a: V3, b: V3): number;
export function vcross(a: V3, b: V3): V3;
export function vlen(a: V3): number;
export function vnorm(a: V3): V3;
export function vdist(a: V3, b: V3): number;

// angles.ts
import type { JointId, Landmark, PoseFrame } from '../../types';
export function angleAt(a: Landmark, b: Landmark, c: Landmark): number; // degrees at b, 0..180
export function jointAngles(landmarks: Landmark[]): Record<JointId, number | null>; // null when no pose
export function jointAngleSeries(frames: PoseFrame[], id: JointId): number[]; // NaN where no pose

// smoothing.ts
export function movingAverage(series: number[], window: number): number[];
export function exponentialSmooth(series: number[], alpha: number): number[];
export function interpolateNaN(series: number[]): number[]; // linear fill of NaN runs

// normalize.ts
export function normalizeLandmarks(landmarks: Landmark[]): Landmark[]; // hips->origin, scale by torso height
export function normalizedPoseVector(landmarks: Landmark[]): number[]; // flattened xyz of normalized pose

// dtw.ts
export interface DtwResult { distance: number; path: Array<[number, number]>; }
export function dtw(a: number[][], b: number[][]): DtwResult;
export function bestOffsetFrames(a: number[][], b: number[][]): number; // frame shift aligning b onto a

// metrics.ts
import type { MotionMetrics, MotionSession, PoseFrame, SignatureVector } from '../../types';
export function computeMetrics(frames: PoseFrame[], fpsProcessed: number): MotionMetrics;
export function computeSignatureVector(session: MotionSession): SignatureVector; // values 0..1 + labels
export function landmarkSpeeds(frames: PoseFrame[], index: number): number[]; // 0..1 normalized per-frame speed
```

`computeMetrics` details: per joint (8 joints from `JOINTS` in `src/lib/joints.ts`):
angle series per frame (NaN-safe) → mean/min/max/range, peak angular velocity (deg/s from
discrete derivative, smoothed). `speedProfile`/`accelProfile`: per-frame mean landmark speed /
acceleration in relative units (normalize each profile 0..1 at the end? No — keep raw relative
units AND also export normalized? Keep raw; UI normalizes for display). `symmetry.score` 0..1
from mean left/right angle differences (smaller diff → closer to 1). `rhythm`: autocorrelation
of speedProfile to find dominant period → bpm + regularity 0..1 (0 if none). `estimated: true`
always. `angleSeries`: Record<JointId, number[]> with NaN where no pose.

`computeSignatureVector`: 10 normalized 0..1 features, e.g.
['duration','amplitude','speed','symmetry','rhythm','verticality','range_legs','range_arms','smoothness','energy'].

Tests: `src/lib/math/math.test.ts` (vitest) covering angleAt (90° case, 180° case),
movingAverage, normalizeLandmarks (hips at origin), dtw (identical sequences distance 0),
computeMetrics on a tiny synthetic frame set (no NaN crash, estimated===true).

## 2. Pose engine — `src/lib/mediapipe/` (pose-engine.ts, video-processor.ts, synthetic.ts, index.ts)

```ts
// pose-engine.ts
import type { PoseFrame } from '../../types';
export interface PoseEngine {
  readonly ready: boolean;
  init(onStage?: (stage: 'wasm' | 'model' | 'ready') => void): Promise<void>;
  /** VIDEO running mode detection for an already-seeked video element */
  detectVideoFrame(video: HTMLVideoElement, timestampMs: number): Promise<PoseFrame | null>;
  dispose(): Promise<void>;
}
/** Lazy-loads @mediapipe/tasks-vision (dynamic import) + model from MEDIAPIPE_MODEL_URL. */
export function createPoseEngine(): Promise<PoseEngine>;
```
Map MediaPipe result: `landmarks[0]` (33) → our `Landmark[]` {x,y,z,visibility}; `worldLandmarks`
optional. `hasPose` = landmarks found && quality ok. Return null on no detection is also fine —
video-processor treats null as empty frame.

```ts
// video-processor.ts
import type { PoseFrame } from '../../types';
import type { PoseEngine } from './pose-engine';
export interface VideoFile { video: HTMLVideoElement; url: string; name: string; durationMs: number; width: number; height: number; }
export interface ProcessCallbacks { onProgress: (done: number, total: number, preview: PoseFrame | null) => void; signal?: AbortSignal; }
/** Creates object URL, waits for metadata, validates duration <= PROCESSING.maxDurationSec. */
export function loadVideoFile(file: File): Promise<VideoFile>;
/**
 * Sequentially seeks the (muted, preloaded) video through time at targetFps steps,
 * runs engine.detectVideoFrame per step, yields to the UI between frames.
 * Never rejects on a single bad frame: stores {hasPose:false, landmarks:[]} instead.
 */
export function processVideoFrames(video: HTMLVideoElement, engine: PoseEngine, targetFps: number, cb: ProcessCallbacks): Promise<PoseFrame[]>;
```

```ts
// synthetic.ts
import type { MotionSession } from '../../types';
export type SyntheticKind = 'jump' | 'squat' | 'dance';
/** Procedural 33-landmark sequence (no video). Uses computeMetrics from ../math. */
export function generateSyntheticSession(kind: SyntheticKind): MotionSession;
```
Build a plausible base skeleton in image space (x,y 0..1, y down, z small), then animate:
- jump: 2.4s — crouch → explosive extension + arms up → land. Vertical hip displacement ~0.25.
- squat: 3s — two squat reps, knees bend (hip y +0.18, knees forward).
- dance: 4s — side sway + alternating arm waves.
fps 20. name e.g. "Demo · Salto vertical" (respect current lang? keep ES names, fine).

## 3. 3D scene — `src/features/scene-3d/` (SceneCanvas.tsx, SkeletonModel.tsx, Trails.tsx, AngleArc.tsx, ExplodeScene.tsx, SignatureMesh.tsx, signature-geometry.ts, Overlay2D.tsx, index.ts)

All R3F components EXCEPT Overlay2D (plain DOM canvas).

```tsx
// SceneCanvas.tsx
import type { ReactNode } from 'react';
export function SceneCanvas({ children, onCanvasReady }: { children: ReactNode; onCanvasReady?: (c: HTMLCanvasElement) => void }): JSX.Element;
// <Canvas camera={{position:[0,1.2,4.2], fov:42}} gl={{antialias:true, preserveDrawingBuffer:true}}>
// dark bg #05070d, subtle grid + fog, OrbitControls (drei, makeDefault), registers canvas via registerSceneCanvas.
// preserveDrawingBuffer:true is REQUIRED for PNG export.
```

```tsx
// SkeletonModel.tsx
import type { Landmark } from '../../types';
export interface SkeletonModelProps {
  landmarks: Landmark[]; color?: string; opacity?: number;
  showJoints?: boolean; jointRadius?: number;
  heatValues?: number[] | null; // 0..1 per landmark -> blue->violet->coral ramp
  lineWidth?: number; // (used only for 2D-ish fallback; lines are 1px in WebGL)
}
export function SkeletonModel(props: SkeletonModelProps): JSX.Element | null;
// Maps landmarks via landmarksToScene (from ../../lib/joints), BONES as lineSegments (buffer geometry via useMemo),
// joints as instancedMesh or individual spheres (33 max — individual <mesh> fine).
// Returns null when landmarksToScene returns null.
```

```tsx
// Trails.tsx
import type { PoseFrame } from '../../types';
export interface TrailsProps { frames: PoseFrame[]; upToIndex: number; length: number; landmarkIndices: number[]; colors?: string[]; }
export function Trails(props: TrailsProps): JSX.Element;
// For each landmark index: take last `length` frames up to upToIndex with pose, map via landmarksToScene,
// build CatmullRomCurve3 -> TubeGeometry(radius 0.012, tapered? plain ok), additive blending, color per joint.
```

```tsx
// AngleArc.tsx
import type { JointId, Landmark } from '../../types';
export function AngleArc({ landmarks, jointId, showLabel }: { landmarks: Landmark[]; jointId: JointId; showLabel?: boolean }): JSX.Element | null;
// Arc (line) at joint b between segments b->a and b->c + degree label via drei <Html>.
// Uses angleAt from ../../lib/math and JOINTS/JOINT_COLORS.
```

```tsx
// ExplodeScene.tsx
import type { PoseFrame } from '../../types';
export interface ExplodeSceneProps {
  frames: PoseFrame[]; inMs: number; outMs: number;
  count: number; spacing: number; collapsed: boolean;
  trailIndices: number[]; selectedTimeMs: number;
  onSelectTime?: (timeMs: number) => void;
}
export function ExplodeScene(props: ExplodeSceneProps): JSX.Element;
// Picks `count` evenly spaced frames in [inMs,outMs]; renders SkeletonModel at z = (i - (count-1)/2) * spacing
// with opacity fading for older poses; trajectory curves (TubeGeometry) connecting trailIndices across poses;
// click a pose -> onSelectTime(timeMs). collapsed=true -> all poses at z=0 (animate via lerp in useFrame).
```

```tsx
// signature-geometry.ts (pure three, no React)
import * as THREE from 'three';
import type { SignatureVector } from '../../types';
/** Builds the abstract signature sculpture. Deterministic from vector. */
export function createSignatureGroup(vector: SignatureVector): THREE.Group;
// Idea: vertical helix ribbon: N=10 rings (one per feature); ring radius = 0.6 + v*1.2,
// twist per ring from values, tube along helix + inner particle points. Elegant, dark-friendly,
// emissive accents (electric/violet/coral). ~600 lines max, keep it tasteful.

// SignatureMesh.tsx
export function SignatureMesh({ vector, animated }: { vector: SignatureVector; animated?: boolean }): JSX.Element;
// <primitive object={useMemo(() => createSignatureGroup(vector), [vector])} /> + slow rotation in useFrame when animated.
```

```tsx
// Overlay2D.tsx — NOT R3F. Absolutely-positioned <canvas> over a <video>.
import type { RefObject } from 'react';
import type { PoseFrame } from '../../types';
export function Overlay2D({ videoRef, frame, width, height }: {
  videoRef: RefObject<HTMLVideoElement | null>;
  frame: PoseFrame | null; width: number; height: number;
}): JSX.Element;
// Draws BONES skeleton in image space scaled to canvas size, joints as dots, electric color.
// Redraws on frame/video size change via useEffect. Canvas styled absolute inset-0 w-full h-full pointer-events-none.
```

## 4. Storage — `src/storage/db.ts`

```ts
import Dexie, { type Table } from 'dexie';
import type { MotionSession } from '../types';
class MotionDnaDb extends Dexie { sessions!: Table<MotionSession, string>; constructor() { super('motion-dna'); this.version(1).stores({ sessions: 'id, createdAt' }); } }
export const db = new MotionDnaDb();
export async function saveSession(s: MotionSession): Promise<void>; // keep max 10 -> delete oldest by createdAt
export async function listSessions(): Promise<MotionSession[]>;
export async function getSession(id: string): Promise<MotionSession | undefined>;
export async function renameSession(id: string, name: string): Promise<void>;
export async function duplicateSession(id: string): Promise<MotionSession>;
export async function deleteSession(id: string): Promise<void>;
export async function clearAllSessions(): Promise<void>;
```
Note: thumbnails can make rows big — store as-is; 10 sessions max is fine.

## 5. Export — `src/lib/export/` (index.ts, scene.ts, session.ts, glb.ts, webm.ts)

```ts
// scene.ts
export function exportScenePNG(): void; // getSceneCanvas() -> toBlob -> download '<name>.png'. No-op if none.
// session.ts
import type { MotionSession } from '../../types';
export function exportSessionJSON(session: MotionSession): void;
export function exportMetricsCSV(session: MotionSession): void; // rows: frame,timestampMs, then per-joint angleDeg columns
// glb.ts
import type { SignatureVector } from '../../types';
export function exportSignatureGLB(vector: SignatureVector, name: string): Promise<void>;
// lazy: const { GLTFExporter } = await import('three/examples/jsm/exporters/GLTFExporter.js');
// build via createSignatureGroup from '../../features/scene-3d/signature-geometry', export binary -> .glb download.
// webm.ts
export function recordSceneWebM(seconds?: number): Promise<void>;
// getSceneCanvas().captureStream(30) + MediaRecorder('video/webm') -> download. Reject when unsupported.
```
All use `downloadBlob` from `../utils`.

## 6. UI core — `src/components/`
Files: TopBar.tsx, ImportPanel.tsx, VideoStage.tsx, Timeline.tsx, ModeDock.tsx, SessionLibrary.tsx, PlaybackDriver.tsx, Notice.tsx.

- **PlaybackDriver.tsx**: no UI. useEffect rAF loop:
  - reads store: playing, speed, inMs, outMs, session.
  - if video element (hasVideo()): ensure video.playbackRate = speed; if playing && video.paused -> video.play().catch; if !playing && !video.paused -> video.pause(). Loop: if video.currentTime*1000 >= outMs -> seek inMs (and keep playing).
  - else (virtual): if playing: advanceVirtual(dtMs * speed); if getTimeMs() >= outMs -> setTimeMs(inMs).
  - Runs always (cheap).
- **VideoStage.tsx**: props { video: VideoMeta }. Renders container relative; <video ref src={video.url} muted playsInline preload="auto" className="w-full h-full object-contain" />; on mount setVideoElement(el), on unmount setVideoElement(null). Overlay drawn by parent (App) via Overlay2D when mode==='overlay'.
- **ImportPanel.tsx**: the start screen. Centered column, max-w. Uses store: setPhase, setProcessing, openSession, setVideo, setNotice, setLiveActive. Flow "choose file":
  1. file = input/drag; validate type video/*; loadVideoFile(file) (from lib/mediapipe) — catch → notice 'errors.videoIncompatible'/'errors.tooLong'.
  2. setPhase('processing'); engine = await createPoseEngine() (loadingModel flag) — catch → notice 'errors.modelFailed', back to start.
  3. frames = await processVideoFrames(video.video, engine, PROCESSING.targetFps, { onProgress throttled → setProcessing({done,total}) }) with AbortController for cancel.
  4. if frames with hasPose < 5 → notice 'errors.noPose', back to start (revoke URL).
  5. metrics = computeMetrics(frames, fps); session = {id: uid('sess'), name: file.name sans ext, source:'video', ...}; thumbnail: capture small dataURL from video (draw to canvas 160px wide) — implement inline.
  6. await saveSession(session); setLibrary(await listSessions()); openSession(session, {url: video.url, ...}); resetProcessing(); setVideoElement handled by VideoStage.
  Demo buttons: generateSyntheticSession(kind) → saveSession → openSession(session, null).
  Camera button: setLiveActive(true).
  Privacy notice block + formats hint + library list (uses SessionLibrary in embedded mode? Simpler: render <SessionLibrary embedded/> — SessionLibrary accepts prop {embedded?: boolean}).
- **Timeline.tsx**: bottom floating bar. Reads session, playing, speed, inMs, outMs. Local rAF (10fps) or interval to update slider position from getTimeMs(). Controls: play/pause (setPlaying), prev/next frame (compute frameIndexAtTime ±1 → setTimeMs(frame.timestampMs); pause), speed select (0.25/0.5/1/2), IN/OUT: two range inputs 0..durationMs (clamp in<out-100), time readout formatTime. Disabled when no session.
- **ModeDock.tsx**: vertical/horizontal dock of view modes with labels (t('modes.x')). Disabled unless session. ghost/difference require compareSession? They just switch mode; ComparePanel handles picking B. signature needs session. Emits setViewMode.
- **TopBar.tsx**: left: APP_NAME + tagline small; center: privacy badge; right: lang toggle (ES/EN buttons), author credit (t('app.credit') + AUTHOR_NAME), buttons: sessions (opens library drawer), new video (resetWorkspace; revoke old video URL).
- **SessionLibrary.tsx**: props { embedded?: boolean; onClose?: () => void }. Lists store.library: thumbnail, name, date, duration, source. Actions per row: open (getSession full → openSession(s, null) — note: library stores FULL sessions incl. frames, so open directly), rename (inline input), duplicate, delete. Footer: clear all (confirm via window.confirm with t('library.clearConfirm')). After each mutation: setLibrary(await listSessions()).
- **Notice.tsx**: fixed bottom toast reading store.notice; auto-dismiss 5s (setNotice(null)); error style.

## 7. UI analysis — `src/components/`
Files: AnalysisPanel.tsx, ComparePanel.tsx, LiveView.tsx, SignaturePanel.tsx, ExportPanel.tsx.

- **AnalysisPanel.tsx**: right floating panel (parent positions). Sections: joints (8 checkboxes w/ JOINT_COLORS dots, t('joint.x')); current angles: for selectedJoints show jointAngles(frameAtTime) degrees; metrics: speed/accel mini bar (current value from speedProfile/accelProfile normalized), symmetry score %, rhythm bpm; trailLength slider (5..120); showLabels checkbox; disclaimer t('analysis.estimated'). Needs current frame → local rAF/interval 10fps reading getTimeMs (cheap, panel-local state).
- **ComparePanel.tsx**: floating panel for ghost/difference modes. Take B <select> from library (excluding A); ghost.opacityB slider; offsetMs slider (-2000..2000); buttons: autoAlign (compute normalizedPoseVector series for A and B, bestOffsetFrames → setGhost({offsetMs: frames*msPerFrame})); normalize checkbox; swap (swap session/compareSession); differenceOnly checkbox (only in difference mode — just bind setGhost). Note text t('compare.note').
- **LiveView.tsx**: full-screen overlay (fixed inset-0 z-50, bg dark). On mount: getUserMedia({video:{width:1280}}); <video> autoplay muted playsinline; engine = await createPoseEngine(); rAF loop ~15fps: detectVideoFrame(videoEl, performance.now()) → setFrame state → Overlay2D draws it. Buttons: capture (record 4s of frames at ~15fps → computeMetrics → session source 'camera' → saveSession → openSession(s,null) → close live), mirror: select reference from library; score = pose similarity: mean over recent frames of exp(-dist(normalizedPoseVector(live), normalizedPoseVector(ref at same phase))) shown as % (t('live.score'), orientative). Stop button: cleanup stream + engine.dispose() + setLiveActive(false). Error → notice 'live.denied'.
- **SignaturePanel.tsx**: floating panel: computeSignatureVector(session) via useMemo; list 10 features with bars; buttons export PNG (exportScenePNG) + GLB (exportSignatureGLB(vector, session.name)).
- **ExportPanel.tsx**: floating panel with 5 buttons: PNG (exportScenePNG), JSON (exportSessionJSON(session)), CSV (exportMetricsCSV(session)), GLB (exportSignatureGLB), WebM (recordSceneWebM, busy state while recording). After each: setNotice(t('export.done')).

## App wiring (done by coordinator, NOT by agents)
App.tsx will compose: phases start/processing/explore; SceneCanvas content per viewMode;
VideoStage + Overlay2D for video/overlay modes; panels per mode; TopBar/Timeline/ModeDock;
LiveView when liveActive; PlaybackDriver always; Analytics from @vercel/analytics.

---

## File ownership (do NOT write outside your module)
- math agent: src/lib/math/** only (+ may ADD keys to src/i18n.ts if needed — avoid)
- pose agent: src/lib/mediapipe/** only
- 3d agent: src/features/scene-3d/** only
- storage/export agent: src/storage/** + src/lib/export/** only
- ui-core agent: src/components/{TopBar,ImportPanel,VideoStage,Timeline,ModeDock,SessionLibrary,PlaybackDriver,Notice}.tsx only
- ui-analysis agent: src/components/{AnalysisPanel,ComparePanel,LiveView,SignaturePanel,ExportPanel}.tsx only
