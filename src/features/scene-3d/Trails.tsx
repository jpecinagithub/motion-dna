/**
 * Trails — motion trails for selected landmarks: the last `length` frames
 * up to `upToIndex` are mapped into scene space and swept into additive
 * tube geometries along a CatmullRomCurve3.
 */
import { useEffect, useMemo } from 'react';
import type { ReactElement } from 'react';
import * as THREE from 'three';
import type { PoseFrame } from '../../types';
import { landmarksToScene } from '../../lib/joints';

export interface TrailsProps {
  frames: PoseFrame[];
  upToIndex: number;
  length: number;
  landmarkIndices: number[];
  colors?: string[];
}

interface TrailTube {
  geometry: THREE.TubeGeometry;
  color: string;
}

export function Trails(props: TrailsProps): ReactElement {
  const { frames, upToIndex, length, landmarkIndices, colors } = props;

  const tubes = useMemo<TrailTube[]>(() => {
    const out: TrailTube[] = [];
    landmarkIndices.forEach((lmIndex, k) => {
      const pts: THREE.Vector3[] = [];
      const start = Math.max(0, upToIndex - length + 1);
      for (let i = start; i <= upToIndex && i < frames.length; i++) {
        const f = frames[i];
        if (!f || !f.hasPose) continue;
        const scene = landmarksToScene(f.landmarks);
        if (!scene) continue;
        const p = scene[lmIndex];
        if (!p) continue;
        pts.push(new THREE.Vector3(p[0], p[1], p[2]));
      }
      if (pts.length < 2) return;
      const curve = new THREE.CatmullRomCurve3(pts);
      const geometry = new THREE.TubeGeometry(curve, 64, 0.014, 6, false);
      out.push({ geometry, color: colors?.[k] ?? '#8b5cf6' });
    });
    return out;
  }, [frames, upToIndex, length, landmarkIndices, colors]);

  useEffect(() => {
    return () => {
      for (const t of tubes) t.geometry.dispose();
    };
  }, [tubes]);

  return (
    <group>
      {tubes.map((t, i) => (
        <mesh key={i} geometry={t.geometry}>
          <meshBasicMaterial
            color={t.color}
            transparent
            opacity={0.85}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
}
