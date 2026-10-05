# MOTION//DNA

**Upload a video. See the movement hidden inside it.**

MOTION//DNA is an experimental web app that turns human movement on video into an
interactive, analyzable 3D representation. Upload a clip (or use your camera), and the
app detects body pose frame-by-frame with MediaPipe, then lets you explore the motion
as a 3D skeleton, trajectory trails, an "Explode Time" sculpture, a comparison ghost
and an abstract Motion Signature.

Everything runs **locally in the browser** — video never leaves the device.

---

## Stack

| Layer      | Tech |
|------------|------|
| Frontend   | Vite + React 19 + TypeScript (strict) |
| 3D         | three.js + @react-three/fiber + @react-three/drei |
| Pose       | MediaPipe Pose Landmarker (`@mediapipe/tasks-vision`, lazy-loaded) |
| State      | zustand |
| Storage    | IndexedDB via Dexie (last 10 sessions) |
| PWA        | vite-plugin-pwa (manifest, icons, service worker, offline model cache) |
| Analytics  | @vercel/analytics |
| Styles     | Tailwind CSS v4 |
| Tests      | vitest |

No backend database, no LLM, no accounts.

## Quick start

```bash
npm install
npm run dev        # → http://localhost:5173
npm test           # vitest (math: angles, smoothing, normalization, DTW)
npm run build      # tsc -b && vite build
```

### Try the full flow without any files

On the start screen, **"Probar con demo sintética"** generates procedural landmark
sequences (vertical jump, squat, dance) so you can walk the whole pipeline —
process → explore 3D → Explode Time → signature → export — with zero uploads.

## Architecture

```
src/
  app/            App shell, screens (start / processing / explore), ErrorBoundary
  components/     UI: ImportPanel, Timeline, ModeDock, panels, LiveView, …
  features/
    scene-3d/     R3F 3D: SceneCanvas, SkeletonModel, Trails, AngleArc,
                  ExplodeScene, SignatureMesh (+ pure-three signature-geometry)
  lib/
    math/         vec, angles, smoothing, normalize, dtw, metrics   ← pure, tested
    mediapipe/    PoseEngine interface + MediaPipe adapter (lazy),
                  video frame processor, synthetic demo generator
    export/       PNG / JSON / CSV / GLB / WebM exporters
    playhead.ts   single source of playback time (video or virtual clock)
    joints.ts     MediaPipe-33 topology: bones, joint definitions
  stores/         zustand app store (UI + session state; no heavy math inside)
  storage/        Dexie IndexedDB wrapper (10 sessions max)
  types/          Landmark, PoseFrame, MotionSession, MotionMetrics, …
  i18n            ES/EN dictionary (no i18n framework)
api/
  health.ts       minimal serverless health/version endpoint
```

**Separation of concerns:** pose extraction → `lib/mediapipe`, math → `lib/math`,
state → `stores`, rendering → `features/scene-3d`. React components never do heavy
computation; the pose engine sits behind an interface so it can be swapped later.

### Key technical decisions

- **Pose processing is main-thread, chunked and throttled (~20 fps analysis).**
  The video is seeked sequentially; each frame yields to the event loop so the UI
  stays responsive, with real `done/total` progress and a live skeleton preview.
  The `PoseEngine` interface keeps the door open for a Web Worker implementation.
- **MediaPipe is lazy-loaded** (dynamic import + model fetch on first use only),
  keeping the initial bundle small. The model/WASM are cached by the service worker.
- **Spatial metrics are relative/estimated.** Without real-world calibration the app
  labels speeds, accelerations and symmetry as orientative — never clinical.
- **Sessions persist locally** (landmarks + metrics + thumbnail, max 10). The
  original video is *not* stored — only an object URL for the current visit.
- **Exports:** PNG (WebGL canvas snapshot), JSON (landmarks+metrics), CSV
  (per-frame joint angles), GLB (signature sculpture via lazy GLTFExporter),
  WebM (MediaRecorder of the canvas). MP4/ffmpeg is deliberately deferred.

## Deployment (Vercel)

```bash
npm run build
vercel --prod
```

`vercel.json` is minimal; `api/health.ts` is a plain serverless function.
No environment variables are required.

## Project status / known limitations

- Live Mode pose runs on the main thread at ~15 fps; fine on desktop, heavier on old phones.
- `three` line rendering is 1px — trails use tubes for the "light" feel.
- iOS Safari: `captureStream` for WebM export may be unavailable; the UI reports it.
- Author credit is the `AUTHOR_NAME` constant in `src/config.ts` (placeholder:
  "MOTION//DNA Lab") — the real name gets added later.

---

por **MOTION//DNA Lab**
