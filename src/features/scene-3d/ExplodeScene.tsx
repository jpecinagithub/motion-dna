/**
 * ExplodeScene — "exploded time" view: `count` evenly spaced poses from
 * [inMs, outMs] fanned out along Z (oldest dimmest, newest brightest),
 * with trajectory tubes connecting `trailIndices` across the poses.
 * Click a pose to seek via onSelectTime. collapsed=true lerps all poses to z=0.
 */
import { useEffect, useMemo, useRef } from 'react';
import type { ReactElement } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import type { PoseFrame } from '../../types';
import { landmarksToScene } from '../../lib/joints';
import { formatTime } from '../../lib/utils';
import { SkeletonModel } from './SkeletonModel';

export interface ExplodeSceneProps {
  frames: PoseFrame[];
  inMs: number;
  outMs: number;
  count: number;
  spacing: number;
  collapsed: boolean;
  trailIndices: number[];
  selectedTimeMs: number;
  onSelectTime?: (timeMs: number) => void;
}

interface Picked {
  frame: PoseFrame;
}

export function ExplodeScene(props: ExplodeSceneProps): ReactElement {
  const {
    frames,
    inMs,
    outMs,
    count,
    spacing,
    collapsed,
    trailIndices,
    selectedTimeMs,
    onSelectTime,
  } = props;

  const picked = useMemo<Picked[]>(() => {
    const inRange = frames.filter(
      (f) => f.timestampMs >= inMs && f.timestampMs <= outMs,
    );
    if (inRange.length === 0) return [];
    const n = Math.min(Math.max(1, count), inRange.length);
    const out: Picked[] = [];
    for (let i = 0; i < n; i++) {
      const idx = n === 1 ? 0 : Math.round((i * (inRange.length - 1)) / (n - 1));
      out.push({ frame: inRange[idx] });
    }
    return out;
  }, [frames, inMs, outMs, count]);

  const selectedIndex = useMemo(() => {
    let best = 0;
    let bestD = Infinity;
    picked.forEach((p, i) => {
      const d = Math.abs(p.frame.timestampMs - selectedTimeMs);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    return best;
  }, [picked, selectedTimeMs]);

  const baseZ = (i: number, n: number): number => (i - (n - 1) / 2) * spacing;

  const groupRefs = useRef<Array<THREE.Group | null>>([]);

  useFrame((_, delta) => {
    const n = picked.length;
    for (let i = 0; i < n; i++) {
      const g = groupRefs.current[i];
      if (!g) continue;
      const target = collapsed ? 0 : baseZ(i, n);
      g.position.z = THREE.MathUtils.damp(g.position.z, target, 8, delta);
    }
  });

  const trajectoryGeos = useMemo<THREE.TubeGeometry[]>(() => {
    const geos: THREE.TubeGeometry[] = [];
    const n = picked.length;
    const zOf = (i: number): number => (collapsed ? 0 : (i - (n - 1) / 2) * spacing);
    for (const lm of trailIndices) {
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i < n; i++) {
        const scene = landmarksToScene(picked[i].frame.landmarks);
        if (!scene) continue;
        const p = scene[lm];
        if (!p) continue;
        pts.push(new THREE.Vector3(p[0], p[1], p[2] + zOf(i)));
      }
      if (pts.length < 2) continue;
      const curve = new THREE.CatmullRomCurve3(pts);
      geos.push(new THREE.TubeGeometry(curve, 64, 0.008, 6, false));
    }
    return geos;
  }, [picked, trailIndices, spacing, collapsed]);

  useEffect(() => {
    return () => {
      for (const g of trajectoryGeos) g.dispose();
    };
  }, [trajectoryGeos]);

  const n = picked.length;

  return (
    <group>
      {picked.map((p, i) => {
        const opacity = n === 1 ? 1 : 0.25 + 0.75 * (i / (n - 1));
        const selected = i === selectedIndex;
        return (
          <group
            key={`${p.frame.timestampMs}-${i}`}
            position={[0, 0, collapsed ? 0 : baseZ(i, n)]}
            ref={(g) => {
              groupRefs.current[i] = g;
            }}
            onClick={(e) => {
              e.stopPropagation();
              onSelectTime?.(p.frame.timestampMs);
            }}
          >
            <SkeletonModel
              landmarks={p.frame.landmarks}
              color={selected ? '#fb7185' : '#8b5cf6'}
              opacity={selected ? 1 : opacity}
            />
            <Html
              center
              position={[0, -1.35, 0]}
              distanceFactor={8}
              style={{ opacity: 0.6, pointerEvents: 'none' }}
            >
              <div
                style={{
                  color: selected ? '#fb7185' : '#8b98b8',
                  fontSize: 10,
                  fontFamily: 'monospace',
                  whiteSpace: 'nowrap',
                }}
              >
                {formatTime(p.frame.timestampMs)}
              </div>
            </Html>
          </group>
        );
      })}
      {trajectoryGeos.map((geo, i) => (
        <mesh key={`traj-${i}`} geometry={geo}>
          <meshBasicMaterial
            color="#8b5cf6"
            transparent
            opacity={0.5}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
}
