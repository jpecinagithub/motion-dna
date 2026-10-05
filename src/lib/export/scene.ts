/**
 * Scene export: PNG still of the 3D canvas.
 */
import { getSceneCanvas } from '../canvas-registry';
import { downloadBlob } from '../utils';

/** No-op when no scene canvas is registered. */
export function exportScenePNG(): void {
  const canvas = getSceneCanvas();
  if (!canvas) return;
  canvas.toBlob(
    (blob) => {
      if (blob) downloadBlob(blob, `motion-dna-${Date.now()}.png`);
    },
    'image/png',
  );
}
