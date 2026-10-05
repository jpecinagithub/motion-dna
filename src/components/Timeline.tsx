import { useEffect, useState } from 'react';
import { useAppStore } from '../stores/app';
import { useT } from '../i18n';
import { getTimeMs, setTimeMs } from '../lib/playhead';
import { frameIndexAtTime, formatTime, clamp } from '../lib/utils';

const SPEEDS = [0.25, 0.5, 1, 2];

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path d="M8 5.5v13l11-6.5z" fill="currentColor" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <rect x="7" y="5" width="3.5" height="14" rx="1" fill="currentColor" />
      <rect x="13.5" y="5" width="3.5" height="14" rx="1" fill="currentColor" />
    </svg>
  );
}

function PrevIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path d="M11 17l-5-5 5-5" />
      <path d="M18 17l-5-5 5-5" />
    </svg>
  );
}

function NextIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path d="M13 17l5-5-5-5" />
      <path d="M6 17l5-5-5-5" />
    </svg>
  );
}

/** Floating transport bar: play/pause, frame stepping, speed, IN/OUT range, time readout. */
export function Timeline() {
  const { t } = useT();
  const session = useAppStore((s) => s.session);
  const playing = useAppStore((s) => s.playing);
  const speed = useAppStore((s) => s.speed);
  const inMs = useAppStore((s) => s.inMs);
  const outMs = useAppStore((s) => s.outMs);
  const setPlaying = useAppStore((s) => s.setPlaying);
  const setSpeed = useAppStore((s) => s.setSpeed);
  const setInOut = useAppStore((s) => s.setInOut);

  const [now, setNow] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setNow(getTimeMs()), 100);
    return () => window.clearInterval(id);
  }, []);

  if (!session) return null;

  const frames = session.frames;
  const durationMs = session.durationMs;
  const frameIdx = frameIndexAtTime(frames, now);

  const stepFrame = (dir: 1 | -1) => {
    if (frames.length === 0) return;
    const idx = frameIndexAtTime(frames, getTimeMs());
    const next = clamp(idx + dir, 0, frames.length - 1);
    setPlaying(false);
    setTimeMs(frames[next].timestampMs);
  };

  const handleIn = (v: number) => setInOut(clamp(v, 0, outMs - 100), outMs);
  const handleOut = (v: number) => setInOut(inMs, clamp(v, inMs + 100, durationMs));

  const btn =
    'rounded-full p-2 text-[#e8eefc] hover:bg-white/10 disabled:opacity-40 disabled:hover:bg-transparent';

  return (
    <div className="absolute bottom-4 left-1/2 z-30 flex max-w-[96vw] -translate-x-1/2 flex-wrap items-center justify-center gap-x-3 gap-y-2 rounded-full border border-white/10 bg-[#0a0f1c]/90 px-4 py-2 backdrop-blur">
      <div className="flex items-center gap-1">
        <button
          type="button"
          className={btn}
          title={t('timeline.prevFrame')}
          aria-label={t('timeline.prevFrame')}
          onClick={() => stepFrame(-1)}
        >
          <PrevIcon />
        </button>
        <button
          type="button"
          className={`${btn} bg-[#3b82f6] hover:bg-[#3b82f6]/80`}
          title={playing ? t('timeline.pause') : t('timeline.play')}
          aria-label={playing ? t('timeline.pause') : t('timeline.play')}
          onClick={() => setPlaying(!playing)}
        >
          {playing ? <PauseIcon /> : <PlayIcon />}
        </button>
        <button
          type="button"
          className={btn}
          title={t('timeline.nextFrame')}
          aria-label={t('timeline.nextFrame')}
          onClick={() => stepFrame(1)}
        >
          <NextIcon />
        </button>
      </div>

      <label className="flex items-center gap-1.5 text-xs text-[#8b98b8]">
        <span className="sr-only">{t('timeline.speed')}</span>
        <select
          value={String(speed)}
          onChange={(e) => setSpeed(Number(e.target.value))}
          aria-label={t('timeline.speed')}
          title={t('timeline.speed')}
          className="rounded-lg border border-white/10 bg-white/5 px-1.5 py-1 text-[#e8eefc]"
        >
          {SPEEDS.map((s) => (
            <option key={s} value={s} className="bg-[#0a0f1c]">
              {s}x
            </option>
          ))}
        </select>
      </label>

      <div className="flex items-center gap-2" title={t('timeline.range')}>
        <label className="flex items-center gap-1 text-[10px] text-[#8b98b8]">
          <span className="rounded bg-white/10 px-1.5 py-0.5 font-semibold text-[#e8eefc]">
            {t('timeline.in')}
          </span>
          <input
            type="range"
            min={0}
            max={durationMs}
            step={50}
            value={inMs}
            onChange={(e) => handleIn(Number(e.target.value))}
            aria-label={t('timeline.in')}
            className="w-20 accent-[#3b82f6]"
          />
        </label>
        <label className="flex items-center gap-1 text-[10px] text-[#8b98b8]">
          <span className="rounded bg-white/10 px-1.5 py-0.5 font-semibold text-[#e8eefc]">
            {t('timeline.out')}
          </span>
          <input
            type="range"
            min={0}
            max={durationMs}
            step={50}
            value={outMs}
            onChange={(e) => handleOut(Number(e.target.value))}
            aria-label={t('timeline.out')}
            className="w-20 accent-[#fb7185]"
          />
        </label>
      </div>

      <div className="whitespace-nowrap font-mono text-xs text-[#e8eefc]">
        {formatTime(now)}
        <span className="text-[#8b98b8]"> / {formatTime(durationMs)}</span>
        {frames.length > 0 && (
          <span className="ml-2 text-[#8b98b8]">
            f{frameIdx + 1}/{frames.length}
          </span>
        )}
      </div>
    </div>
  );
}
