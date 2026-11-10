import * as THREE from 'three';
import { DEG, R, dirFromLatLon, frameQuat } from './planet';
import { addOutline, toon } from './toon';

const geoCache = new Map<string, THREE.BufferGeometry>();
function cached<T extends THREE.BufferGeometry>(key: string, make: () => T): T {
  let g = geoCache.get(key);
  if (!g) {
    g = make();
    geoCache.set(key, g);
  }
  return g as T;
}

export const boxGeo = (w: number, h: number, d: number) =>
  cached(`b${w.toFixed(3)}_${h.toFixed(3)}_${d.toFixed(3)}`, () => new THREE.BoxGeometry(w, h, d));
export const cylGeo = (rt: number, rb: number, h: number, seg = 10) =>
  cached(`c${rt}_${rb}_${h}_${seg}`, () => new THREE.CylinderGeometry(rt, rb, h, seg));

export interface PartOpts {
  ol?: number | false;
  mat?: THREE.Material;
}

/** Box whose bottom sits at `y`. */
export function bx(parent: THREE.Object3D, w: number, h: number, d: number, color: string, x: number, y: number, z: number, o: PartOpts = {}) {
  const m = new THREE.Mesh(boxGeo(w, h, d), o.mat ?? toon(color));
  m.position.set(x, y + h / 2, z);
  if (o.ol !== false) addOutline(m, o.ol ?? 0.035);
  parent.add(m);
  return m;
}

/** Cylinder whose bottom sits at `y`. */
export function cy(parent: THREE.Object3D, rt: number, rb: number, h: number, color: string, x: number, y: number, z: number, o: PartOpts & { seg?: number } = {}) {
  const m = new THREE.Mesh(cylGeo(rt, rb, h, o.seg ?? 10), o.mat ?? toon(color));
  m.position.set(x, y + h / 2, z);
  if (o.ol !== false) addOutline(m, o.ol ?? 0.03);
  parent.add(m);
  return m;
}

export function blob(parent: THREE.Object3D, r: number, color: string, x: number, y: number, z: number, detail = 1) {
  const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, detail), toon(color));
  m.position.set(x, y, z);
  addOutline(m, 0.04);
  parent.add(m);
  return m;
}

export function ball(parent: THREE.Object3D, r: number, color: string, x: number, y: number, z: number, o: PartOpts = {}) {
  const m = new THREE.Mesh(cached(`s${r}`, () => new THREE.SphereGeometry(r, 16, 12)), o.mat ?? toon(color));
  m.position.set(x, y, z);
  if (o.ol !== false) addOutline(m, o.ol ?? 0.03);
  parent.add(m);
  return m;
}

export function signPlane(parent: THREE.Object3D, tex: THREE.Texture, w: number, h: number, x: number, y: number, z: number, ry = 0) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex }));
  m.position.set(x, y, z);
  m.rotation.y = ry;
  m.userData.noBatch = true;
  parent.add(m);
  return m;
}

/**
 * Tiled two-slope roof with a ridge and upturned corners. Ridge runs along X.
 * `y` is the eave height; the ridge sits `h` above it.
 */
export function tiledRoof(parent: THREE.Object3D, w: number, d: number, h: number, color: string, y: number, o: { ridge?: string; flare?: boolean; over?: number } = {}) {
  const over = o.over ?? 0.6;
  const half = d / 2 + over;
  const slope = Math.atan2(h, half);
  const len = Math.hypot(h, half);
  for (const side of [-1, 1]) {
    const slab = new THREE.Mesh(boxGeo(w + over * 2, 0.18, len), toon(color));
    slab.position.set(0, y + h / 2, (side * half) / 2);
    slab.rotation.x = side * slope;
    addOutline(slab, 0.04);
    parent.add(slab);
  }
  bx(parent, w + over * 2 + 0.3, 0.26, 0.34, o.ridge ?? color, 0, y + h - 0.05, 0, { ol: 0.035 });
  if (o.flare !== false) {
    for (const sx of [-1, 1]) {
      const end = bx(parent, 0.18, 0.5, 0.26, o.ridge ?? color, sx * (w / 2 + over + 0.15), y + h - 0.05, 0, { ol: 0.025 });
      end.rotation.z = -sx * 0.4;
      for (const sz of [-1, 1]) {
        const tip = bx(parent, 0.5, 0.14, 0.2, color, sx * (w / 2 + over - 0.1), y - 0.05, sz * (half - 0.1), { ol: 0.025 });
        tip.rotation.z = sx * 0.45;
        tip.rotation.y = sx * sz * 0.6;
      }
    }
  }
}

/** Steep church roof: two slabs meeting at a ridge along Z, gables left open. */
export function gableRoof(parent: THREE.Object3D, w: number, d: number, h: number, color: string, y: number, over = 0.35) {
  const half = w / 2 + over;
  const slope = Math.atan2(h, half);
  const len = Math.hypot(h, half);
  for (const side of [-1, 1]) {
    const slab = new THREE.Mesh(boxGeo(len, 0.18, d + over * 2), toon(color));
    slab.position.set((side * half) / 2, y + h / 2, 0);
    slab.rotation.z = -side * slope;
    addOutline(slab, 0.04);
    parent.add(slab);
  }
}

/** Solid triangle filling a gable, in the XY plane, `depth` thick. */
export function gable(parent: THREE.Object3D, w: number, h: number, depth: number, color: string, y: number, z: number) {
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2, 0);
  shape.lineTo(w / 2, 0);
  shape.lineTo(0, h);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
  geo.translate(0, 0, -depth / 2);
  const m = new THREE.Mesh(geo, toon(color));
  m.position.set(0, y, z);
  addOutline(m, 0.035);
  parent.add(m);
  return m;
}

export function tree(rnd: () => number, s = 1) {
  const g = new THREE.Group();
  cy(g, 0.11 * s, 0.17 * s, 1.7 * s, '#7a6252', 0, -0.1, 0, { seg: 7, ol: 0.03 });
  const greens = ['#6fa86f', '#8cc48c', '#5d9a68', '#7fb878'];
  const n = 3 + Math.floor(rnd() * 2);
  for (let i = 0; i < n; i++) {
    const a = rnd() * Math.PI * 2;
    const r = (0.25 + rnd() * 0.35) * s;
    blob(g, (0.75 + rnd() * 0.45) * s, greens[Math.floor(rnd() * greens.length)], Math.cos(a) * r, (1.9 + rnd() * 0.8) * s, Math.sin(a) * r);
  }
  return g;
}

export function pine(rnd: () => number, s = 1) {
  const g = new THREE.Group();
  cy(g, 0.1 * s, 0.16 * s, 1.4 * s, '#6b5444', 0, -0.1, 0, { seg: 7, ol: 0.03 });
  const greens = ['#4f7f5f', '#5d8f68', '#467456'];
  const tiers = 3;
  for (let i = 0; i < tiers; i++) {
    const r = (1.25 - i * 0.32) * s;
    const h = (1.5 - i * 0.2) * s;
    const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 7), toon(greens[(i + Math.floor(rnd() * 3)) % 3]));
    m.position.set(0, (1.1 + i * 0.85) * s + h / 2, 0);
    m.rotation.y = rnd() * Math.PI;
    addOutline(m, 0.04);
    g.add(m);
  }
  return g;
}

export function bamboo(rnd: () => number) {
  const g = new THREE.Group();
  const n = 5 + Math.floor(rnd() * 4);
  for (let i = 0; i < n; i++) {
    const a = rnd() * Math.PI * 2;
    const r = rnd() * 0.45;
    const h = 2.8 + rnd() * 2.2;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    const stem = cy(g, 0.045, 0.055, h, '#7fa86a', x, -0.05, z, { seg: 6, ol: 0.015 });
    stem.rotation.z = (rnd() - 0.5) * 0.12;
    for (let k = 0; k < 2; k++) blob(g, 0.32 + rnd() * 0.2, rnd() < 0.5 ? '#8cc48c' : '#6fa86f', x + (rnd() - 0.5) * 0.5, h - 0.2 - k * 0.6, z + (rnd() - 0.5) * 0.5, 0);
  }
  return g;
}

export function bench(color = '#a87a5a', w = 1.6) {
  const g = new THREE.Group();
  bx(g, w, 0.1, 0.52, color, 0, 0.42, 0.02, { ol: 0.025 });
  bx(g, w, 0.36, 0.08, color, 0, 0.6, -0.25, { ol: 0.025 });
  for (const x of [-(w / 2 - 0.12), w / 2 - 0.12]) bx(g, 0.08, 0.42, 0.46, '#565c5f', x, 0, 0, { ol: 0.02 });
  return g;
}

const Y = new THREE.Vector3(0, 1, 0);

/**
 * A local flat grid laid on the planet. Sub-objects are carried from the site
 * center along great circles so the whole compound stays square.
 */
export class SiteFrame {
  readonly center: THREE.Vector3;
  readonly quat: THREE.Quaternion;

  constructor(lat: number, lon: number, readonly yaw: number) {
    this.center = dirFromLatLon(lat, lon);
    this.quat = frameQuat(this.center, yaw);
  }

  dir(x: number, z: number) {
    return new THREE.Vector3(x, 0, z).applyQuaternion(this.quat).addScaledVector(this.center, R).normalize();
  }

  quatAt(dir: THREE.Vector3, localYaw = 0) {
    return new THREE.Quaternion()
      .setFromUnitVectors(this.center, dir)
      .multiply(this.quat)
      .multiply(new THREE.Quaternion().setFromAxisAngle(Y, localYaw * DEG));
  }

  put<T extends THREE.Object3D>(obj: T, x: number, z: number, localYaw = 0, lift = 0): T {
    const d = this.dir(x, z);
    obj.position.copy(d).multiplyScalar(R + lift);
    obj.quaternion.copy(this.quatAt(d, localYaw));
    return obj;
  }

  /** Surface direction plus facing tangent for a spot at (x, z) looking along localYaw. */
  spot(x: number, z: number, localYaw: number) {
    const dir = this.dir(x, z);
    const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(this.quatAt(dir, localYaw));
    fwd.addScaledVector(dir, -fwd.dot(dir)).normalize();
    return { dir, fwd };
  }
}
