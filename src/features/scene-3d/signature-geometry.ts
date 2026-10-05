/**
 * signature-geometry — pure three.js builder for the abstract "Motion Signature"
 * sculpture. Deterministic: a mulberry32 PRNG seeded from the vector values.
 *
 * Design: 10 stacked rings along Y (one per feature), ring radius
 * 0.35 + v*0.9, tilt/twist derived from the values, a helical spine tube
 * threading through the ring perimeters, plus ~300 additive particles
 * scattered on the rings. Electric/violet/coral palette, emissive accents.
 * Group is centered at origin and ~2.4 units tall.
 */
import * as THREE from 'three';
import type { SignatureVector } from '../../types';

const RING_COUNT = 10;
const HEIGHT = 2.4;
const PARTICLE_COUNT = 300;

const C_ELECTRIC = new THREE.Color('#3b82f6');
const C_VIOLET = new THREE.Color('#8b5cf6');
const C_CORAL = new THREE.Color('#fb7185');

/** Deterministic PRNG (mulberry32). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 0 -> electric blue, 0.5 -> violet, 1 -> coral (lerped in linear space). */
function rampColor(v: number, out: THREE.Color): THREE.Color {
  const c = Math.min(1, Math.max(0, v));
  if (c < 0.5) return out.copy(C_ELECTRIC).lerp(C_VIOLET, c * 2);
  return out.copy(C_VIOLET).lerp(C_CORAL, (c - 0.5) * 2);
}

interface RingData {
  radius: number;
  y: number;
  tiltX: number;
  tiltZ: number;
  phase: number;
}

export function createSignatureGroup(vector: SignatureVector): THREE.Group {
  const group = new THREE.Group();
  const values = Array.from(
    { length: RING_COUNT },
    (_, i) => vector.values[i] ?? 0.5,
  );
  const seed = values.reduce(
    (s, v, i) => s + Math.floor(v * 4096) * (i * 31 + 7),
    1234,
  );
  const rand = mulberry32(seed);
  const tmp = new THREE.Color();

  // --- 10 feature rings ---
  const rings: RingData[] = [];
  for (let i = 0; i < RING_COUNT; i++) {
    const v = values[i];
    const radius = 0.35 + v * 0.9;
    const y = -HEIGHT / 2 + ((i + 0.5) / RING_COUNT) * HEIGHT;
    const tiltX = (v - 0.5) * 0.7 + (rand() - 0.5) * 0.15;
    const tiltZ = (rand() - 0.5) * 0.5;
    const phase = rand() * Math.PI * 2;
    rings.push({ radius, y, tiltX, tiltZ, phase });

    rampColor(v, tmp);
    const mat = new THREE.MeshStandardMaterial({
      color: tmp.clone(),
      emissive: '#3b82f6',
      emissiveIntensity: 0.35,
      metalness: 0.7,
      roughness: 0.3,
    });
    const geo = new THREE.TorusGeometry(radius, 0.012 + v * 0.01, 10, 96);
    const ring = new THREE.Mesh(geo, mat);
    ring.position.y = y;
    ring.rotation.set(Math.PI / 2 + tiltX, 0, tiltZ);
    group.add(ring);
  }

  // --- helical spine threading through the ring perimeters ---
  const helixPts: THREE.Vector3[] = [];
  const turns = 2.5;
  const SEG = 220;
  for (let s = 0; s <= SEG; s++) {
    const t = s / SEG;
    const fi = t * (RING_COUNT - 1);
    const i0 = Math.floor(fi);
    const i1 = Math.min(RING_COUNT - 1, i0 + 1);
    const f = fi - i0;
    const r0 = rings[i0];
    const r1 = rings[i1];
    const radius = r0.radius + (r1.radius - r0.radius) * f;
    const y = r0.y + (r1.y - r0.y) * f;
    const ang = t * turns * Math.PI * 2 + r0.phase * (1 - f) + r1.phase * f;
    helixPts.push(
      new THREE.Vector3(Math.cos(ang) * radius, y, Math.sin(ang) * radius),
    );
  }
  const helixCurve = new THREE.CatmullRomCurve3(helixPts);
  const helixGeo = new THREE.TubeGeometry(helixCurve, 220, 0.008, 6, false);
  const helixMat = new THREE.MeshStandardMaterial({
    color: '#8b5cf6',
    emissive: '#3b82f6',
    emissiveIntensity: 0.5,
    metalness: 0.8,
    roughness: 0.25,
  });
  group.add(new THREE.Mesh(helixGeo, helixMat));

  // --- particle field on the rings ---
  const pos = new Float32Array(PARTICLE_COUNT * 3);
  const col = new Float32Array(PARTICLE_COUNT * 3);
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const ri = Math.floor(rand() * RING_COUNT);
    const rd = rings[ri];
    const ang = rand() * Math.PI * 2;
    const rr = rd.radius + (rand() - 0.5) * 0.08;
    pos[i * 3] = Math.cos(ang) * rr;
    pos[i * 3 + 1] = rd.y + (rand() - 0.5) * 0.08;
    pos[i * 3 + 2] = Math.sin(ang) * rr;
    rampColor(values[ri], tmp);
    col[i * 3] = tmp.r;
    col[i * 3 + 1] = tmp.g;
    col[i * 3 + 2] = tmp.b;
  }
  const pgeo = new THREE.BufferGeometry();
  pgeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  pgeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const pmat = new THREE.PointsMaterial({
    size: 0.022,
    vertexColors: true,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  group.add(new THREE.Points(pgeo, pmat));

  return group;
}
