import { useState } from 'react';
import type { ReactElement } from 'react';
import { useAppStore } from '../stores/app';
import { useT } from '../i18n';
import { computeSignatureVector } from '../lib/math';
import {
  exportScenePNG,
  exportSessionJSON,
  exportMetricsCSV,
  exportSignatureGLB,
  recordSceneWebM,
} from '../lib/export';

const PANEL =
  'w-72 shrink-0 rounded-2xl border border-white/10 bg-[#0a0f1c]/90 p-4 text-[#e8eefc] backdrop-blur space-y-3';

const BTN =
  'w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-left text-sm text-[#e8eefc] transition-colors hover:bg-white/10 disabled:pointer-events-none disabled:opacity-40';

export function ExportPanel(): ReactElement {
  const { t } = useT();
  const session = useAppStore((s) => s.session);
  const setNotice = useAppStore((s) => s.setNotice);
  const [recording, setRecording] = useState(false);

  const run = async (fn: () => void | Promise<void>) => {
    try {
      await fn();
      setNotice(t('export.done'));
    } catch {
      setNotice(t('errors.generic'));
    }
  };

  const onPng = () => {
    void run(() => exportScenePNG());
  };
  const onJson = () => {
    if (!session) return;
    void run(() => exportSessionJSON(session));
  };
  const onCsv = () => {
    if (!session) return;
    void run(() => exportMetricsCSV(session));
  };
  const onGlb = () => {
    if (!session) return;
    void run(() => exportSignatureGLB(computeSignatureVector(session), session.name));
  };
  const onWebm = async () => {
    if (!session || recording) return;
    setRecording(true);
    try {
      await recordSceneWebM(5);
      setNotice(t('export.done'));
    } catch {
      setNotice(t('errors.generic'));
    } finally {
      setRecording(false);
    }
  };

  return (
    <aside className={PANEL}>
      <h2 className="text-xs font-semibold uppercase tracking-widest text-[#8b98b8]">
        {t('export.title')}
      </h2>

      <button type="button" onClick={onPng} disabled={!session} className={BTN}>
        {t('export.png')}
      </button>
      <button type="button" onClick={onJson} disabled={!session} className={BTN}>
        {t('export.json')}
      </button>
      <button type="button" onClick={onCsv} disabled={!session} className={BTN}>
        {t('export.csv')}
      </button>
      <button type="button" onClick={onGlb} disabled={!session} className={BTN}>
        {t('export.glb')}
      </button>
      <button type="button" onClick={onWebm} disabled={!session || recording} className={BTN}>
        {recording ? t('export.recording') : t('export.webm')}
      </button>

      {!session && <p className="text-xs text-[#8b98b8]">{t('analysis.noSession')}</p>}
    </aside>
  );
}
