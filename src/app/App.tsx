import { useEffect, useMemo, useState } from 'react';
import { Analytics } from '@vercel/analytics/react';
import { COLORS } from '../config';
import {
  AnalysisPanel,
  ComparePanel,
  ExportPanel,
  ImportPanel,
  LiveView,
  ModeDock,
  Notice,
  PlaybackDriver,
  SessionLibrary,
  SignaturePanel,
  Timeline,
  TopBar,
  VideoStage,
} from '../components';
import {
  AngleArc,
  ExplodeScene,
  Overlay2D,
  SceneCanvas,
  SignatureMesh,
  SkeletonModel,
  Trails,
} from '../features/scene-3d';
import { useT } from '../i18n';
import { abortProcessing } from '../lib/processing';
import { getTimeMs, getVideoElement, setTimeMs } from '../lib/playhead';
import { DEFAULT_TRAIL_INDICES, JOINTS } from '../lib/joints';
import { listSessions } from '../storage/db';
import { useAppStore } from '../stores/app';
import {
  computeSignatureVector,
  landmarkSpeeds,
  normalizeLandmarks,
} from '../lib/math';
import type { JointId, Landmark, PoseFrame } from '../types';
import { clamp, frameAtTime, frameIndexAtTime } from '../lib/utils';
import { ErrorBoundary } from './ErrorBoundary';

/** Stable empty frames array (avoids re-creating [] every render). */
const NO_FRAMES: PoseFrame[] = [];

/** Re-render at ~30fps while a session is open, driven by the playhead. */
function useNow(active: boolean): number {
  const [now, setNow] = useState(() => getTimeMs());
  useEffect(() => {
    if (!active) return;
    let raf = 0;
    let last = 0;
    const loop = (t: number) => {
      raf = requestAnimationFrame(loop);
      if (t - last > 33) {
        last = t;
        setNow(getTimeMs());
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [active]);
  return now;
}

function normalizeIf(landmarks: Landmark[], enabled: boolean): Landmark[] {
  return enabled ? normalizeLandmarks(landmarks) : landmarks;
}

/** 3D content switched by view mode. Rendered inside SceneCanvas. */
function SceneContent() {
  const session = useAppStore((s) => s.session);
  const compareSession = useAppStore((s) => s.compareSession);
  const viewMode = useAppStore((s) => s.viewMode);
  const video = useAppStore((s) => s.video);
  const inMs = useAppStore((s) => s.inMs);
  const outMs = useAppStore((s) => s.outMs);
  const selectedJoints = useAppStore((s) => s.selectedJoints);
  const trailLength = useAppStore((s) => s.trailLength);
  const showLabels = useAppStore((s) => s.showLabels);
  const explode = useAppStore((s) => s.explode);
  const ghost = useAppStore((s) => s.ghost);
  const setPlaying = useAppStore((s) => s.setPlaying);

  const now = useNow(!!session);
  const frames = session?.frames ?? NO_FRAMES;
  const idx = frames.length > 0 ? frameIndexAtTime(frames, now) : -1;
  const frame = idx >= 0 ? frames[idx] : null;
  const mode = viewMode === 'video' || viewMode === 'overlay' ? (video ? viewMode : 'skeleton') : viewMode;

  const trailIndices = useMemo(
    () => selectedJoints.map((id: JointId) => JOINTS[id].trailIndex),
    [selectedJoints],
  );

  const signature = useMemo(
    () => (session ? computeSignatureVector(session) : null),
    [session],
  );

  const heatValues = useMemo(() => {
    if (mode !== 'heat' || !session || idx < 0) return null;
    const vals = new Array<number>(33).fill(0);
    for (let i = 0; i < 33; i++) {
      const sp = landmarkSpeeds(frames, i);
      vals[i] = sp[idx] ?? 0;
    }
    return vals;
  }, [mode, session, frames, idx]);

  const bFrame =
    compareSession && (mode === 'ghost' || mode === 'difference')
      ? frameAtTime(compareSession.frames, now + ghost.offsetMs)
      : null;

  const divergence = useMemo(() => {
    if (mode !== 'difference' || !frame?.hasPose || !bFrame?.hasPose) return null;
    const a = normalizeLandmarks(frame.landmarks);
    const b = normalizeLandmarks(bFrame.landmarks);
    const vals: number[] = [];
    for (let i = 0; i < 33; i++) {
      const d = Math.hypot(a[i].x - b[i].x, a[i].y - b[i].y, (a[i].z ?? 0) - (b[i].z ?? 0));
      vals.push(clamp(d / 0.6, 0, 1));
    }
    return vals;
  }, [mode, frame, bFrame]);

  const showArcs = (mode === 'skeleton' || mode === 'trails' || mode === 'ghost') && frame?.hasPose;

  return (
    <group>
      {(mode === 'skeleton' || mode === 'trails') && (
        <>
          <SkeletonModel
            landmarks={frame?.landmarks ?? []}
            color={COLORS.electric}
            opacity={mode === 'trails' ? 0.55 : 1}
          />
          {mode === 'trails' && idx >= 0 && (
            <Trails
              frames={frames}
              upToIndex={idx}
              length={trailLength}
              landmarkIndices={trailIndices.length > 0 ? trailIndices : DEFAULT_TRAIL_INDICES}
            />
          )}
        </>
      )}

      {mode === 'heat' && (
        <SkeletonModel landmarks={frame?.landmarks ?? []} heatValues={heatValues} />
      )}

      {mode === 'explode' && session && (
        <ExplodeScene
          frames={frames}
          inMs={inMs}
          outMs={outMs}
          count={explode.count}
          spacing={explode.spacing}
          collapsed={explode.collapsed}
          trailIndices={trailIndices.length > 0 ? trailIndices : DEFAULT_TRAIL_INDICES}
          selectedTimeMs={now}
          onSelectTime={(tms) => {
            setPlaying(false);
            setTimeMs(tms);
          }}
        />
      )}

      {mode === 'ghost' && (
        <>
          <SkeletonModel
            landmarks={frame && frame.hasPose ? normalizeIf(frame.landmarks, ghost.normalized) : []}
            color={COLORS.electric}
            opacity={1}
          />
          {bFrame?.hasPose && (
            <SkeletonModel
              landmarks={normalizeIf(bFrame.landmarks, ghost.normalized)}
              color={COLORS.violet}
              opacity={ghost.opacityB}
            />
          )}
        </>
      )}

      {mode === 'difference' && (
        <>
          <SkeletonModel
            landmarks={frame?.landmarks ?? []}
            color={COLORS.electric}
            opacity={0.25}
          />
          {bFrame?.hasPose && (
            <SkeletonModel
              landmarks={normalizeIf(bFrame.landmarks, ghost.normalized)}
              heatValues={divergence}
              opacity={0.95}
            />
          )}
        </>
      )}

      {mode === 'signature' && signature && <SignatureMesh vector={signature} animated />}

      {showArcs &&
        selectedJoints.map((id) => (
          <AngleArc
            key={id}
            landmarks={frame!.landmarks}
            jointId={id}
            showLabel={showLabels}
          />
        ))}
    </group>
  );
}

/** Small floating bar with EXPLODE TIME controls. */
function ExplodeBar() {
  const { t } = useT();
  const explode = useAppStore((s) => s.explode);
  const setExplode = useAppStore((s) => s.setExplode);
  return (
    <div className="pointer-events-auto absolute bottom-20 left-1/2 z-30 flex -translate-x-1/2 items-center gap-4 rounded-full border border-white/10 bg-[#0a0f1c]/90 px-5 py-2 backdrop-blur">
      <span className="text-[11px] font-bold tracking-[0.2em] text-[#8b5cf6]">
        {t('explode.title')}
      </span>
      <label className="flex items-center gap-2 text-xs text-[#8b98b8]">
        {t('explode.poses')}
        <input
          type="range"
          min={4}
          max={16}
          step={1}
          value={explode.count}
          onChange={(e) => setExplode({ count: Number(e.target.value) })}
          className="w-24"
        />
        <span className="w-6 text-right text-[#e8eefc]">{explode.count}</span>
      </label>
      <label className="flex items-center gap-2 text-xs text-[#8b98b8]">
        {t('explode.spacing')}
        <input
          type="range"
          min={0.4}
          max={3}
          step={0.1}
          value={explode.spacing}
          onChange={(e) => setExplode({ spacing: Number(e.target.value) })}
          className="w-24"
        />
      </label>
      <button
        type="button"
        onClick={() => setExplode({ collapsed: !explode.collapsed })}
        className="rounded-full bg-[#8b5cf6]/20 px-3 py-1 text-xs font-semibold text-[#c4b5fd] hover:bg-[#8b5cf6]/35"
      >
        {explode.collapsed ? t('explode.expand') : t('explode.collapse')}
      </button>
    </div>
  );
}

function ProcessingScreen() {
  const { t } = useT();
  const processing = useAppStore((s) => s.processing);
  const pct =
    processing.total > 0 ? Math.round((processing.done / processing.total) * 100) : 0;
  return (
    <div className="flex h-full flex-col items-center justify-center gap-5 p-6 text-center">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/10 border-t-[#3b82f6]" />
      <h2 className="text-lg font-semibold tracking-wide">{t('processing.title')}</h2>
      {processing.loadingModel && (
        <p className="text-sm text-[#8b98b8]">{t('processing.loadingModel')}</p>
      )}
      <div className="h-2 w-full max-w-md overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#3b82f6] to-[#8b5cf6] transition-[width]"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="font-mono text-sm text-[#8b98b8]">
        {processing.done} / {processing.total} {t('processing.frames')} · {pct}%
      </p>
      <p className="max-w-sm text-xs text-[#8b98b8]/70">{t('processing.tip')}</p>
      <button
        type="button"
        onClick={abortProcessing}
        className="rounded-full border border-white/15 px-5 py-1.5 text-sm text-[#e8eefc] hover:border-[#fb7185]/60 hover:text-[#fb7185]"
      >
        {t('processing.cancel')}
      </button>
    </div>
  );
}

function ExploreView({
  libraryOpen,
  setLibraryOpen,
}: {
  libraryOpen: boolean;
  setLibraryOpen: (v: boolean) => void;
}) {
  const viewMode = useAppStore((s) => s.viewMode);
  const video = useAppStore((s) => s.video);
  const session = useAppStore((s) => s.session);
  const [exportOpen, setExportOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);
  // Always-fresh read-only view of the video element (avoids ref writes during render).
  const videoRef = useMemo(
    () => ({
      get current(): HTMLVideoElement | null {
        return getVideoElement();
      },
    }),
    [],
  );

  const showVideoStage = (viewMode === 'video' || viewMode === 'overlay') && video && session;
  const now = useNow(!!session && !!showVideoStage);
  const overlayFrame = session ? frameAtTime(session.frames, now) : null;

  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* Main stage */}
      <div className="absolute inset-0">
        {showVideoStage ? (
          <div className="relative h-full w-full p-2 pb-24 md:p-6 md:pb-28">
            <VideoStage video={video} />
            {viewMode === 'overlay' && (
              <div className="pointer-events-none absolute inset-2 md:inset-6">
                <Overlay2D
                  videoRef={videoRef}
                  frame={overlayFrame}
                  width={video.width}
                  height={video.height}
                />
              </div>
            )}
          </div>
        ) : (
          <SceneCanvas>
            <SceneContent />
          </SceneCanvas>
        )}
      </div>

      <TopBar onOpenLibrary={() => setLibraryOpen(true)} />
      <ModeDock />
      <Timeline />
      {viewMode === 'explode' && <ExplodeBar />}

      {/* Right floating cluster */}
      <div className="absolute right-3 top-14 z-30 flex flex-col gap-2 md:right-4">
        <button
          type="button"
          onClick={() => setExportOpen((v) => !v)}
          title="Export"
          className={`flex h-10 w-10 items-center justify-center rounded-full border backdrop-blur transition ${
            exportOpen
              ? 'border-[#3b82f6] bg-[#3b82f6]/25 text-white'
              : 'border-white/10 bg-[#0a0f1c]/85 text-[#8b98b8] hover:text-white'
          }`}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M8 2v8m0 0L5 7m3 3l3-3M3 12h10v2H3z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => setPanelOpen((v) => !v)}
          title="Panel"
          className={`flex h-10 w-10 items-center justify-center rounded-full border backdrop-blur transition ${
            panelOpen
              ? 'border-[#3b82f6] bg-[#3b82f6]/25 text-white'
              : 'border-white/10 bg-[#0a0f1c]/85 text-[#8b98b8] hover:text-white'
          }`}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M2 4h12M2 8h12M2 12h7" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Contextual panels */}
      {panelOpen && (viewMode === 'skeleton' || viewMode === 'trails' || viewMode === 'heat' || viewMode === 'overlay') && (
        <div className="absolute bottom-24 right-3 top-14 z-20 hidden w-72 overflow-y-auto rounded-2xl border border-white/10 bg-[#0a0f1c]/90 p-4 backdrop-blur md:block">
          <AnalysisPanel />
        </div>
      )}
      {panelOpen && (viewMode === 'ghost' || viewMode === 'difference') && (
        <div className="absolute bottom-24 right-3 top-14 z-20 w-72 overflow-y-auto rounded-2xl border border-white/10 bg-[#0a0f1c]/90 p-4 backdrop-blur">
          <ComparePanel />
        </div>
      )}
      {panelOpen && viewMode === 'signature' && (
        <div className="absolute bottom-24 right-3 top-14 z-20 w-72 overflow-y-auto rounded-2xl border border-white/10 bg-[#0a0f1c]/90 p-4 backdrop-blur">
          <SignaturePanel />
        </div>
      )}
      {exportOpen && (
        <div className="absolute bottom-24 right-3 top-14 z-20 w-72 overflow-y-auto rounded-2xl border border-white/10 bg-[#0a0f1c]/95 p-4 backdrop-blur">
          <ExportPanel />
        </div>
      )}

      {/* Library drawer */}
      {libraryOpen && (
        <div className="absolute inset-y-0 right-0 z-40 w-80 max-w-[85vw] border-l border-white/10 bg-[#0a0f1c]/98 backdrop-blur">
          <SessionLibrary onClose={() => setLibraryOpen(false)} />
        </div>
      )}
    </div>
  );
}

export default function App() {
  const phase = useAppStore((s) => s.phase);
  const liveActive = useAppStore((s) => s.liveActive);
  const setLibrary = useAppStore((s) => s.setLibrary);
  const setNotice = useAppStore((s) => s.setNotice);
  const { t } = useT();
  const [libraryOpen, setLibraryOpen] = useState(false);

  useEffect(() => {
    listSessions()
      .then(setLibrary)
      .catch(() => undefined);
    try {
      const c = document.createElement('canvas');
      const gl = c.getContext('webgl2') ?? c.getContext('webgl');
      if (!gl) setNotice(t('errors.noWebGL'));
    } catch {
      setNotice(t('errors.noWebGL'));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ErrorBoundary>
      <div className="fixed inset-0 overflow-hidden bg-[#05070d] text-[#e8eefc]">
        <PlaybackDriver />
        {phase === 'start' && <ImportPanel />}
        {phase === 'processing' && <ProcessingScreen />}
        {phase === 'explore' && (
          <ExploreView libraryOpen={libraryOpen} setLibraryOpen={setLibraryOpen} />
        )}
        {liveActive && <LiveView />}
        <Notice />
      </div>
      <Analytics />
    </ErrorBoundary>
  );
}
