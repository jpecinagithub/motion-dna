/**
 * SignatureMesh — R3F wrapper around the deterministic signature sculpture.
 * Rotates slowly on Y when animated; disposes all geometries/materials on unmount.
 */
import { useEffect, useMemo, useRef } from 'react';
import type { ReactElement } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import type { SignatureVector } from '../../types';
import { createSignatureGroup } from './signature-geometry';

export function SignatureMesh({
  vector,
  animated = true,
}: {
  vector: SignatureVector;
  animated?: boolean;
}): ReactElement {
  const group = useMemo(() => createSignatureGroup(vector), [vector]);
  const groupRef = useRef<THREE.Group | null>(null);

  useEffect(() => {
    return () => {
      group.traverse((obj) => {
        const anyObj = obj as unknown as {
          geometry?: THREE.BufferGeometry;
          material?: THREE.Material | THREE.Material[];
        };
        anyObj.geometry?.dispose();
        const m = anyObj.material;
        if (Array.isArray(m)) m.forEach((x) => x.dispose());
        else m?.dispose();
      });
    };
  }, [group]);

  useFrame((_, delta) => {
    if (animated && groupRef.current) groupRef.current.rotation.y += delta * 0.25;
  });

  return <primitive ref={groupRef} object={group} />;
}
