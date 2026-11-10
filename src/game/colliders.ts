import * as THREE from 'three';
import { R } from './planet';

export interface Collider {
  c: THREE.Vector3;
  ax: THREE.Vector3;
  az: THREE.Vector3;
  hx: number;
  hz: number;
  r: number;
  /** Height of the flat top above the ground at the footprint center. */
  top: number;
  circle: boolean;
  /** Overhead pieces (roofs) only block the camera; bodies ignore them. */
  bottom?: number;
}

const X = new THREE.Vector3(1, 0, 0);
const Z = new THREE.Vector3(0, 0, 1);
const tq = new THREE.Quaternion();
const tp = new THREE.Vector3();
const tmp = new THREE.Vector3();
const pDir = new THREE.Vector3();

export function boxCollider(obj: THREE.Object3D, w: number, d: number, top: number): Collider {
  obj.updateWorldMatrix(true, false);
  obj.getWorldQuaternion(tq);
  obj.getWorldPosition(tp);
  return {
    c: tp.clone().normalize(),
    ax: X.clone().applyQuaternion(tq),
    az: Z.clone().applyQuaternion(tq),
    hx: w / 2,
    hz: d / 2,
    r: 0,
    top,
    circle: false,
  };
}

export function updateBoxCollider(col: Collider, obj: THREE.Object3D) {
  obj.updateWorldMatrix(true, false);
  obj.getWorldQuaternion(tq);
  obj.getWorldPosition(tp);
  col.c.copy(tp).normalize();
  col.ax.copy(X).applyQuaternion(tq);
  col.az.copy(Z).applyQuaternion(tq);
}

export function circleCollider(dir: THREE.Vector3, r: number, top: number): Collider {
  return { c: dir.clone().normalize(), ax: new THREE.Vector3(), az: new THREE.Vector3(), hx: 0, hz: 0, r, top, circle: true };
}

const STEP_UP = 0.34;

/** A flat top sits higher above the curved ground the farther you are from its center. */
const lift = (d2: number) => d2 / (2 * R);

/** The solid volume containing a world-space point, if any. */
export function pointBlocked(list: Collider[], p: THREE.Vector3, pad = 0.25, minHalf = 0): Collider | null {
  const len = p.length();
  const y = len - R;
  pDir.copy(p).divideScalar(len);
  for (const col of list) {
    if ((col.circle ? col.r : Math.max(col.hx, col.hz)) < minHalf) continue;
    if (pDir.dot(col.c) < 0.968) continue;
    tmp.copy(pDir).sub(col.c).multiplyScalar(R);
    const l = lift(tmp.lengthSq());
    if (y > col.top + l + pad || y < (col.bottom ?? -1) + l - pad) continue;
    if (col.circle) {
      if (tmp.length() < col.r + pad) return col;
      continue;
    }
    if (Math.abs(tmp.dot(col.ax)) < col.hx + pad && Math.abs(tmp.dot(col.az)) < col.hz + pad) return col;
  }
  return null;
}

function push(dir: THREE.Vector3, col: Collider, px: number, pz: number) {
  tmp.copy(dir).multiplyScalar(R).addScaledVector(col.ax, px).addScaledVector(col.az, pz);
  dir.copy(tmp.normalize());
}

/**
 * Pushes `dir` (unit, mutated) out of solid footprints and returns the ground
 * height under it. Anything lower than STEP_UP above the feet is climbed.
 */
export function resolveCollisions(list: Collider[], dir: THREE.Vector3, h: number, pr = 0.32): number {
  let ground = 0;
  for (let pass = 0; pass < 2; pass++) {
    ground = 0;
    for (const col of list) {
      if (col.bottom !== undefined) continue;
      if (dir.dot(col.c) < 0.968) continue;
      tmp.copy(dir).sub(col.c).multiplyScalar(R);
      const top = col.top + lift(tmp.lengthSq());
      if (col.circle) {
        const dist = tmp.length();
        if (dist >= col.r + pr) continue;
        if (h >= top - 0.05 || top - h <= STEP_UP) {
          if (dist < col.r + pr * 0.4) ground = Math.max(ground, top);
          continue;
        }
        const pen = col.r + pr - dist;
        if (dist > 1e-5) {
          tmp.multiplyScalar(pen / dist);
          tmp.addScaledVector(dir, -tmp.dot(dir));
          const t2 = dir.clone().multiplyScalar(R).add(tmp);
          dir.copy(t2.normalize());
        }
        continue;
      }
      const lx = tmp.dot(col.ax);
      const lz = tmp.dot(col.az);
      if (Math.abs(lx) > col.hx + pr || Math.abs(lz) > col.hz + pr) continue;
      const qx = THREE.MathUtils.clamp(lx, -col.hx, col.hx);
      const qz = THREE.MathUtils.clamp(lz, -col.hz, col.hz);
      const dx = lx - qx, dz = lz - qz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= pr * pr) continue;
      if (h >= top - 0.05 || top - h <= STEP_UP) {
        if (Math.abs(lx) <= col.hx + pr * 0.4 && Math.abs(lz) <= col.hz + pr * 0.4) ground = Math.max(ground, top);
        continue;
      }
      if (d2 > 1e-8) {
        const d = Math.sqrt(d2);
        push(dir, col, (dx / d) * (pr - d), (dz / d) * (pr - d));
      } else {
        const ex = col.hx - Math.abs(lx);
        const ez = col.hz - Math.abs(lz);
        if (ex < ez) push(dir, col, Math.sign(lx || 1) * (ex + pr), 0);
        else push(dir, col, 0, Math.sign(lz || 1) * (ez + pr));
      }
    }
  }
  return ground;
}
