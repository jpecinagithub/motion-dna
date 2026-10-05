import { useEffect, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { useAppStore } from '../stores/app';
import { useT } from '../i18n';
import { Overlay2D } from '../features/scene-3d';
import { computeMetrics, normalizedPoseVector } from '../lib/math';
import { saveSession, listSessions } from '../storage/db';
import { uid } from '../lib/utils';
import type { MotionSession, PoseFrame } from '../types';
import type { PoseEngine } from '../lib/mediapipe';

const CAPTURE_FPS = 15;
const CAPTURE_MS = 4000;
const MIRROR_HISTORY = 20;

export function LiveView(): ReactElement {
  const { t } = useT();
  const library = useAppStore((s) => s.library);
  const setLibrary = useAppStore((s) => s.setLibrary);
  const openSession = useAppStore((s) => s.openSession);
  const setNotice = useAppStore((s) => s.setNotice);
  const setLiveActive = useAppStore((s) => s.setLiveActive);

  const [frame, setFrame] = useState<PoseFrame | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mirrorId, setMirrorId] = useState('');
  const [score, setScore] = useState<number | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const engineRef = useRef<PoseEngine | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectingRef = useRef(false);
  const capturingRef = useRef(false);
  const captureRef = useRef<PoseFrame[]>([]);
  const captureT0Ref = useRef(0);
  const historyRef = useRef<PoseFrame[]>([]);
  const mirrorSessionRef = useRef<MotionSession | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  const mirrorSession = mirrorId ? (library.find((s) => s.id === mirrorId) ?? null) : null;

  useEffect(() => {
    mirrorSessionRef.current = mirrorSession;
    historyRef.current = [];
    setScore(null);
  }, [mirrorSession]);

  useEffect(() => {
    let cancelled = false;
    let intervalId = 0;

    const cleanup = () => {
      cancelled = true;
      if (intervalId) window.clearInterval(intervalId);
      const engine = engineRef.current;
      engineRef.current = null;
      if (engine) engine.dispose().catch(() => undefined);
      const stream = streamRef.current;
      streamRef.current = null;
      if (stream) stream.getTracks().forEach((track) => track.stop());
    };
    cleanupRef.current = cleanup;

    const tick = async () => {
      const engine = engineRef.current;
      const video = videoRef.current;
      if (cancelled || !engine || !video || detectingRef.current) return;
      if (video.readyState < 2) return;
      detectingRef.current = true;
      try {
        const f = await engine.detectVideoFrame(video, performance.now());
        if (cancelled) return;
        if (!f || !f.hasPose) return;
        setFrame(f);
        if (capturingRef.current) {
          captureRef.current.push({
            ...f,
            timestampMs: performance.now() - captureT0Ref.current,
          });
        }
        const hist = historyRef.current;
        hist.push(f);
        if (hist.length > MIRROR_HISTORY) hist.shift();
        const mirror = mirrorSessionRef.current;
        if (mirror) {
          const refFrames = mirror.frames.filter((rf) => rf.hasPose);
          if (refFrames.length > 0) {
            let sum = 0;
            for (let k = 0; k < hist.length; k++) {
              const v1 = normalizedPoseVector(hist[k].landmarks);
              const v2 = normalizedPoseVector(
                refFrames[k % refFrames.length].landmarks,
              );
              const n = Math.min(v1.length, v2.length);
              let d = 0;
              for (let i = 0; i < n; i++) d += Math.abs(v1[i] - v2[i]);
              d /= n > 0 ? n : 1;
              sum += Math.exp(-d);
            }
            setScore(sum / hist.length);
          }
        } else {
          setScore(null);
        }
      } catch {
        /* per-frame detection failures are ignored */
      } finally {
        detectingRef.current = false;
      }
    };

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        video.srcObject = stream;
        await video.play();
        const { createPoseEngine } = await import('../lib/mediapipe');
        const engine = await createPoseEngine();
        if (cancelled) {
          await engine.dispose().catch(() => undefined);
          return;
        }
        engineRef.current = engine;
        intervalId = window.setInterval(() => {
          void tick();
        }, 66);
      } catch {
        if (!cancelled) setError(t('live.denied'));
      }
    })();

    return cleanup;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finishCapture = async () => {
    capturingRef.current = false;
    setCapturing(false);
    const frames = captureRef.current;
    if (frames.length < 5) {
      setNotice(t('errors.noPose'));
      return;
    }
    try {
      const metrics = computeMetrics(frames, CAPTURE_FPS);
      const session: MotionSession = {
        id: uid('sess'),
        name: `Live ${new Date().toLocaleTimeString()}`,
        source: 'camera',
        durationMs: frames[frames.length - 1].timestampMs,
        fpsProcessed: CAPTURE_FPS,
        frames,
        metrics,
        createdAt: new Date().toISOString(),
        thumbnail: undefined,
      };
      await saveSession(session);
      setLibrary(await listSessions());
      openSession(session, null);
      setLiveActive(false);
    } catch {
      setNotice(t('errors.generic'));
    }
  };

  const startCapture = () => {
    captureRef.current = [];
    captureT0Ref.current = performance.now();
    capturingRef.current = true;
    setCapturing(true);
    window.setTimeout(() => {
      void finishCapture();
    }, CAPTURE_MS);
  };

  const stop = () => {
    cleanupRef.current?.();
    setLiveActive(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#05070d] text-[#e8eefc]">
      <header className="flex flex-wrap items-center gap-3 border-b border-white/10 px-4 py-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-[#8b98b8]">
          {t('live.title')}
        </h2>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <label htmlFor="mirror-ref" className="text-xs text-[#8b98b8]">
            {t('live.mirrorRef')}
          </label>
          <select
            id="mirror-ref"
            value={mirrorId}
            onChange={(e) => setMirrorId(e.target.value)}
            className="rounded-lg border border-white/10 bg-[#0a0f1c] px-2 py-1.5 text-sm text-[#e8eefc]"
          >
            <option value="">{t('live.mirrorNone')}</option>
            {library.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          {mirrorId && score != null && (
            <span className="font-mono text-sm text-[#34d399]">
              {t('live.score')}: {Math.round(score * 100)}%
            </span>
          )}
          <button
            type="button"
            onClick={startCapture}
            disabled={capturing || !!error}
            className="rounded-lg border border-[#3b82f6]/40 bg-[#3b82f6]/15 px-3 py-1.5 text-sm text-[#e8eefc] transition-colors hover:bg-[#3b82f6]/25 disabled:pointer-events-none disabled:opacity-40"
          >
            {capturing ? t('live.capturing') : t('live.capture')}
          </button>
          <button
            type="button"
            onClick={stop}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-[#e8eefc] transition-colors hover:bg-white/10"
          >
            {t('live.stop')}
          </button>
        </div>
      </header>

      <div className="relative min-h-0 flex-1 overflow-hidden">
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="absolute inset-0 h-full w-full scale-x-[-1] object-contain"
        />
        <Overlay2D videoRef={videoRef} frame={frame} width={1280} height={720} />
        {capturing && (
          <div className="absolute right-4 top-4 flex items-center gap-2 rounded-full border border-white/10 bg-[#0a0f1c]/80 px-3 py-1.5 text-xs">
            <span className="h-2 w-2 animate-pulse rounded-full bg-[#fb7185]" />
            {t('live.capturing')}
          </div>
        )}
        {error && (
          <div className="absolute inset-x-0 top-1/3 mx-auto w-fit max-w-md rounded-xl border border-[#fb7185]/30 bg-[#0a0f1c]/95 px-6 py-4 text-center text-sm text-[#fb7185]">
            {error}
          </div>
        )}
      </div>

      <p className="border-t border-white/10 px-4 py-2 text-xs text-[#8b98b8]">{t('live.hint')}</p>
    </div>
  );
}
