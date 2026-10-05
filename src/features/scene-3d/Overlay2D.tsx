/**
 * Overlay2D — NOT R3F. Absolutely-positioned 2D canvas that draws the BONES
 * skeleton in image space over a <video> element rendered by another component.
 * Redraws when the frame or canvas size changes.
 */
import { useEffect, useRef } from 'react';
import type { ReactElement, RefObject } from 'react';
import type { PoseFrame } from '../../types';
import { BONES } from '../../lib/joints';

export function Overlay2D({
  frame,
  width,
  height,
}: {
  videoRef: RefObject<HTMLVideoElement | null>;
  frame: PoseFrame | null;
  width: number;
  height: number;
}): ReactElement {
  // videoRef is accepted for API symmetry (the video element is rendered by
  // another component); drawing uses the pose frame scaled to width/height.
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);
    if (!frame || !frame.hasPose || frame.landmarks.length === 0) return;

    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (const [ai, bi] of BONES) {
      const a = frame.landmarks[ai];
      const b = frame.landmarks[bi];
      if (!a || !b) continue;
      ctx.moveTo(a.x * width, a.y * height);
      ctx.lineTo(b.x * width, b.y * height);
    }
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    for (const p of frame.landmarks) {
      ctx.beginPath();
      ctx.arc(p.x * width, p.y * height, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [frame, width, height]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
      }}
    />
  );
}
