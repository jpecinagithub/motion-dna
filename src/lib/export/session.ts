/**
 * Session data exports: full JSON dump + per-frame metrics CSV.
 */
import { JOINT_IDS } from '../joints';
import type { MotionSession } from '../../types';
import { downloadBlob } from '../utils';

function safeName(name: string): string {
  return name.replace(/[^\w-]+/g, '_');
}

/** Full session (frames + metrics) as a formatted JSON file. */
export function exportSessionJSON(session: MotionSession): void {
  const payload = {
    exportedAt: new Date().toISOString(),
    app: 'MOTION//DNA',
    session,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json',
  });
  downloadBlob(blob, `${safeName(session.name)}.json`);
}

function csvCell(value: number | string): string {
  if (value === '') return '';
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Per-frame metrics: frame index, timestamp, per-joint angle in degrees
 * (empty cell when the pose was not detected), plus speed / acceleration profiles.
 */
export function exportMetricsCSV(session: MotionSession): void {
  const { frames, metrics } = session;
  const jointCols = JOINT_IDS.map((id) => `${id}_deg`);
  const header = ['frame', 'timestampMs', ...jointCols, 'speed', 'accel'].join(',');
  const lines = [header];

  for (let i = 0; i < frames.length; i++) {
    const cells: Array<number | string> = [
      i,
      Math.round(frames[i].timestampMs),
    ];
    for (const id of JOINT_IDS) {
      const v = metrics.angleSeries[id]?.[i];
      cells.push(v === undefined || Number.isNaN(v) ? '' : v);
    }
    const speed = metrics.speedProfile[i];
    const accel = metrics.accelProfile[i];
    cells.push(speed ?? '');
    cells.push(accel ?? '');
    lines.push(cells.map(csvCell).join(','));
  }

  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  downloadBlob(blob, `${safeName(session.name)}-metrics.csv`);
}
