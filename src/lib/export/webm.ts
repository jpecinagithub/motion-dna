/**
 * Scene export: record the 3D canvas to a WebM video.
 */
import { getSceneCanvas } from '../canvas-registry';
import { downloadBlob } from '../utils';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Capture `seconds` of the scene canvas at 30fps into a WebM download.
 * Rejects with 'no-canvas' when nothing is registered, 'unsupported' when
 * captureStream / MediaRecorder are unavailable in this browser.
 */
export async function recordSceneWebM(seconds = 5): Promise<void> {
  const canvas = getSceneCanvas();
  if (!canvas) throw new Error('no-canvas');
  if (!('captureStream' in canvas) || typeof MediaRecorder === 'undefined') {
    throw new Error('unsupported');
  }

  const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
    ? 'video/webm;codecs=vp9'
    : 'video/webm';

  const stream = canvas.captureStream(30);
  const rec = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: 8_000_000,
  });

  const chunks: BlobPart[] = [];
  rec.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };
  const stopped = new Promise<void>((resolve) => {
    rec.onstop = () => resolve();
  });

  rec.start();
  await delay(seconds * 1000);
  rec.stop();
  await stopped;

  downloadBlob(new Blob(chunks, { type: 'video/webm' }), `motion-dna-${Date.now()}.webm`);
}
