import { useEffect, useMemo, useState } from 'react';
import type { ReactElement } from 'react';
import { useAppStore } from '../stores/app';
import { useT } from '../i18n';
import type { DictKey } from '../i18n';
import { getTimeMs } from '../lib/playhead';
import { frameAtTime, frameIndexAtTime } from '../lib/utils';
import { jointAngles } from '../lib/math';
import { JOINT_IDS } from '../lib/joints';
import { JOINT_COLORS } from '../config';

const PANEL =
  'w-72 shrink-0 rounded-2xl border border-white/10 bg-[#0a0f1c]/90 p-4 text-[#e8eefc] backdrop-blur space-y-5';

function maxOf(arr: number[]): number {
  return arr.reduce((m, v) => (v > m ? v : m), 1e-9);
}

function MetricRow({
  label,
  value,
  max,
  display,
  color,
}: {
  label: string;
  value: number;
  max: number;
  display: string;
  color: string;
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between text-xs">
        <span className="text-[#8b98b8]">{label}</span>
        <span className="font-mono text-[#e8eefc]">{display}</span>
      </div>
      <div className="mt-1 h-1 overflow-hidden rounded bg-white/10">
        <div className="h-full rounded" style={{ width: `${pct}%`, background: color }} />
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
  const angles = useMemo(() => jointAngles(frame?.landmarks ?? []), [frame]);
  const frameIndex = session ? frameIndexAtTime(session.frames, now) : -1;

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

      <section>
        <h3 className="mb-2 text-[11px] font-medium uppercase tracking-widest text-[#8b98b8]">
          {t('analysis.joints')}
        </h3>
        <ul className="space-y-1.5">
          {JOINT_IDS.map((id) => (
            <li key={id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={selectedJoints.includes(id)}
                onChange={() => toggleJoint(id)}
                aria-label={t(('joint.' + id) as DictKey)}
                className="h-3.5 w-3.5 accent-[#3b82f6]"
              />
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: JOINT_COLORS[id] ?? '#ffffff' }}
              />
              <span className="flex-1">{t(('joint.' + id) as DictKey)}</span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3 className="mb-2 text-[11px] font-medium uppercase tracking-widest text-[#8b98b8]">
          {t('analysis.angles')}
        </h3>
        <ul className="space-y-1.5">
          {JOINT_IDS.map((id) => {
            const a = angles[id];
            return (
              <li key={id} className="flex items-center gap-2 text-sm">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ background: JOINT_COLORS[id] ?? '#ffffff' }}
                />
                <span className="flex-1 text-[#8b98b8]">{t(('joint.' + id) as DictKey)}</span>
                <span className="font-mono text-[#e8eefc]">
                  {a != null ? `${Math.round(a)}°` : '—'}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="space-y-3">
        <MetricRow
          label={t('analysis.speed')}
          value={speedNow}
          max={maxSpeed}
          display={speedNow.toFixed(2)}
          color="#3b82f6"
        />
        <MetricRow
          label={t('analysis.accel')}
          value={accelNow}
          max={maxAccel}
          display={accelNow.toFixed(2)}
          color="#8b5cf6"
        />
        <MetricRow
          label={t('analysis.symmetry')}
          value={symmetry}
          max={1}
          display={`${Math.round(symmetry * 100)}%`}
          color="#34d399"
        />
        <MetricRow
          label={t('analysis.rhythm')}
          value={regularity}
          max={1}
          display={bpm > 0 ? `${bpm} ${t('analysis.bpm')}` : '—'}
          color="#fbbf24"
        />
      </section>

      <section className="space-y-3">
        <div>
          <div className="flex items-baseline justify-between text-xs">
            <label htmlFor="trail-length" className="text-[#8b98b8]">
              {t('analysis.trailLength')}
            </label>
            <span className="font-mono text-[#e8eefc]">
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
            className="mt-1 w-full accent-[#3b82f6]"
          />
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={showLabels}
            onChange={(e) => setShowLabels(e.target.checked)}
            className="h-3.5 w-3.5 accent-[#3b82f6]"
          />
          {t('analysis.showLabels')}
        </label>
      </section>

      <p className="border-l-2 border-amber-400/50 pl-2 text-xs leading-relaxed text-amber-300/80">
        {t('analysis.estimated')}
      </p>
    </aside>
  );
}
