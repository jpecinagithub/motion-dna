import { useEffect, useRef, useState } from 'react';
import type { DragEvent } from 'react';
import { useAppStore } from '../stores/app';
import { useT } from '../i18n';
import { APP_NAME, PROCESSING } from '../config';
import { uid } from '../lib/utils';
import { resetPlayhead } from '../lib/playhead';
import { setProcessingAborter } from '../lib/processing';
import {
  loadVideoFile,
  createPoseEngine,
  processVideoFrames,
  generateSyntheticSession,
} from '../lib/mediapipe';
import type { SyntheticKind } from '../lib/mediapipe';
import { computeMetrics } from '../lib/math';
import { saveSession, listSessions } from '../storage/db';
import type { MotionSession, PoseFrame } from '../types';
import { SessionLibrary } from './SessionLibrary';

/**
 * Draws a small JPEG thumbnail from the processed video (frame at 25%).
 * Returns undefined on any failure — thumbnails are best-effort.
 */
async function captureVideoThumbnail(
  video: HTMLVideoElement,
  width: number,
  height: number,
): Promise<string | undefined> {
  try {
    const duration = video.duration;
    if (Number.isFinite(duration) && duration > 0.2) {
      video.currentTime = Math.min(duration - 0.05, duration * 0.25);
      await new Promise<void>((resolve) => {
        const to = window.setTimeout(resolve, 1500);
        const onSeeked = () => {
          window.clearTimeout(to);
          video.removeEventListener('seeked', onSeeked);
          resolve();
        };
        video.addEventListener('seeked', onSeeked);
      });
    }
    const w = 192;
    const h = Math.max(1, Math.round((192 * height) / Math.max(1, width)));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;
    ctx.drawImage(video, 0, 0, w, h);
    return canvas.toDataURL('image/jpeg', 0.6);
  } catch {
    return undefined;
  }
}

/** Start screen: file import (browse / drag&drop), camera, synthetic demos, library. */
export function ImportPanel() {
  const { t } = useT();
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // preload the library list so saved sessions show on the start screen
  useEffect(() => {
    listSessions()
      .then((l) => useAppStore.getState().setLibrary(l))
      .catch(() => {
        /* storage unavailable */
      });
  }, []);

  const handleFile = async (file: File) => {
    const st = useAppStore.getState();
    if (st.processing.active) return;
    if (!file.type.startsWith('video/')) {
      st.setNotice(t('errors.videoIncompatible'));
      return;
    }

    // (1) mark processing started
    st.setProcessing({ active: true, loadingModel: false, done: 0, total: 1, error: null });
    st.setNotice(null);

    // (2) load + validate the video file
    let vf;
    try {
      vf = await loadVideoFile(file);
    } catch (e) {
      const msg =
        e instanceof Error && e.message === 'tooLong'
          ? t('errors.tooLong')
          : t('errors.videoIncompatible');
      st.setNotice(msg);
      st.resetProcessing();
      return;
    }

    // (3) create the pose engine (downloads the model on first run)
    st.setPhase('processing');
    st.setProcessing({ loadingModel: true });
    let engine;
    try {
      engine = await createPoseEngine();
    } catch {
      st.setNotice(t('errors.modelFailed'));
      URL.revokeObjectURL(vf.url);
      st.setPhase('start');
      st.resetProcessing();
      return;
    }

    // (4) extract pose frames, abortable via the shared aborter
    // (the App-level processing screen's Cancel button calls abortProcessing())
    const abort = new AbortController();
    setProcessingAborter(abort);
    let frames: PoseFrame[];
    try {
      let lastPct = -1;
      let lastT = 0;
      frames = await processVideoFrames(vf.video, engine, PROCESSING.targetFps, {
        signal: abort.signal,
        onProgress: (done, total) => {
          // throttle store writes: >=1% progress or >=500 ms elapsed
          const nowT = performance.now();
          const pct = total > 0 ? (done / total) * 100 : 0;
          if (pct - lastPct >= 1 || nowT - lastT >= 500 || done >= total) {
            lastPct = pct;
            lastT = nowT;
            useAppStore.getState().setProcessing({ done, total });
          }
        },
      });
    } catch (e) {
      setProcessingAborter(null);
      URL.revokeObjectURL(vf.url);
      st.setPhase('start');
      st.resetProcessing();
      const aborted =
        abort.signal.aborted || (e instanceof DOMException && e.name === 'AbortError');
      // user-cancelled: silent cleanup, no error notice
      if (!aborted) st.setNotice(t('errors.generic'));
      return;
    }

    try {
      await engine.dispose();
    } catch {
      /* ignore dispose errors */
    }

    // (5) need a minimum of usable pose frames
    const poseCount = frames.filter((f) => f.hasPose).length;
    if (poseCount < 5) {
      setProcessingAborter(null);
      st.setNotice(t('errors.noPose'));
      URL.revokeObjectURL(vf.url);
      st.setPhase('start');
      st.resetProcessing();
      return;
    }

    // (6+7) metrics, thumbnail, session, persist, open
    try {
      const metrics = computeMetrics(frames, PROCESSING.targetFps);
      const thumbnail = await captureVideoThumbnail(vf.video, vf.width, vf.height);
      const session: MotionSession = {
        id: uid('sess'),
        name: file.name.replace(/\.[^.]+$/, '') || file.name,
        source: 'video',
        durationMs: vf.durationMs,
        fpsProcessed: PROCESSING.targetFps,
        frames,
        metrics,
        createdAt: new Date().toISOString(),
        thumbnail,
      };
      await saveSession(session);
      st.setLibrary(await listSessions());
      st.openSession(session, {
        url: vf.url,
        name: vf.name,
        durationMs: vf.durationMs,
        width: vf.width,
        height: vf.height,
      });
      // NOTE: vf.url is intentionally NOT revoked — VideoStage plays it.
    } catch {
      URL.revokeObjectURL(vf.url);
      st.setNotice(t('errors.generic'));
      st.setPhase('start');
    } finally {
      setProcessingAborter(null);
      st.resetProcessing();
      resetPlayhead();
    }
  };

  const handleDemo = async (kind: SyntheticKind) => {
    const st = useAppStore.getState();
    if (st.processing.active) return;
    try {
      const session = generateSyntheticSession(kind);
      await saveSession(session);
      st.setLibrary(await listSessions());
      st.openSession(session, null);
      resetPlayhead();
    } catch {
      st.setNotice(t('errors.generic'));
    }
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) void handleFile(f);
  };

  const openCamera = () => useAppStore.getState().setLiveActive(true);

  const demos: Array<{ kind: SyntheticKind; label: string }> = [
    { kind: 'jump', label: t('start.demoJump') },
    { kind: 'squat', label: t('start.demoSquat') },
    { kind: 'dance', label: t('start.demoDance') },
  ];

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#05070d] px-4 py-12 text-[#e8eefc]">
      <h1 className="text-4xl font-bold tracking-[0.2em] md:text-5xl">{t('start.title') || APP_NAME}</h1>
      <p className="mt-3 max-w-md text-center text-sm text-[#8b98b8]">{t('start.subtitle')}</p>

      {/* drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`mt-10 flex w-full max-w-2xl flex-col items-center rounded-2xl border-2 border-dashed px-6 py-12 transition-colors ${
          dragging
            ? 'border-[#3b82f6] bg-[#3b82f6]/10'
            : 'border-white/15 bg-[#0a0f1c]/60'
        }`}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`h-10 w-10 ${dragging ? 'text-[#3b82f6]' : 'text-[#8b98b8]'}`}
          aria-hidden="true"
        >
          <path d="M12 16V6m0 0l-4 4m4-4l4 4" />
          <path d="M4 17v2a1.5 1.5 0 001.5 1.5h13A1.5 1.5 0 0020 19v-2" />
        </svg>
        <p className="mt-4 text-lg font-medium">{t('start.drop')}</p>
        <p className="mt-1 text-xs text-[#8b98b8]">{t('start.dropOr')}</p>
        <input
          ref={inputRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) void handleFile(f);
          }}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="mt-4 rounded-full bg-[#3b82f6] px-6 py-2 text-sm font-semibold text-white hover:bg-[#3b82f6]/80"
        >
          {t('start.browse')}
        </button>
        <p className="mt-4 text-xs text-[#8b98b8]">{t('start.formats')}</p>
      </div>

      {/* camera + demos */}
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={openCamera}
          className="flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-5 py-2 text-sm text-[#e8eefc] hover:border-white/30 hover:bg-white/10"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4"
            aria-hidden="true"
          >
            <rect x="3" y="7" width="13" height="11" rx="2" />
            <path d="M16 10.5l5-2.5v8l-5-2.5" />
          </svg>
          {t('start.camera')}
        </button>
        <span className="text-xs text-[#8b98b8]">{t('start.demo')}:</span>
        {demos.map((d) => (
          <button
            key={d.kind}
            type="button"
            onClick={() => void handleDemo(d.kind)}
            className="rounded-full border border-[#8b5cf6]/40 bg-[#8b5cf6]/10 px-4 py-2 text-sm text-[#e8eefc] hover:bg-[#8b5cf6]/20"
          >
            {d.label}
          </button>
        ))}
      </div>

      {/* privacy notice */}
      <div className="mt-10 flex w-full max-w-2xl gap-3 rounded-2xl border border-white/10 bg-[#0a0f1c]/90 p-4">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="#34d399"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-6 w-6 shrink-0"
          aria-hidden="true"
        >
          <rect x="5" y="11" width="14" height="9" rx="2" />
          <path d="M8 11V8a4 4 0 018 0v3" />
        </svg>
        <div>
          <p className="text-sm font-semibold">{t('start.privacyTitle')}</p>
          <p className="mt-1 text-xs leading-relaxed text-[#8b98b8]">{t('start.privacyBody')}</p>
        </div>
      </div>

      <SessionLibrary embedded />
    </div>
  );
}
