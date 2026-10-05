/**
 * Signature sculpture export: binary GLB via three's GLTFExporter (lazy-loaded).
 */
import type { SignatureVector } from '../../types';
import { downloadBlob } from '../utils';

function safeName(name: string): string {
  return name.replace(/[^\w-]+/g, '_');
}

/** Build the signature group and download it as a binary .glb file. */
export async function exportSignatureGLB(
  vector: SignatureVector,
  name: string,
): Promise<void> {
  const [{ GLTFExporter }, { createSignatureGroup }] = await Promise.all([
    import('three/examples/jsm/exporters/GLTFExporter.js'),
    import('../../features/scene-3d/signature-geometry'),
  ]);

  const group = createSignatureGroup(vector);
  const exporter = new GLTFExporter();

  const result = await new Promise<ArrayBuffer>((resolve, reject) => {
    exporter.parse(
      group,
      (data) => resolve(data as ArrayBuffer),
      (err) => reject(err),
      { binary: true },
    );
  });

  downloadBlob(new Blob([result], { type: 'model/gltf-binary' }), `${safeName(name)}.glb`);
}
