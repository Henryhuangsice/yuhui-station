import * as THREE from 'three';
import { R, sag } from './planet';
import { INK, addOutline, glow, textTexture, toon } from './toon';
import { SiteFrame, ball, bamboo, bench, blob, bx, cy, gable, gableRoof, pine, signPlane, tiledRoof, tree } from './parts';
import { boxCollider, circleCollider, type Collider } from './colliders';
import { Smoke } from './fx';
import { mulberry32 } from './noise';
import type { Seat, SiteId, Spot, SpotKind } from './types';

export interface Paved {
  frame: SiteFrame;
  x: number;
  z: number;
  hx: number;
  hz: number;
  color: string;
  line: string;
  tile: number;
}

export interface SiteInfo {
  id: SiteId;
  name: string;
  frame: SiteFrame;
  radius: number;
}

export interface SitesResult {
  sites: SiteInfo[];
  spots: Spot[];
  seats: Seat[];
  colliders: Collider[];
  lots: Collider[];
  paved: Paved[];
  emitters: Smoke[];
  flames: THREE.Object3D[];
  npcAt: Record<string, { dir: THREE.Vector3; fwd: THREE.Vector3 }>;
  temple: { setIncense(n: number): void; bell: THREE.Vector3; bellUp: THREE.Vector3; smoke: Smoke };
  church: { setCandles(n: number): void };
  dao: { setFire(k: number): void; furnace: THREE.Vector3; smoke: Smoke };
}

const sagAt = (x: number, z: number) => (x * x + z * z) / (2 * R);

class Ctx {
  constructor(
    readonly root: THREE.Object3D,
    readonly F: SiteFrame,
    readonly out: SitesResult,
    readonly site: SiteId,
  ) {}

  put<T extends THREE.Object3D>(obj: T, x: number, z: number, yaw = 0, lift = 0): T {
    this.F.put(obj, x, z, yaw, lift);
    this.root.add(obj);
    obj.updateWorldMatrix(true, false);
    return obj;
  }

  /** Box footprint of a part inside a rigid group, measured from the real ground below it. */
  solid(group: THREE.Object3D, x: number, z: number, w: number, d: number, top: number, bottom?: number) {
    const p = new THREE.Object3D();
    p.position.set(x, 0, z);
    group.add(p);
    const c = boxCollider(p, w, d, top + sagAt(x, z));
    if (bottom !== undefined) c.bottom = bottom + sagAt(x, z);
    p.removeFromParent();
    this.out.colliders.push(c);
    return c;
  }

  circle(x: number, z: number, r: number, top: number) {
    this.out.colliders.push(circleCollider(this.F.dir(x, z), r, top));
  }

  lot(x: number, z: number, w: number, d: number) {
    const p = this.put(new THREE.Object3D(), x, z);
    this.out.lots.push(boxCollider(p, w, d, 99));
    p.removeFromParent();
  }

  spot(kind: SpotKind, label: string, x: number, z: number, yaw: number, h: number, focus: THREE.Vector3, id = `${this.site}-${kind}`) {
    const { dir, fwd } = this.F.spot(x, z, yaw);
    this.out.spots.push({ id, kind, site: this.site, label, dir, fwd, h, focus });
  }

  point(x: number, z: number, height: number) {
    return this.F.dir(x, z).multiplyScalar(R + height);
  }

  /** Wall following a closed or open polyline, split so each piece hugs the planet. */
  wall(pts: [number, number][], h: number, color: string, cap: string, thick = 0.35) {
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, az] = pts[i];
      const [bx2, bz] = pts[i + 1];
      const len = Math.hypot(bx2 - ax, bz - az);
      const n = Math.max(1, Math.ceil(len / 2.6));
      const yaw = (Math.atan2(bx2 - ax, bz - az) * 180) / Math.PI;
      for (let k = 0; k < n; k++) {
        const t0 = (k + 0.5) / n;
        const seg = new THREE.Group();
        const sl = len / n + 0.06;
        bx(seg, thick, h + 0.25, sl, color, 0, -0.25, 0, { ol: 0.03 });
        bx(seg, thick + 0.3, 0.16, sl + 0.04, cap, 0, h, 0, { ol: 0.025 });
        const x = ax + (bx2 - ax) * t0;
        const z = az + (bz - az) * t0;
        this.put(seg, x, z, yaw);
        this.out.colliders.push(boxCollider(seg, thick, sl, h + 0.16));
      }
    }
  }
}

function plaque(text: string, bg: string, fg: string, w = 512, h = 160) {
  return textTexture(text, { bg, fg, w, h, border: fg });
}

function taijiTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d')!;
  g.translate(256, 256);
  g.fillStyle = '#5a6470';
  g.beginPath();
  g.arc(0, 0, 252, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#e3ddcb';
  g.beginPath();
  g.arc(0, 0, 238, 0, Math.PI * 2);
  g.fill();
  const tri = ['111', '110', '101', '100', '011', '010', '001', '000'];
  g.fillStyle = INK;
  tri.forEach((bits, i) => {
    g.save();
    g.rotate((i * Math.PI) / 4);
    [...bits].forEach((b, k) => {
      const y = -222 + k * 16;
      if (b === '1') g.fillRect(-34, y, 68, 10);
      else {
        g.fillRect(-34, y, 29, 10);
        g.fillRect(5, y, 29, 10);
      }
    });
    g.restore();
  });
  const r = 150;
  g.fillStyle = '#f8f6ef';
  g.beginPath();
  g.arc(0, 0, r, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = INK;
  g.beginPath();
  g.arc(0, 0, r, -Math.PI / 2, Math.PI / 2, false);
  g.arc(0, r / 2, r / 2, Math.PI / 2, (3 * Math.PI) / 2, false);
  g.arc(0, -r / 2, r / 2, Math.PI / 2, -Math.PI / 2, true);
  g.closePath();
  g.fill();
  g.beginPath();
  g.arc(0, r / 2, r / 8, 0, Math.PI * 2);
  g.fillStyle = '#f8f6ef';
  g.fill();
  g.beginPath();
  g.arc(0, -r / 2, r / 8, 0, Math.PI * 2);
  g.fillStyle = INK;
  g.fill();
  g.lineWidth = 6;
  g.strokeStyle = INK;
  g.beginPath();
  g.arc(0, 0, r, 0, Math.PI * 2);
  g.stroke();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function roseTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  g.translate(128, 128);
  const colors = ['#4f7fd1', '#c25959', '#f3c258', '#5ea86f', '#8a5fc2', '#66BDE6'];
  for (let i = 0; i < 12; i++) {
    g.beginPath();
    g.moveTo(0, 0);
    g.arc(0, 0, 124, (i * Math.PI) / 6, ((i + 1) * Math.PI) / 6);
    g.closePath();
    g.fillStyle = colors[i % colors.length];
    g.fill();
  }
  for (let i = 0; i < 12; i++) {
    g.beginPath();
    g.arc(Math.cos((i + 0.5) * (Math.PI / 6)) * 80, Math.sin((i + 0.5) * (Math.PI / 6)) * 80, 18, 0, Math.PI * 2);
    g.fillStyle = colors[(i + 3) % colors.length];
    g.fill();
  }
  g.strokeStyle = INK;
  g.lineWidth = 6;
  for (let i = 0; i < 12; i++) {
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(Math.cos((i * Math.PI) / 6) * 124, Math.sin((i * Math.PI) / 6) * 124);
    g.stroke();
  }
  for (const r of [40, 124]) {
    g.beginPath();
    g.arc(0, 0, r, 0, Math.PI * 2);
    g.stroke();
  }
  g.beginPath();
  g.arc(0, 0, 40, 0, Math.PI * 2);
  g.fillStyle = '#f3c258';
  g.fill();
  g.stroke();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function lantern(parent: THREE.Object3D, x: number, y: number, z: number) {
  const l = ball(parent, 0.22, '', x, y, z, { mat: glow('#ff8a5a'), ol: 0.02 });
  l.scale.set(1, 1.15, 1);
  cy(parent, 0.1, 0.1, 0.08, '#2b3236', x, y + 0.22, z, { ol: false });
  cy(parent, 0.08, 0.08, 0.06, '#2b3236', x, y - 0.3, z, { ol: false });
  return l;
}

function hall(
  c: Ctx,
  z0: number,
  o: { wall: string; column: string; roof: string; ridge: string; plaque: THREE.Texture; floor: string },
) {
  const g = new THREE.Group();
  const W = 10, D = 6.8, TOP = 0.3;
  const sk = sag(Math.hypot(W, D) / 2);
  bx(g, W, TOP + sk, D, o.floor, 0, -sk, 0, { ol: 0.035 });
  for (const x of [-3.9, -1.3, 1.3, 3.9]) cy(g, 0.2, 0.22, 3.1, o.column, x, TOP, 2.6, { seg: 12, ol: 0.03 });
  bx(g, 9.0, 3.1, 0.3, o.wall, 0, TOP, -3.0, { ol: 0.04 });
  for (const sx of [-1, 1]) bx(g, 0.3, 3.1, 5.6, o.wall, sx * 4.5, TOP, -0.2, { ol: 0.04 });
  bx(g, 9.4, 0.45, 0.4, o.column, 0, TOP + 3.05, 2.6, { ol: 0.03 });
  tiledRoof(g, 9.4, 6.2, 1.8, o.roof, TOP + 3.5, { over: 0.8, ridge: o.ridge });
  bx(g, 2.5, 0.72, 0.12, INK, 0, TOP + 2.25, 2.85, { ol: 0.02 });
  signPlane(g, o.plaque, 2.35, 0.62, 0, TOP + 2.61, 2.92);
  lantern(g, -2.6, TOP + 2.75, 3.15);
  lantern(g, 2.6, TOP + 2.75, 3.15);
  c.put(g, 0, z0);
  c.solid(g, 0, 0, W, D, TOP);
  c.solid(g, 0, -3.0, 9.0, 0.3, 3.6);
  for (const sx of [-1, 1]) c.solid(g, sx * 4.5, -0.2, 0.3, 5.6, 3.6);
  for (const x of [-3.9, -1.3, 1.3, 3.9]) c.solid(g, x, 2.6, 0.45, 0.45, 3.6);
  c.solid(g, 0, -0.2, W + 1, D + 1, 6.2, 3.45);
  const step = new THREE.Group();
  bx(step, 3.2, 0.42, 0.9, o.floor, 0, -0.2, 0, { ol: 0.03 });
  c.put(step, 0, z0 + D / 2 + 0.4);
  c.out.colliders.push(boxCollider(step, 3.2, 0.9, 0.22));
  return { g, TOP };
}

function buildTemple(root: THREE.Object3D, out: SitesResult, rnd: () => number, scale: number) {
  const F = new SiteFrame(-42, 210, 180);
  const c = new Ctx(root, F, out, 'temple');
  out.sites.push({ id: 'temple', name: '余晖寺', frame: F, radius: 12 });
  out.paved.push({ frame: F, x: 0, z: 0.6, hx: 7, hz: 8.1, color: '#d6cdb8', line: '#c3b9a2', tile: 1.25 });
  c.lot(0, 0.6, 16, 18);

  const gate = new THREE.Group();
  for (const x of [-1.9, 1.9]) cy(gate, 0.22, 0.25, 3.3, '#c25959', x, -0.2, 0, { seg: 12 });
  bx(gate, 4.8, 0.42, 0.5, '#8f3f3f', 0, 2.8, 0, { ol: 0.03 });
  tiledRoof(gate, 4.0, 1.3, 0.8, '#4a575d', 3.2, { over: 0.55, ridge: '#3e4a50' });
  bx(gate, 1.7, 0.6, 0.1, INK, 0, 2.1, 0.28, { ol: 0.02 });
  signPlane(gate, plaque('余晖寺', '#8f3f3f', '#ffd36a', 384, 136), 1.6, 0.52, 0, 2.4, 0.34);
  lantern(gate, -1.2, 2.25, 0.45);
  lantern(gate, 1.2, 2.25, 0.45);
  c.put(gate, 0, 8.6);
  for (const x of [-1.9, 1.9]) c.circle(x, 8.6, 0.32, 3.5);
  c.solid(gate, 0, 0, 5.6, 2.6, 4.3, 2.7);
  c.wall([[-2.6, 8.6], [-7, 8.6], [-7, -7.5], [7, -7.5], [7, 8.6], [2.6, 8.6]], 1.6, '#b9584a', '#4a575d');

  const burner = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    cy(burner, 0.06, 0.07, 0.4, '#5a4a32', Math.cos(a) * 0.42, 0, Math.sin(a) * 0.42, { seg: 6, ol: 0.015 });
  }
  cy(burner, 0.62, 0.5, 0.55, '#8a6a3a', 0, 0.35, 0, { seg: 18, ol: 0.035 });
  cy(burner, 0.68, 0.68, 0.08, '#6f5a3a', 0, 0.88, 0, { seg: 18, ol: 0.025 });
  cy(burner, 0.6, 0.6, 0.02, '#d8c9a8', 0, 0.9, 0, { seg: 18, ol: false });
  for (const sx of [-1, 1]) bx(burner, 0.08, 0.3, 0.26, '#6f5a3a', sx * 0.7, 0.85, 0, { ol: 0.015 });
  const sticks = new THREE.Group();
  sticks.userData.noBatch = true;
  const stickMat = toon('#b5653a');
  const tipMat = glow('#ff7a4a');
  for (let i = 0; i < 14; i++) {
    const s = new THREE.Group();
    const a = i * 2.39;
    const r = 0.1 + (i % 4) * 0.1;
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.55, 5), stickMat);
    stick.position.y = 0.27;
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.028, 6, 5), tipMat);
    tip.position.y = 0.56;
    s.add(stick, tip);
    s.position.set(Math.cos(a) * r, 0.9, Math.sin(a) * r);
    s.rotation.set((rnd() - 0.5) * 0.15, 0, (rnd() - 0.5) * 0.15);
    s.visible = false;
    sticks.add(s);
  }
  burner.add(sticks);
  c.put(burner, 0, 2.7);
  c.circle(0, 2.7, 0.75, 1.0);
  const smoke = new Smoke({ color: '#f5f5ef', rate: 2, life: 4.5, size: 0.9, rise: 0.55, spread: 0.25, alpha: 0.5 }, scale).set(c.point(0, 2.7, 1.5), F.dir(0, 2.7));
  out.emitters.push(smoke);
  c.spot('incense', '上香', 0, 4.0, 180, 0, c.point(0, 2.7, 1.2));

  const pav = new THREE.Group();
  for (const x of [-1, 1]) for (const z of [-1, 1]) cy(pav, 0.1, 0.12, 3.0, '#c25959', x, -0.2, z, { seg: 8, ol: 0.025 });
  bx(pav, 2.4, 0.22, 0.24, '#8f3f3f', 0, 2.6, 0, { ol: 0.02 });
  tiledRoof(pav, 2.2, 2.2, 0.9, '#4a575d', 2.85, { over: 0.4, ridge: '#3e4a50' });
  cy(pav, 0.42, 0.62, 1.2, '#6f5a3a', 0, 1.35, 0, { seg: 18, ol: 0.035 });
  cy(pav, 0.64, 0.64, 0.12, '#5a4a32', 0, 1.35, 0, { seg: 18, ol: 0.02 });
  cy(pav, 0.12, 0.16, 0.12, '#5a4a32', 0, 2.55, 0, { seg: 8, ol: 0.015 });
  const log = cy(pav, 0.09, 0.09, 1.3, '#a87a5a', 0, 0, 0, { seg: 8, ol: 0.02 });
  log.rotation.z = Math.PI / 2;
  log.position.set(-1.25, 1.95, 0);
  for (const z of [-0.35, 0.35]) bx(pav, 0.02, 0.55, 0.02, INK, -1.25, 2.0, z, { ol: false });
  c.put(pav, 5.2, 2.6);
  c.circle(5.2, 2.6, 0.75, 3.0);
  c.solid(pav, 0, 0, 3.4, 3.4, 4.0, 2.55);
  for (const x of [-1, 1]) for (const z of [-1, 1]) c.circle(5.2 + x, 2.6 + z, 0.16, 3.0);
  out.temple.bell = c.point(5.2, 2.6, 1.95);
  out.temple.bellUp = F.dir(5.2, 2.6);
  c.spot('bell', '敲钟', 3.4, 2.6, 90, 0, c.point(5.2, 2.6, 2.0));

  const { g, TOP } = hall(c, -3.6, {
    wall: '#b9584a',
    column: '#c25959',
    roof: '#4a575d',
    ridge: '#3e4a50',
    floor: '#c9c1b0',
    plaque: plaque('大雄宝殿', INK, '#ffd36a', 512, 136),
  });
  bx(g, 2.6, 0.6, 1.5, '#8f3f3f', 0, TOP, -2.1, { ol: 0.03 });
  const B = new THREE.Group();
  B.position.set(0, TOP + 0.6, -2.15);
  g.add(B);
  cy(B, 0.95, 0.8, 0.32, '#e8b4b0', 0, 0, 0, { seg: 16, ol: 0.03 });
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const p = ball(B, 0.22, '#ebced0', Math.cos(a) * 0.86, 0.2, Math.sin(a) * 0.86, { ol: 0.02 });
    p.scale.set(1, 0.6, 1.4);
    p.rotation.y = -a;
  }
  const legs = ball(B, 0.5, '#d9a830', 0, 0.48, 0.15, { ol: 0.03 });
  legs.scale.set(1.5, 0.45, 0.9);
  const body = ball(B, 0.55, '#e2b13c', 0, 1.05, -0.05, { ol: 0.03 });
  body.scale.set(1, 1.1, 0.78);
  ball(B, 0.36, '#e2b13c', 0, 1.88, 0, { ol: 0.03 });
  ball(B, 0.14, '#c99a2e', 0, 2.25, -0.02, { ol: 0.02 });
  for (const sx of [-1, 1]) {
    const ear = ball(B, 0.08, '#e2b13c', sx * 0.36, 1.8, 0, { ol: 0.015 });
    ear.scale.set(0.6, 1.8, 0.6);
  }
  ball(B, 0.13, '#e2b13c', 0, 0.68, 0.48, { ol: 0.02 });
  const halo = new THREE.Mesh(new THREE.CircleGeometry(0.78, 32), glow('#ffe9a8'));
  halo.position.set(0, 1.92, -0.45);
  B.add(halo);
  const haloRing = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.04, 6, 32), toon('#e6b84a'));
  haloRing.position.copy(halo.position);
  B.add(haloRing);
  c.solid(g, 0, -2.1, 2.6, 1.6, 3.4);

  bx(g, 2.0, 0.72, 0.55, '#6b3a2e', 0, TOP, -0.75, { ol: 0.03 });
  for (const [x, col] of [[-0.55, '#f3a24a'], [-0.35, '#f3a24a'], [0.45, '#c25959']] as const) ball(g, 0.11, col, x, TOP + 0.83, -0.75, { ol: 0.015 });
  for (const x of [-0.85, 0.85]) {
    cy(g, 0.04, 0.05, 0.22, '#c25959', x, TOP + 0.72, -0.75, { seg: 6, ol: 0.012 });
    ball(g, 0.04, '', x, TOP + 0.99, -0.75, { mat: glow('#ffcf6a'), ol: false });
  }
  c.solid(g, 0, -0.75, 2.0, 0.55, 1.05);
  for (const x of [-1.4, 0, 1.4]) {
    cy(g, 0.36, 0.4, 0.14, '#d9a441', x, TOP, 0.6, { seg: 16, ol: 0.025 });
    c.spot('bow', '拜佛', x, -3.6 + 0.6, 180, TOP + sagAt(x, 0.6), c.point(0, -5.75, 2.6), `temple-bow-${x}`);
  }

  bx(g, 0.7, 0.24, 0.6, '#6b3a2e', -3.2, TOP, 0.85, { ol: 0.025 });
  const muyu = ball(g, 0.27, '#a0522d', -3.2, TOP + 0.48, 0.85, { ol: 0.025 });
  muyu.scale.set(1.15, 0.82, 1);
  bx(g, 0.34, 0.04, 0.06, INK, -3.2, TOP + 0.42, 1.13, { ol: false });
  const mallet = cy(g, 0.02, 0.02, 0.42, '#7a5a42', -2.75, TOP + 0.3, 0.85, { seg: 5, ol: 0.01 });
  mallet.rotation.x = Math.PI / 2;
  ball(g, 0.06, '#7a5a42', -2.75, TOP + 0.3, 1.06, { ol: 0.012 });
  cy(g, 0.34, 0.38, 0.12, '#c25959', -3.2, TOP, 1.75, { seg: 16, ol: 0.02 });
  c.solid(g, -3.2, 0.85, 0.7, 0.6, 0.85);
  c.spot('muyu', '敲木鱼', -3.2, -3.6 + 1.75, 180, TOP + sagAt(-3.2, 1.75), c.point(-3.2, -3.6 + 0.85, TOP + 0.9));

  bx(g, 0.9, 0.75, 0.6, '#8f3f3f', 3.2, TOP, 0.85, { ol: 0.025 });
  cy(g, 0.11, 0.09, 0.34, '#c9a36a', 3.2, TOP + 0.75, 0.85, { seg: 10, ol: 0.015 });
  for (let i = 0; i < 9; i++) {
    const s = bx(g, 0.025, 0.3, 0.012, '#e6cf8e', 3.2 + (rnd() - 0.5) * 0.12, TOP + 0.95, 0.85 + (rnd() - 0.5) * 0.12, { ol: false });
    s.rotation.set((rnd() - 0.5) * 0.3, 0, (rnd() - 0.5) * 0.3);
  }
  signPlane(g, plaque('求签', '#8f3f3f', '#ffd36a', 192, 96), 0.5, 0.25, 3.2, TOP + 0.45, 1.16);
  cy(g, 0.34, 0.38, 0.12, '#c25959', 3.2, TOP, 1.75, { seg: 16, ol: 0.02 });
  c.solid(g, 3.2, 0.85, 0.9, 0.6, 1.1);
  c.spot('fortune', '抽签', 3.2, -3.6 + 1.75, 180, TOP + sagAt(3.2, 1.75), c.point(3.2, -3.6 + 0.85, TOP + 1.3));

  for (let i = 0; i < 10; i++) {
    const side = i % 2 ? 1 : -1;
    const x = side * (8.6 + rnd() * 2.5);
    const z = -8 + rnd() * 17;
    const t = rnd() < 0.6 ? pine(rnd, 1 + rnd() * 0.5) : bamboo(rnd);
    c.put(t, x, z, rnd() * 360);
    c.circle(x, z, 0.35, 99);
  }
  for (const [x, z] of [[-5.5, 6.5], [5.5, 6.8], [-5.8, -6], [5.8, -6.2]] as const) {
    const t = pine(rnd, 0.85);
    c.put(t, x, z, rnd() * 360);
    c.circle(x, z, 0.3, 99);
  }

  const npc = F.spot(-2.3, 1.3, 0);
  out.npcAt.huiming = npc;
  return { sticks, smoke };
}

function buildChurch(root: THREE.Object3D, out: SitesResult, rnd: () => number) {
  const F = new SiteFrame(48, 100, 0);
  const c = new Ctx(root, F, out, 'church');
  out.sites.push({ id: 'church', name: '晚钟教堂', frame: F, radius: 9 });
  out.paved.push({ frame: F, x: 0, z: 6.8, hx: 2.2, hz: 2.0, color: '#d8cfbd', line: '#c8bea9', tile: 0.9 });
  c.lot(0, 0.5, 9, 12.5);

  const g = new THREE.Group();
  const W = 6.4, D = 9.4, TOP = 0.2;
  const sk = sag(Math.hypot(W, D) / 2);
  const cream = '#f1ece0';
  bx(g, W, TOP + sk, D, '#c9c1b0', 0, -sk, 0, { ol: 0.035 });
  for (const sx of [-1, 1]) bx(g, 2.0, 5.0, 0.4, cream, sx * 2.2, TOP, 4.5, { ol: 0.04 });
  bx(g, 2.4, 1.8, 0.4, cream, 0, TOP + 3.2, 4.5, { ol: 0.035 });
  bx(g, 2.5, 0.12, 0.5, '#7a5a42', 0, TOP + 3.15, 4.5, { ol: 0.02 });
  gable(g, 6.6, 2.4, 0.4, cream, TOP + 5.0, 4.5);
  bx(g, W, 5.0, 0.4, cream, 0, TOP, -4.5, { ol: 0.04 });
  gable(g, 6.6, 2.4, 0.4, cream, TOP + 5.0, -4.5);
  const rose = roseTexture();
  for (const [z, ry] of [[4.72, 0], [4.28, Math.PI]] as const) {
    const m = new THREE.Mesh(new THREE.CircleGeometry(0.72, 32), new THREE.MeshBasicMaterial({ map: rose }));
    m.position.set(0, TOP + 4.25, z);
    m.rotation.y = ry;
    m.userData.noBatch = true;
    g.add(m);
  }
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.74, 0.06, 6, 32), toon('#c9c1b0'));
  rim.position.set(0, TOP + 4.25, 4.74);
  g.add(rim);
  for (const x of [-3.0, 3.0]) {
    for (const z of [-3.6, -1.8, 0, 1.8, 3.6]) cy(g, 0.16, 0.18, 5.0, cream, x, TOP, z, { seg: 10, ol: 0.03 });
    bx(g, 0.4, 0.3, 9.0, cream, x, TOP + 4.85, 0, { ol: 0.03 });
    for (const z of [-2.7, -0.9, 0.9, 2.7]) bx(g, 0.3, 0.7, 1.5, cream, x, TOP, z, { ol: 0.025 });
  }
  const glassColors = ['#4f7fd1', '#c25959', '#f3c258', '#5ea86f'];
  let gi = 0;
  for (const x of [-3.0, 3.0]) {
    for (const z of [-2.7, -0.9, 0.9, 2.7]) {
      const mat = new THREE.MeshBasicMaterial({ color: glassColors[gi++ % 4], transparent: true, opacity: 0.42, side: THREE.DoubleSide, depthWrite: false });
      const pane = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 3.2), mat);
      pane.position.set(x, TOP + 2.55, z);
      pane.rotation.y = Math.PI / 2;
      pane.userData.noBatch = true;
      g.add(pane);
    }
  }
  gableRoof(g, W, D, 2.4, '#647A87', TOP + 5.0, 0.45);
  bx(g, 1.9, 2.6, 1.9, cream, 0, TOP + 6.0, 3.6, { ol: 0.04 });
  for (const [x, z, side] of [[0, 4.56, 0], [0, 2.64, 0], [0.96, 3.6, 1], [-0.96, 3.6, 1]] as const) {
    bx(g, side ? 0.05 : 0.7, 1.1, side ? 0.7 : 0.05, INK, x, TOP + 6.9, z, { ol: false });
  }
  const spire = new THREE.Mesh(new THREE.ConeGeometry(1.45, 3.2, 4), toon('#647A87'));
  spire.position.set(0, TOP + 8.6 + 1.6, 3.6);
  spire.rotation.y = Math.PI / 4;
  addOutline(spire, 0.04);
  g.add(spire);
  bx(g, 0.12, 0.95, 0.12, '#e6cf8e', 0, TOP + 11.8, 3.6, { ol: 0.02 });
  bx(g, 0.55, 0.12, 0.12, '#e6cf8e', 0, TOP + 12.4, 3.6, { ol: 0.02 });

  bx(g, 0.18, 1.7, 0.1, '#e6cf8e', 0, TOP + 2.0, -4.26, { ol: 0.02 });
  bx(g, 1.0, 0.18, 0.1, '#e6cf8e', 0, TOP + 3.1, -4.26, { ol: 0.02 });
  bx(g, 2.0, 1.0, 0.7, '#f8f8f8', 0, TOP, -3.6, { ol: 0.03 });
  bx(g, 2.06, 0.12, 0.76, '#e6cf8e', 0, TOP + 0.75, -3.6, { ol: false });
  for (const x of [-0.7, 0.7]) {
    cy(g, 0.03, 0.05, 0.4, '#e6cf8e', x, TOP + 1.0, -3.6, { seg: 6, ol: 0.012 });
    cy(g, 0.035, 0.035, 0.14, '#f8f6ef', x, TOP + 1.4, -3.6, { seg: 6, ol: 0.01 });
    ball(g, 0.035, '', x, TOP + 1.6, -3.6, { mat: glow('#ffcf6a'), ol: false });
  }
  bx(g, 1.4, 1.0, 0.7, '#7a5a42', -2.1, TOP, -3.75, { ol: 0.03 });
  for (let i = 0; i < 7; i++) cy(g, 0.07, 0.07, 1.2 + Math.sin(i * 0.9) * 0.5 + i * 0.05, '#e6cf8e', -2.65 + i * 0.18, TOP + 1.0, -3.95, { seg: 8, ol: 0.012 });

  const rack = new THREE.Group();
  bx(rack, 1.4, 0.55, 0.5, '#3e4a50', 0, 0, 0, { ol: 0.025 });
  const flames: THREE.Object3D[] = [];
  for (let tier = 0; tier < 3; tier++) {
    const ty = 0.55 + tier * 0.18;
    const tz = 0.12 - tier * 0.14;
    bx(rack, 1.4, 0.06, 0.2, '#3e4a50', 0, ty - 0.06, tz, { ol: 0.015 });
    for (let k = 0; k < 8; k++) {
      const x = -0.6 + k * 0.17;
      cy(rack, 0.03, 0.03, 0.13, '#f8f6ef', x, ty, tz, { seg: 6, ol: 0.008 });
      const f = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.09, 6), glow('#ffcf6a'));
      f.position.set(x, ty + 0.18, tz);
      f.userData.noBatch = true;
      f.visible = false;
      rack.add(f);
      flames.push(f);
    }
  }
  rack.position.set(2.0, TOP, -3.3);
  g.add(rack);
  bx(g, 1.4, 0.26, 0.36, '#8f3f3f', 0, TOP, -2.75, { ol: 0.02 });

  const pews: [number, number][] = [];
  for (const x of [-1.45, 1.45]) for (const z of [2.3, 0.9, -0.5]) pews.push([x, z]);
  for (const [x, z] of pews) {
    const p = bench('#7a5a42', 2.2);
    p.position.set(x, TOP, z);
    p.rotation.y = Math.PI;
    g.add(p);
  }
  for (let i = 0; i < 3; i++) ball(g, 0.12, '', 0, TOP + 4.3, -2 + i * 2, { mat: glow('#fff1c4'), ol: 0.015 });

  c.put(g, 0, 0);
  c.solid(g, 0, 0, W, D, TOP);
  for (const sx of [-1, 1]) c.solid(g, sx * 2.2, 4.5, 2.0, 0.4, 5.4);
  c.solid(g, 0, -4.5, W, 0.4, 5.4);
  for (const x of [-3.0, 3.0]) for (const z of [-2.7, -0.9, 0.9, 2.7]) c.solid(g, x, z, 0.35, 1.5, TOP + 0.7);
  for (const x of [-3.0, 3.0]) for (const z of [-3.6, -1.8, 0, 1.8, 3.6]) c.solid(g, x, z, 0.35, 0.35, 5.4);
  c.solid(g, 0, -3.6, 2.0, 0.7, TOP + 1.0);
  c.solid(g, -2.1, -3.75, 1.4, 0.7, 3.4);
  c.solid(g, 2.0, -3.3, 1.4, 0.5, TOP + 1.0);
  c.solid(g, 0, -2.75, 1.4, 0.36, TOP + 0.26);
  c.solid(g, 0, 0, W + 1, D + 1, 9, 5.1);
  c.solid(g, 0, 3.6, 1.9, 1.9, 13, 5.1);
  for (const [x, z] of pews) {
    c.solid(g, x, z, 2.3, 0.6, TOP + 0.5);
    const { dir, fwd } = F.spot(x, z - 0.05, 180);
    out.seats.push({ id: `pew-${x}-${z}`, dir, fwd, h: TOP + sagAt(x, z) + 0.3, occupiedBy: null, label: '坐下听歌' });
  }

  const step = new THREE.Group();
  bx(step, 2.8, 0.45, 1.0, '#c9c1b0', 0, -0.2, 0, { ol: 0.03 });
  c.put(step, 0, D / 2 + 0.45);
  out.colliders.push(boxCollider(step, 2.8, 1.0, 0.25));

  c.spot('candle', '点蜡烛', 2.0, -2.4, 180, TOP + sagAt(2.0, -2.4), c.point(2.0, -3.3, TOP + 0.9));
  c.spot('pray', '祈祷', 0, -2.35, 180, TOP + sagAt(0, -2.35), c.point(0, -4.3, TOP + 2.6));

  for (const x of [-1.6, 1.6]) {
    const lamp = new THREE.Group();
    cy(lamp, 0.05, 0.07, 2.6, '#3e4a50', 0, -0.1, 0, { seg: 8, ol: 0.02 });
    bx(lamp, 0.3, 0.36, 0.3, '', 0, 2.5, 0, { mat: glow('#fff1c4'), ol: 0.02 });
    bx(lamp, 0.4, 0.08, 0.4, '#3e4a50', 0, 2.86, 0, { ol: 0.015 });
    c.put(lamp, x, 7.4);
    c.circle(x, 7.4, 0.12, 3);
  }
  for (let i = 0; i < 9; i++) {
    const side = i % 2 ? 1 : -1;
    const x = side * (5.2 + rnd() * 2.6);
    const z = -6 + rnd() * 12;
    const t = tree(rnd, 0.9 + rnd() * 0.4);
    c.put(t, x, z, rnd() * 360);
    c.circle(x, z, 0.25, 99);
  }
  for (let i = 0; i < 14; i++) {
    const f = new THREE.Group();
    ball(f, 0.1, ['#f3c258', '#ebced0', '#f8f8f8', '#c25959'][i % 4], 0, 0.25, 0, { ol: 0.012 });
    cy(f, 0.015, 0.015, 0.25, '#6fa86f', 0, 0, 0, { seg: 4, ol: false });
    c.put(f, (i % 2 ? 1 : -1) * (1.6 + rnd() * 1.2), 5.8 + rnd() * 2.6);
  }

  out.npcAt.qiao = F.spot(-2.3, -2.4, 0);
  const setCandles = (n: number) => flames.forEach((f, i) => (f.visible = i < n));
  return { flames, setCandles };
}

function buildDao(root: THREE.Object3D, out: SitesResult, rnd: () => number, scale: number) {
  const F = new SiteFrame(-48, 50, 180);
  const c = new Ctx(root, F, out, 'dao');
  out.sites.push({ id: 'dao', name: '云栖观', frame: F, radius: 12 });
  out.paved.push({ frame: F, x: 0, z: 0.8, hx: 7, hz: 8.2, color: '#c3c8bb', line: '#adb3a5', tile: 1.5 });
  c.lot(0, 0.8, 16, 18.5);

  const gate = new THREE.Group();
  for (const x of [-2.3, 2.3]) {
    cy(gate, 0.24, 0.26, 3.9, '#6b3a2e', x, -0.2, 0, { seg: 12 });
    bx(gate, 0.7, 0.5, 0.7, '#a0a8a6', x, -0.2, 0, { ol: 0.025 });
  }
  bx(gate, 5.9, 0.34, 0.36, '#6b3a2e', 0, 3.05, 0, { ol: 0.03 });
  bx(gate, 5.2, 0.28, 0.3, '#6b3a2e', 0, 2.35, 0, { ol: 0.025 });
  tiledRoof(gate, 5.0, 1.2, 0.7, '#3e4a50', 3.4, { over: 0.5, ridge: '#2b3236' });
  bx(gate, 1.9, 0.6, 0.1, INK, 0, 2.6, 0.22, { ol: 0.02 });
  signPlane(gate, plaque('云栖观', INK, '#e6cf8e', 384, 136), 1.8, 0.52, 0, 2.9, 0.28);
  c.put(gate, 0, 9.0);
  for (const x of [-2.3, 2.3]) c.circle(x, 9.0, 0.4, 4);
  c.solid(gate, 0, 0, 6.6, 2.4, 4.4, 2.3);
  c.wall([[-3.2, 9.0], [-7, 9.0], [-7, -7.6], [7, -7.6], [7, 9.0], [3.2, 9.0]], 1.1, '#a0a8a6', '#3e4a50', 0.4);

  const disc = new THREE.Mesh(new THREE.CircleGeometry(2.0, 48), new THREE.MeshBasicMaterial({ map: taijiTexture() }));
  disc.rotation.x = -Math.PI / 2;
  const discHolder = new THREE.Group();
  discHolder.add(disc);
  discHolder.userData.noBatch = true;
  c.put(discHolder, 0, 2.8, 0, 0.03);
  c.spot('meditate', '打坐修仙', 0, 2.8, 180, 0, c.point(0, 2.8, 0.5), 'dao-meditate-taiji');

  const furnace = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.5;
    const leg = cy(furnace, 0.08, 0.1, 0.75, '#6f5a3a', Math.cos(a) * 0.55, -0.1, Math.sin(a) * 0.55, { seg: 6, ol: 0.02 });
    leg.rotation.set(Math.sin(a) * 0.2, 0, -Math.cos(a) * 0.2);
  }
  const pot = ball(furnace, 0.78, '#9a7a3a', 0, 1.15, 0, { ol: 0.04 });
  pot.scale.set(1, 0.78, 1);
  cy(furnace, 0.46, 0.52, 0.22, '#8a6a3a', 0, 1.62, 0, { seg: 16, ol: 0.025 });
  const lid = ball(furnace, 0.5, '#8a6a3a', 0, 1.84, 0, { ol: 0.03 });
  lid.scale.set(1, 0.45, 1);
  ball(furnace, 0.12, '#6f5a3a', 0, 2.1, 0, { ol: 0.015 });
  for (const sx of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.04, 6, 12), toon('#6f5a3a'));
    ear.position.set(sx * 0.82, 1.35, 0);
    ear.rotation.y = Math.PI / 2;
    addOutline(ear, 0.015);
    furnace.add(ear);
  }
  bx(furnace, 0.5, 0.25, 0.04, '', 0, 0.98, 0.76, { mat: glow('#ff9a4a'), ol: 0.015 });
  const fire = new THREE.Group();
  fire.userData.noBatch = true;
  for (let i = 0; i < 5; i++) {
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.13 - i * 0.012, 0.42, 6), glow(i % 2 ? '#ffd36a' : '#ff8a4a'));
    const a = (i / 5) * Math.PI * 2;
    f.position.set(Math.cos(a) * 0.18, 0.32, Math.sin(a) * 0.18);
    fire.add(f);
  }
  const coals = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.05, 12), glow('#c2452e'));
  coals.position.y = 0.12;
  fire.add(coals);
  furnace.add(fire);
  c.put(furnace, 4.3, 1.7);
  c.circle(4.3, 1.7, 0.95, 2.2);
  const smoke = new Smoke({ color: '#e9eee6', rate: 1.2, life: 4, size: 1.0, rise: 0.6, spread: 0.2, alpha: 0.45 }, scale).set(c.point(4.3, 1.7, 2.2), F.dir(4.3, 1.7));
  out.emitters.push(smoke);
  out.dao.furnace = c.point(4.3, 1.7, 1.6);
  c.spot('alchemy', '炼丹', 2.7, 1.7, 90, 0, c.point(4.3, 1.7, 1.4));
  for (let i = 0; i < 2; i++) {
    const mist = new Smoke({ color: '#ffffff', rate: 1.4, life: 9, size: 3.6, rise: 0.06, spread: 5, alpha: 0.16, max: 30 }, scale).set(c.point(i ? -3 : 3, -1 + i * 4, 0.5), F.dir(0, 1));
    out.emitters.push(mist);
  }

  const { g, TOP } = hall(c, -3.8, {
    wall: '#5a6470',
    column: '#6b3a2e',
    roof: '#2b3236',
    ridge: '#3e4a50',
    floor: '#b9bcb0',
    plaque: plaque('清静', INK, '#e6cf8e', 384, 136),
  });
  const bagua = document.createElement('canvas');
  bagua.width = bagua.height = 256;
  {
    const b = bagua.getContext('2d')!;
    b.fillStyle = '#2b3236';
    b.fillRect(0, 0, 256, 256);
    b.fillStyle = '#e6cf8e';
    b.font = `96px "ZCOOL QingKe HuangYou", serif`;
    b.textAlign = 'center';
    b.textBaseline = 'middle';
    b.fillText('道法', 128, 82);
    b.fillText('自然', 128, 180);
  }
  const btex = new THREE.CanvasTexture(bagua);
  btex.colorSpace = THREE.SRGBColorSpace;
  signPlane(g, btex, 1.5, 1.5, 0, TOP + 1.9, -2.83);
  bx(g, 2.4, 0.8, 0.7, '#6b3a2e', 0, TOP, -2.2, { ol: 0.03 });
  ball(g, 0.2, '#d98a3a', -0.6, TOP + 1.0, -2.2, { ol: 0.02 });
  ball(g, 0.13, '#d98a3a', -0.6, TOP + 1.28, -2.2, { ol: 0.018 });
  cy(g, 0.25, 0.2, 0.2, '#8a6a3a', 0.5, TOP + 0.8, -2.2, { seg: 12, ol: 0.02 });
  c.solid(g, 0, -2.2, 2.4, 0.7, TOP + 0.8);
  for (const x of [-1.6, 1.6]) {
    cy(g, 0.36, 0.4, 0.14, '#c9a36a', x, TOP, 0.4, { seg: 16, ol: 0.025 });
    c.spot('meditate', '打坐修仙', x, -3.8 + 0.4, 180, TOP + sagAt(x, 0.4), c.point(x, -3.4, TOP + 0.5), `dao-meditate-${x}`);
  }

  const crane = new THREE.Group();
  blob(crane, 0.6, '#a0a8a6', 0, 0.2, 0, 0);
  const cb = ball(crane, 0.3, '#f8f8f8', 0, 1.05, 0, { ol: 0.025 });
  cb.scale.set(0.8, 0.7, 1.3);
  const neck = cy(crane, 0.05, 0.06, 0.7, '#f8f8f8', 0, 1.1, 0.25, { seg: 6, ol: 0.015 });
  neck.rotation.x = 0.35;
  ball(crane, 0.09, '#f8f8f8', 0, 1.78, 0.45, { ol: 0.015 });
  ball(crane, 0.05, '#c25959', 0, 1.86, 0.43, { ol: 0.01 });
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.2, 5), toon('#3e4a50'));
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, 1.76, 0.62);
  crane.add(beak);
  for (const x of [-0.08, 0.08]) cy(crane, 0.015, 0.015, 0.5, '#3e4a50', x, 0.5, 0, { seg: 4, ol: false });
  bx(crane, 0.5, 0.05, 0.4, '#2b3236', 0, 1.02, -0.32, { ol: 0.012 });
  c.put(crane, -4.8, 4.4, 30);
  c.circle(-4.8, 4.4, 0.7, 2);

  for (let i = 0; i < 12; i++) {
    const side = i % 2 ? 1 : -1;
    const x = side * (8.6 + rnd() * 3);
    const z = -8 + rnd() * 18;
    const t = pine(rnd, 1.1 + rnd() * 0.6);
    c.put(t, x, z, rnd() * 360);
    c.circle(x, z, 0.35, 99);
  }
  for (let i = 0; i < 8; i++) {
    const r = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5 + rnd() * 0.7, 0), toon(rnd() < 0.5 ? '#a0a8a6' : '#8b9396'));
    addOutline(r, 0.03);
    const holder = new THREE.Group();
    holder.add(r);
    const x = (rnd() < 0.5 ? -1 : 1) * (7.8 + rnd() * 3);
    c.put(holder, x, -6 + rnd() * 14, rnd() * 360, 0.1);
  }
  for (const [x, z] of [[-5.6, -5.8], [5.6, -5.8]] as const) {
    const t = pine(rnd, 0.9);
    c.put(t, x, z, rnd() * 360);
    c.circle(x, z, 0.3, 99);
  }

  out.npcAt.xuanqing = F.spot(-2.7, 2.2, 0);
  const setFire = (k: number) => {
    fire.scale.setScalar(0.7 + k * 1.1);
    smoke.rate = 1.2 + k * 7;
  };
  setFire(0);
  return { setFire, smoke };
}

export function buildSites(root: THREE.Object3D, smokeScale: number): SitesResult {
  const rnd = mulberry32(88);
  const out: SitesResult = {
    sites: [],
    spots: [],
    seats: [],
    colliders: [],
    lots: [],
    paved: [],
    emitters: [],
    flames: [],
    npcAt: {},
    temple: {} as SitesResult['temple'],
    church: {} as SitesResult['church'],
    dao: {} as SitesResult['dao'],
  };
  const t = buildTemple(root, out, rnd, smokeScale);
  out.temple.smoke = t.smoke;
  out.temple.setIncense = (n: number) => {
    t.sticks.children.forEach((s, i) => (s.visible = i < Math.min(n, 14)));
    t.smoke.rate = 1.5 + Math.min(n, 14) * 0.5;
  };
  const ch = buildChurch(root, out, rnd);
  out.church.setCandles = ch.setCandles;
  out.flames.push(...ch.flames);
  const d = buildDao(root, out, rnd, smokeScale);
  out.dao.setFire = d.setFire;
  out.dao.smoke = d.smoke;
  return out;
}
