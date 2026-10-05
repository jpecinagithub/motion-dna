/**
 * Registry for the active WebGL canvas (R3F SceneCanvas).
 * Exporters (PNG / WebM) grab the canvas from here.
 */
let canvas: HTMLCanvasElement | null = null;

export function registerSceneCanvas(c: HTMLCanvasElement | null): void {
  canvas = c;
}

export function getSceneCanvas(): HTMLCanvasElement | null {
  return canvas;
}
