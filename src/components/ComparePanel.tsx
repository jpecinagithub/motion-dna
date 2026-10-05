import { useAppStore } from '../stores/app';
import type { ReactElement } from 'react';
import { useT } from '../i18n';
import { bestOffsetFrames, normalizedPoseVector } from '../lib/math';

const PANEL =
  'w-72 shrink-0 rounded-2xl border border-white/10 bg-[#0a0f1c]/90 p-4 text-[#e8eefc] backdrop-blur space-y-4';

const SELECT =
  'w-full rounded-lg border border-white/10 bg-[#0a0f1c] px-2 py-1.5 text-sm text-[#e8eefc]';

const BTN =
  'w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-[#e8eefc] transition-colors hover:bg-white/10 disabled:pointer-events-none disabled:opacity-40';

export function ComparePanel(): ReactElement {
  const { t } = useT();
  const session = useAppStore((s) => s.session);
  const compareSession = useAppStore((s) => s.compareSession);
  const setCompareSession = useAppStore((s) => s.setCompareSession);
  const setSession = useAppStore((s) => s.setSession);
  const library = useAppStore((s) => s.library);
  const ghost = useAppStore((s) => s.ghost);
  const setGhost = useAppStore((s) => s.setGhost);
  const setNotice = useAppStore((s) => s.setNotice);

  if (!session) {
    return (
      <aside className={PANEL}>
        <p className="text-sm text-[#8b98b8]">{t('analysis.noSession')}</p>
      </aside>
    );
  }

  const options = library.filter((s) => s.id !== session.id);

  const autoAlign = () => {
    if (!compareSession) return;
    const a = session.frames
      .filter((f) => f.hasPose)
      .map((f) => normalizedPoseVector(f.landmarks));
    const b = compareSession.frames
      .filter((f) => f.hasPose)
      .map((f) => normalizedPoseVector(f.landmarks));
    if (a.length < 2 || b.length < 2) {
      setNotice(t('errors.generic'));
      return;
    }
    const shift = bestOffsetFrames(a, b);
    const msPerFrame = 1000 / session.fpsProcessed;
    setGhost({ offsetMs: Math.round(shift * msPerFrame) });
    setNotice(t('compare.aligned'));
  };

  const swap = () => {
    if (!compareSession) return;
    setSession(compareSession);
    setCompareSession(session);
  };

  return (
    <aside className={PANEL}>
      <h2 className="text-xs font-semibold uppercase tracking-widest text-[#8b98b8]">
        {t('compare.title')}
      </h2>

      <select
        value={compareSession?.id ?? ''}
        onChange={(e) => {
          const found = library.find((s) => s.id === e.target.value) ?? null;
          setCompareSession(found);
        }}
        className={SELECT}
        aria-label={t('compare.pickB')}
      >
        <option value="">{t('compare.pickB')}</option>
        {options.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>

      {!compareSession ? (
        <p className="text-sm text-[#8b98b8]">{t('compare.none')}</p>
      ) : (
        <>
          <div>
            <div className="flex items-baseline justify-between text-xs">
              <label htmlFor="ghost-opacity" className="text-[#8b98b8]">
                {t('compare.opacityB')}
              </label>
              <span className="font-mono text-[#e8eefc]">
                {Math.round(ghost.opacityB * 100)}%
              </span>
            </div>
            <input
              id="ghost-opacity"
              type="range"
              min={0.05}
              max={1}
              step={0.05}
              value={ghost.opacityB}
              onChange={(e) => setGhost({ opacityB: Number(e.target.value) })}
              className="mt-1 w-full accent-[#3b82f6]"
            />
          </div>

          <div>
            <div className="flex items-baseline justify-between text-xs">
              <label htmlFor="ghost-offset" className="text-[#8b98b8]">
                {t('compare.offset')}
              </label>
              <span className="font-mono text-[#e8eefc]">{ghost.offsetMs} ms</span>
            </div>
            <input
              id="ghost-offset"
              type="range"
              min={-2000}
              max={2000}
              step={50}
              value={ghost.offsetMs}
              onChange={(e) => setGhost({ offsetMs: Number(e.target.value) })}
              className="mt-1 w-full accent-[#3b82f6]"
            />
          </div>

          <button type="button" onClick={autoAlign} className={BTN}>
            {t('compare.autoAlign')}
          </button>

          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={ghost.normalized}
              onChange={(e) => setGhost({ normalized: e.target.checked })}
              className="h-3.5 w-3.5 accent-[#3b82f6]"
            />
            {t('compare.normalize')}
          </label>

          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={ghost.differenceOnly}
              onChange={(e) => setGhost({ differenceOnly: e.target.checked })}
              className="h-3.5 w-3.5 accent-[#3b82f6]"
            />
            {t('compare.difference')}
          </label>

          <button type="button" onClick={swap} className={BTN}>
            {t('compare.swap')}
          </button>
        </>
      )}

      <p className="border-l-2 border-amber-400/50 pl-2 text-xs leading-relaxed text-amber-300/80">
        {t('compare.note')}
      </p>
    </aside>
  );
}
