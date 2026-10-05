import { useEffect, useMemo, useState } from 'react';
import type { ReactElement } from 'react';
import { useAppStore } from '../stores/app';
import { useT } from '../i18n';
import type { DictKey } from '../i18n';
import type { JointId } from '../types';
import { getTimeMs } from '../lib/playhead';
import { frameAtTime, frameIndexAtTime } from '../lib/utils';
import { jointAngles } from '../lib/math';
import { JOINT_IDS, frameVisibleJoints, sessionTrackedJoints } from '../lib/joints';
import { JOINT_COLORS } from '../config';

const PANEL =
  'shrink-0 rounded-2xl border border-white/10 bg-[#0a0f1c]/90 p-4 text-[#e8eefc] backdrop-blur space-y-4';

function maxOf(arr: number[]): number {
  return arr.reduce((m, v) => (v > m ? v : m), 1e-9);
}

function MetricCell({
  label,
  display,
  pct,
  color,
}: {
  label: string;
  display: string;
  pct: number;
  color: string;
}) {
  return (
    <div className="rounded-lg bg-white/[0.03] px-2 py-1.5">
      <div className="flex items-baseline justify-between gap-1">
        <span className="truncate text-[10px] uppercase tracking-wider text-[#8b98b8]">
          {label}
        </span>
        <span className="shrink-0 whitespace-nowrap font-mono text-xs text-[#e8eefc]">{display}</span>
      </div>
      <div className="mt-1 h-1 overflow-hidden rounded bg-white/10">
        <div
          className="h-full rounded"
          style={{ width: `${Math.min(100, Math.max(0, pct))}%`, background: color }}
        />
      </div>
    </div>
  );
}

export function AnalysisPanel(): ReactElement {
  const { t } = useT();
  const session = useAppStore((s) => s.session);
  const selectedJoints = useAppStore((s) => s.selectedJoints);
  const toggleJoint = useAppStore((s) => s.toggleJoint);
  const trailLength = useAppStore((s) => s.trailLength);
  const setTrailLength = useAppStore((s) => s.setTrailLength);
  const showLabels = useAppStore((s) => s.showLabels);
  const setShowLabels = useAppStore((s) => s.setShowLabels);

  const [now, setNow] = useState(() => getTimeMs());

  useEffect(() => {
    const id = window.setInterval(() => setNow(getTimeMs()), 150);
    return () => window.clearInterval(id);
  }, []);

  const frame = session ? frameAtTime(session.frames, now) : null;
  const frameVis = useMemo(
    () => (frame ? new Set<JointId>(frameVisibleJoints(frame)) : new Set<JointId>()),
    [frame],
  );
  const angles = useMemo(() => jointAngles(frame?.landmarks ?? [], frameVis), [frame, frameVis]);
  const frameIndex = session ? frameIndexAtTime(session.frames, now) : -1;

  /** Joints the session can meaningfully track (visible in enough frames). */
  const trackedJoints = useMemo(
    () => (session ? sessionTrackedJoints(session.frames) : []),
    [session],
  );

  const maxSpeed = useMemo(
    () => (session ? maxOf(session.metrics.speedProfile) : 1),
    [session],
  );
  const maxAccel = useMemo(
    () => (session ? maxOf(session.metrics.accelProfile) : 1),
    [session],
  );

  if (!session) {
    return (
      <aside className={PANEL}>
        <p className="text-sm text-[#8b98b8]">{t('analysis.noSession')}</p>
      </aside>
    );
  }

  const speedNow = session.metrics.speedProfile[frameIndex] ?? 0;
  const accelNow = session.metrics.accelProfile[frameIndex] ?? 0;
  const symmetry = session.metrics.symmetry.score;
  const { bpm, regularity } = session.metrics.rhythm;

  return (
    <aside className={PANEL}>
      <h2 className="text-xs font-semibold uppercase tracking-widest text-[#8b98b8]">
        {t('analysis.title')}
      </h2>

      {/* Joints + live angles in a single compact list (was two stacked lists) */}
      <section>
        <h3 className="mb-1.5 text-[11px] font-medium uppercase tracking-widest text-[#8b98b8]">
          {t('analysis.joints')}
        </h3>
        <ul className="space-y-1">
          {JOINT_IDS.map((id) => {
            const a = angles[id];
            const tracked = trackedJoints.includes(id);
            return (
              <li
                key={id}
                className={`flex items-center gap-2 text-[13px] leading-5 ${tracked ? '' : 'opacity-40'}`}
                title={tracked ? undefined : t('analysis.outOfFrame')}
              >
                <input
                  type="checkbox"
                  checked={selectedJoints.includes(id)}
                  onChange={() => toggleJoint(id)}
                  disabled={!tracked}
                  aria-label={t(('joint.' + id) as DictKey)}
                  className="h-3.5 w-3.5 shrink-0 accent-[#3b82f6] disabled:cursor-not-allowed"
                />
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ background: JOINT_COLORS[id] ?? '#ffffff' }}
                />
                <span className="flex-1 truncate text-[#c6d0e8]">
                  {t(('joint.' + id) as DictKey)}
                </span>
                {tracked ? (
                  <span className="font-mono text-[#e8eefc]">
                    {a != null ? `${Math.round(a)}°` : '—'}
                  </span>
                ) : (
                  <span className="text-[10px] uppercase tracking-wider text-[#8b98b8]">
                    {t('analysis.outOfFrame')}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {/* Metrics as a 2x2 grid instead of a tall stacked list */}
      <section className="grid grid-cols-2 gap-1.5">
        <MetricCell
          label={t('analysis.speed')}
          display={speedNow.toFixed(2)}
          pct={maxSpeed > 0 ? (speedNow / maxSpeed) * 100 : 0}
          color="#3b82f6"
        />
        <MetricCell
          label={t('analysis.accel')}
          display={accelNow.toFixed(2)}
          pct={maxAccel > 0 ? (accelNow / maxAccel) * 100 : 0}
          color="#8b5cf6"
        />
        <MetricCell
          label={t('analysis.symmetry')}
          display={`${Math.round(symmetry * 100)}%`}
          pct={symmetry * 100}
          color="#34d399"
        />
        <MetricCell
          label={t('analysis.rhythm')}
          display={bpm > 0 ? `${bpm} ${t('analysis.bpm')}` : '—'}
          pct={regularity * 100}
          color="#fbbf24"
        />
      </section>

      <section className="space-y-2">
        <div>
          <div className="flex items-baseline justify-between gap-2 text-xs">
            <label htmlFor="trail-length" className="truncate text-[#8b98b8]">
              {t('analysis.trailLength')}
            </label>
            <span className="shrink-0 whitespace-nowrap font-mono text-[#e8eefc]">
              {trailLength} {t('analysis.frames')}
            </span>
          </div>
          <input
            id="trail-length"
            type="range"
            min={5}
            max={120}
            step={5}
            value={trailLength}
            onChange={(e) => setTrailLength(Number(e.target.value))}
            className="mt-0.5 w-full accent-[#3b82f6]"
          />
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-[13px]">
          <input
            type="checkbox"
            checked={showLabels}
            onChange={(e) => setShowLabels(e.target.checked)}
            className="h-3.5 w-3.5 accent-[#3b82f6]"
          />
          {t('analysis.showLabels')}
        </label>
      </section>

      <p className="border-l-2 border-amber-400/50 pl-2 text-[11px] leading-snug text-amber-300/80">
        {t('analysis.estimated')}
      </p>
    </aside>
  );
}
