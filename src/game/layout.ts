import * as THREE from 'three';
import { DEG, R, dirFromLatLon } from './planet';
import type { Collider } from './colliders';

const tmp = new THREE.Vector3();

function extents(c: Collider) {
  return c.circle ? { hx: c.r, hz: c.r } : { hx: c.hx, hz: c.hz };
}

/** Separating-axis test of two footprints in the tangent plane of `a`. */
export function footprintsOverlap(a: Collider, b: Collider, pad = 0.4): boolean {
  const ea = extents(a);
  const eb = extents(b);
  tmp.copy(b.c).sub(a.c).multiplyScalar(R);
  if (tmp.length() > Math.hypot(ea.hx, ea.hz) + Math.hypot(eb.hx, eb.hz) + pad * 2) return false;
  const ax = a.circle ? perpendicular(a.c) : a.ax;
  const az = a.circle ? new THREE.Vector3().crossVectors(ax, a.c) : a.az;
  const bAx = b.circle ? ax : b.ax;
  const bAz = b.circle ? az : b.az;
  const d = [tmp.dot(ax), tmp.dot(az)];
  const u = norm2([bAx.dot(ax), bAx.dot(az)]);
  const v = norm2([bAz.dot(ax), bAz.dot(az)]);
  const axes: [number, number][] = [[1, 0], [0, 1], u, v];
  for (const n of axes) {
    const ra = ea.hx * Math.abs(n[0]) + ea.hz * Math.abs(n[1]) + pad;
    const rb = eb.hx * Math.abs(n[0] * u[0] + n[1] * u[1]) + eb.hz * Math.abs(n[0] * v[0] + n[1] * v[1]) + pad;
    if (Math.abs(d[0] * n[0] + d[1] * n[1]) > ra + rb) return false;
  }
  return true;
}

function norm2(v: [number, number]): [number, number] {
  const l = Math.hypot(v[0], v[1]) || 1;
  return [v[0] / l, v[1] / l];
}

function perpendicular(n: THREE.Vector3) {
  const ref = Math.abs(n.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
  return new THREE.Vector3().crossVectors(ref, n).normalize();
}

/** Smallest |latitude| reached by any corner of a footprint. */
export function minAbsLat(c: Collider): number {
  const e = extents(c);
  let m = 90;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const p = c.c.clone().multiplyScalar(R);
      if (c.circle) p.add(new THREE.Vector3(sx * e.hx, sz * e.hz, 0));
      else p.addScaledVector(c.ax, sx * e.hx).addScaledVector(c.az, sz * e.hz);
      p.normalize();
      m = Math.min(m, Math.abs(Math.asin(p.y) / DEG));
    }
  }
  return m;
}

export interface Path {
  points: THREE.Vector3[];
  width: number;
  color: string;
}

/** Points every ~0.6° along a great-circle arc between two lat/lon spots. */
export function pathBetween(a: [number, number], b: [number, number], width: number, color: string): Path {
  const pa = dirFromLatLon(a[0], a[1]);
  const pb = dirFromLatLon(b[0], b[1]);
  const angle = pa.angleTo(pb) / DEG;
  const n = Math.max(2, Math.ceil(angle / 0.6));
  const q = new THREE.Quaternion().setFromUnitVectors(pa, pb);
  const points: THREE.Vector3[] = [];
  for (let i = 0; i <= n; i++) points.push(pa.clone().applyQuaternion(new THREE.Quaternion().slerp(q, i / n)));
  return { points, width, color };
}

/** True if the footprint covers any sample of the path (padded by the path width). */
export function footprintOnPath(c: Collider, p: Path): boolean {
  const e = extents(c);
  const padU = p.width * DEG * R;
  for (const pt of p.points) {
    if (pt.dot(c.c) < 0.96) continue;
    tmp.copy(pt).sub(c.c).multiplyScalar(R);
    if (c.circle) {
      if (tmp.length() < c.r + padU) return true;
    } else if (Math.abs(tmp.dot(c.ax)) < e.hx + padU && Math.abs(tmp.dot(c.az)) < e.hz + padU) return true;
  }
  return false;
}
