/**
 * Minimal 3D vector helpers used across the math module.
 */

export type V3 = [number, number, number];

export function vsub(a: V3, b: V3): V3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

export function vdot(a: V3, b: V3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

export function vcross(a: V3, b: V3): V3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

export function vlen(a: V3): number {
  return Math.hypot(a[0], a[1], a[2]);
}

/** Unit vector; the zero vector maps to [0,0,0] (never NaN). */
export function vnorm(a: V3): V3 {
  const l = vlen(a);
  if (l < 1e-9) return [0, 0, 0];
  return [a[0] / l, a[1] / l, a[2] / l];
}

export function vdist(a: V3, b: V3): number {
  return vlen(vsub(a, b));
}
