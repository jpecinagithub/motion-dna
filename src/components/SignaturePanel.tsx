import { useMemo, useState } from 'react';
import type { ReactElement } from 'react';
import { useAppStore } from '../stores/app';
import { useT } from '../i18n';
import { computeSignatureVector } from '../lib/math';
import { exportScenePNG, exportSignatureGLB } from '../lib/export';

const PANEL =
  'w-72 shrink-0 rounded-2xl border border-white/10 bg-[#0a0f1c]/90 p-4 text-[#e8eefc] backdrop-blur space-y-4';

const BTN =
  'w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-[#e8eefc] transition-colors hover:bg-white/10 disabled:pointer-events-none disabled:opacity-40';

export function SignaturePanel(): ReactElement {
  const { t } = useT();
  const session = useAppStore((s) => s.session);
  const setNotice = useAppStore((s) => s.setNotice);
  const [busy, setBusy] = useState(false);

  const vector = useMemo(
    () => (session ? computeSignatureVector(session) : null),
    [session],
  );

  const exportPng = () => {
    exportScenePNG();
    setNotice(t('export.done'));
  };

  const exportGlb = async () => {
    if (!vector || !session || busy) return;
    setBusy(true);
    try {
      await exportSignatureGLB(vector, session.name);
      setNotice(t('export.done'));
    } catch {
      setNotice(t('errors.generic'));
    } finally {
      setBusy(false);
    }
  };

  if (!session || !vector) {
    return (
      <aside className={PANEL}>
        <p className="text-sm text-[#8b98b8]">{t('analysis.noSession')}</p>
      </aside>
    );
  }

  return (
    <aside className={PANEL}>
      <h2 className="text-xs font-semibold uppercase tracking-widest text-[#8b98b8]">
        {t('signature.title')}
      </h2>

      <ul className="space-y-2">
        {vector.values.map((v, i) => {
          const label = vector.labels[i] ?? `f${i + 1}`;
          const pct = Math.round(Math.min(1, Math.max(0, v)) * 100);
          return (
            <li key={label}>
              <div className="flex items-baseline justify-between text-xs">
                <span className="text-[#8b98b8]">{label}</span>
                <span className="font-mono text-[#e8eefc]">{pct}</span>
              </div>
              <div className="mt-1 h-1 overflow-hidden rounded bg-white/10">
                <div
                  className="h-full rounded bg-gradient-to-r from-[#3b82f6] via-[#8b5cf6] to-[#fb7185]"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>

      <div className="space-y-2">
        <button type="button" onClick={exportPng} className={BTN}>
          {t('signature.exportPng')}
        </button>
        <button type="button" onClick={exportGlb} disabled={busy} className={BTN}>
          {busy ? t('common.loading') : t('signature.exportGlb')}
        </button>
      </div>

      <p className="text-xs leading-relaxed text-[#8b98b8]">{t('signature.hint')}</p>
    </aside>
  );
}
