/**
 * SkeletonModel — renders a 33-landmark pose as bones (lineSegments)
 * + joints (instanced spheres), mapped into scene space via landmarksToScene.
 * Optional per-landmark heatValues drive a blue->violet->coral ramp.
 */
import { useLayoutEffect, useMemo, useRef } from 'react';
import type { ReactElement } from 'react';
import * as THREE from 'three';
import type { Landmark } from '../../types';
import { BONES, LANDMARK_COUNT, landmarksToScene } from '../../lib/joints';

export interface SkeletonModelProps {
  landmarks: Landmark[];
  color?: string;
  opacity?: number;
  showJoints?: boolean;
  jointRadius?: number;
  /** 0..1 per landmark -> blue->violet->coral ramp; null = single color */
  heatValues?: number[] | null;
  /** unused in WebGL (lines are 1px); kept for API compatibility */
  lineWidth?: number;
}

const C_BLUE = new THREE.Color('#3b82f6');
const C_VIOLET = new THREE.Color('#8b5cf6');
const C_CORAL = new THREE.Color('#fb7185');

/** lerp in linear space between the ramp stops 0 -> blue, 0.5 -> violet, 1 -> coral */
function heatColor(v: number, out: THREE.Color): THREE.Color {
  const c = Math.min(1, Math.max(0, v));
  if (c < 0.5) return out.copy(C_BLUE).lerp(C_VIOLET, c * 2);
  return out.copy(C_VIOLET).lerp(C_CORAL, (c - 0.5) * 2);
}

export function SkeletonModel(props: SkeletonModelProps): ReactElement | null {
  const {
    landmarks,
    color = '#3b82f6',
    opacity = 1,
    showJoints = true,
    jointRadius = 0.022,
    heatValues = null,
  } = props;

  const points = useMemo(() => landmarksToScene(landmarks), [landmarks]);

  const bonePositions = useMemo(() => {
    if (!points) return null;
    const arr = new Float32Array(BONES.length * 6);
    let o = 0;
    for (const [ai, bi] of BONES) {
      const a = points[ai];
      const b = points[bi];
      arr[o++] = a[0];
      arr[o++] = a[1];
      arr[o++] = a[2];
      arr[o++] = b[0];
      arr[o++] = b[1];
      arr[o++] = b[2];
    }
    return arr;
  }, [points]);

  const jointsRef = useRef<THREE.InstancedMesh | null>(null);
  const tmpColor = useMemo(() => new THREE.Color(), []);
  const baseColor = useMemo(() => new THREE.Color(color), [color]);

  useLayoutEffect(() => {
    const mesh = jointsRef.current;
    if (!mesh || !points) return;
    const m = new THREE.Matrix4();
    for (let i = 0; i < points.length; i++) {
      m.makeTranslation(points[i][0], points[i][1], points[i][2]);
      mesh.setMatrixAt(i, m);
      if (heatValues) mesh.setColorAt(i, heatColor(heatValues[i] ?? 0, tmpColor));
      else mesh.setColorAt(i, baseColor);
    }
    mesh.count = points.length;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [points, heatValues, baseColor, tmpColor]);

  if (!points || !bonePositions) return null;

  return (
    <group>
      <lineSegments>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[bonePositions, 3]} />
        </bufferGeometry>
        <lineBasicMaterial color={color} transparent opacity={opacity} />
      </lineSegments>
      {showJoints && (
        <instancedMesh
          ref={jointsRef}
          args={[undefined, undefined, LANDMARK_COUNT]}
          frustumCulled={false}
        >
          <sphereGeometry args={[jointRadius, 12, 12]} />
          <meshBasicMaterial transparent opacity={opacity} toneMapped={false} />
        </instancedMesh>
      )}
    </group>
  );
}
