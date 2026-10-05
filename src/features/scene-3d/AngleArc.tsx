/**
 * AngleArc — draws the joint angle arc at joint b (between b->a and b->c)
 * plus a floating degree label via drei <Html>.
 */
import { useEffect, useMemo } from 'react';
import type { ReactElement } from 'react';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import type { JointId, Landmark } from '../../types';
import { JOINTS, landmarksToScene } from '../../lib/joints';
import { JOINT_COLORS } from '../../config';
import { angleAt } from '../../lib/math';

const ARC_SEGMENTS = 16;
const ARC_RADIUS = 0.16;

export function AngleArc({
  landmarks,
  jointId,
  showLabel = true,
}: {
  landmarks: Landmark[];
  jointId: JointId;
  showLabel?: boolean;
}): ReactElement | null {
  const def = JOINTS[jointId];

  const arc = useMemo(() => {
    const scene = landmarksToScene(landmarks);
    if (!scene) return null;
    const a = scene[def.a];
    const b = scene[def.b];
    const c = scene[def.c];
    if (!a || !b || !c) return null;
    const angle = angleAt(landmarks[def.a], landmarks[def.b], landmarks[def.c]);
    const va = new THREE.Vector3(a[0] - b[0], a[1] - b[1], a[2] - b[2]).normalize();
    const vc = new THREE.Vector3(c[0] - b[0], c[1] - b[1], c[2] - b[2]).normalize();
    const bv = new THREE.Vector3(b[0], b[1], b[2]);
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= ARC_SEGMENTS; i++) {
      const dir = va.clone().lerp(vc, i / ARC_SEGMENTS).normalize();
      pts.push(
        new THREE.Vector3(
          bv.x + dir.x * ARC_RADIUS,
          bv.y + dir.y * ARC_RADIUS,
          bv.z + dir.z * ARC_RADIUS,
        ),
      );
    }
    return {
      geometry: new THREE.BufferGeometry().setFromPoints(pts),
      b: bv,
      angle,
    };
  }, [landmarks, def]);

  useEffect(() => {
    return () => {
      arc?.geometry.dispose();
    };
  }, [arc]);

  if (!arc) return null;

  const color = JOINT_COLORS[jointId] ?? '#8b5cf6';

  return (
    <group>
      {/* R3F v9 exposes THREE.Line as <threeLine> (avoids the SVG <line> clash) */}
      <threeLine geometry={arc.geometry}>
        <lineBasicMaterial color={color} toneMapped={false} />
      </threeLine>
      {showLabel && (
        <Html
          center
          position={[arc.b.x, arc.b.y + 0.12, arc.b.z]}
          style={{ pointerEvents: 'none' }}
        >
          <div
            style={{
              padding: '2px 8px',
              borderRadius: 999,
              background: 'rgba(5,7,13,0.85)',
              border: `1px solid ${color}`,
              color,
              fontSize: 11,
              fontWeight: 600,
              fontFamily: 'monospace',
              whiteSpace: 'nowrap',
            }}
          >
            {Math.round(arc.angle)}°
          </div>
        </Html>
      )}
    </group>
  );
}
