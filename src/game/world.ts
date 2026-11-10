import * as THREE from 'three';
import { DEG, R, UNITS_PER_DEG, dirFromLatLon, place, sag } from './planet';
import { INK, addOutline, glow, textTexture, toon } from './toon';
import { fbm, mulberry32 } from './noise';
import { boxCollider, circleCollider, type Collider } from './colliders';
import { batchStatic } from './batch';
import { bench, blob, boxGeo, bx, cy, cylGeo, signPlane, tree } from './parts';
import { footprintOnPath, footprintsOverlap, minAbsLat, pathBetween, type Path } from './layout';
import { buildSites, type Paved, type SitesResult } from './sites';
import type { Seat, Spot } from './types';
import type { Smoke } from './fx';
import { NPCS } from '../data/npcs';

export interface WorldInfo {
  colliders: Collider[];
  seats: Seat[];
  spots: Spot[];
  sites: SitesResult['sites'];
  temple: SitesResult['temple'];
  church: SitesResult['church'];
  dao: SitesResult['dao'];
  npcAt: SitesResult['npcAt'];
  emitters: Smoke[];
  flames: THREE.Object3D[];
  gacha: { dir: THREE.Vector3; fwd: THREE.Vector3 };
  mint: THREE.Object3D;
  blinkers: THREE.Object3D[];
  pondDir: THREE.Vector3;
  pondRadius: number;
  report: string[];
}

export const SIGN_TEXT =
  '余晖站夜间便利热饭团关东煮晚安公寓推拿拉面汤熬到天亮钟点房自助洗衣烘干分钟补习班变电所加班大厦按摩酒馆网吧旧书按斤卖今晚不加班广告位盲盒机早班夜班电话亭小卖部冰棍汽水夜校余晖寺大雄宝殿求签云栖观清静道法自然晚钟教堂YUHUISTATIONVA·⇄24H0123456789';

const PALETTE = ['#c9cdc5', '#d6d2c4', '#ebced0', '#a0a8a6', '#ade3d0', '#bcb1a4', '#e9ece4', '#ffd998', '#afe7eb', '#f5fdff'];

function hex(c: string) {
  return new THREE.Color(c);
}

function buildGround(pondDir: THREE.Vector3, pondR: number, paved: Paved[], paths: Path[]) {
  const geo = new THREE.SphereGeometry(R, 288, 180);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const n = new THREE.Vector3();
  const v = new THREE.Vector3();
  const C = {
    road: hex('#5d6b72'),
    curb: hex('#9aa5a3'),
    walk: hex('#c9cfca'),
    walk2: hex('#bfc6c1'),
    plaza: hex('#d6d2c4'),
    plaza2: hex('#c8c3b4'),
    grass: hex('#8cc48c'),
    grass2: hex('#79b47c'),
    dirt: hex('#c9b89a'),
    water: hex('#6fb3c6'),
    shallow: hex('#8ccbd6'),
    sand: hex('#dccfae'),
  };
  const pavedAxes = paved.map((p) => ({
    p,
    X: new THREE.Vector3(1, 0, 0).applyQuaternion(p.frame.quat),
    Z: new THREE.Vector3(0, 0, 1).applyQuaternion(p.frame.quat),
    color: hex(p.color),
    line: hex(p.line),
  }));
  const pathCols = paths.map((p) => ({ p, color: hex(p.color), cos: Math.cos(p.width * DEG) }));
  const out = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    n.fromBufferAttribute(pos, i).normalize();
    const lat = Math.asin(n.y) / DEG;
    const lon = Math.atan2(n.x, n.z) / DEG;
    const a = Math.abs(lat);
    const nz = fbm(n.x * 6 + 11, n.y * 6, n.z * 6);
    const fine = fbm(n.x * 40, n.y * 40, n.z * 40, 2);
    const pd = Math.acos(THREE.MathUtils.clamp(n.dot(pondDir), -1, 1)) / DEG;
    let done = false;
    if (a < 4.0) {
      out.copy(C.road).multiplyScalar(0.97 + fine * 0.06);
      done = true;
    } else if (a < 4.35) {
      out.copy(C.curb);
      done = true;
    } else if (a < 7.4) {
      out.copy(Math.floor((lon * 2.2) % 2) === 0 ? C.walk : C.walk2).lerp(C.walk, 0.5);
      done = true;
    }
    if (!done) {
      for (const z of pavedAxes) {
        if (n.dot(z.p.frame.center) < 0.9) continue;
        v.copy(n).sub(z.p.frame.center).multiplyScalar(R);
        const lx = v.dot(z.X) - z.p.x;
        const lz = v.dot(z.Z) - z.p.z;
        if (Math.abs(lx) < z.p.hx && Math.abs(lz) < z.p.hz) {
          const fx = ((lx / z.p.tile) % 1 + 1) % 1;
          const fz = ((lz / z.p.tile) % 1 + 1) % 1;
          out.copy(fx < 0.06 || fz < 0.06 ? z.line : z.color).multiplyScalar(0.98 + fine * 0.04);
          done = true;
          break;
        }
      }
    }
    if (!done) {
      for (const pc of pathCols) {
        let hit = false;
        for (const pt of pc.p.points) {
          if (n.dot(pt) > pc.cos) {
            hit = true;
            break;
          }
        }
        if (hit) {
          out.copy(pc.color).multiplyScalar(0.96 + fine * 0.08);
          done = true;
          break;
        }
      }
    }
    if (!done) {
      if (lat > 0) {
        const edge = 21 + nz * 12;
        if (lat < edge) out.copy(nz > 0.56 ? C.plaza2 : C.plaza);
        else if (lat < edge + 2.5) out.copy(C.plaza).lerp(C.grass, (lat - edge) / 2.5);
        else out.copy(nz > 0.6 ? C.grass2 : nz < 0.34 ? C.dirt : C.grass);
      } else if (pd < pondR - 1.1) out.copy(C.water);
      else if (pd < pondR) out.copy(C.shallow);
      else if (pd < pondR + 0.9) out.copy(C.sand);
      else out.copy(nz > 0.6 ? C.grass2 : nz < 0.3 ? C.dirt : C.grass);
    }
    colors[i * 3] = out.r;
    colors[i * 3 + 1] = out.g;
    colors[i * 3 + 2] = out.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const mat = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: toon('#ffffff').gradientMap });
  return new THREE.Mesh(geo, mat);
}

interface BuildingSpec {
  name: string;
  lat: number;
  lon: number;
  yaw: number;
  w: number;
  d: number;
  h: number;
  color: string;
  style: 'apt' | 'shop' | 'tower' | 'house';
  sign?: { text: string; bg: string; fg: string; sub?: string };
  vsign?: { text: string; bg: string; fg: string };
  topSign?: { text: string; bg: string; fg: string };
  lit?: number;
}

function building(s: BuildingSpec, rnd: () => number) {
  const g = new THREE.Group();
  const { w, d, h } = s;
  const sink = sag(Math.hypot(w, d) / 2);
  const roof = PALETTE[Math.floor(rnd() * PALETTE.length)];
  bx(g, w, h + sink, d, s.color, 0, -sink, 0, { ol: 0.05 });
  bx(g, w + 0.2, 0.32, d + 0.2, s.style === 'house' ? (rnd() < 0.5 ? '#8f6f5c' : '#b9584a') : roof, 0, h, 0, { ol: 0.04 });

  const lit = s.lit ?? 0.22;
  const shop = s.style === 'shop';
  const fz = d / 2 + 0.03;
  const cols = Math.max(1, Math.floor((w - 0.8) / 1.5));
  const span = (w - 0.8) / cols;
  const y0 = shop ? 3.9 : 1.25;
  const darkWin = toon('#46555c');
  const litWin = glow('#ffd998');
  for (let y = y0; y + 1.1 < h - 0.3; y += 2.5) {
    for (let i = 0; i < cols; i++) {
      const x = -w / 2 + 0.4 + span * (i + 0.5);
      if (!shop && y === y0 && i === cols - 1 && s.style !== 'tower') continue;
      bx(g, 0.86, 1.05, 0.08, '', x, y, fz, { ol: false, mat: rnd() < lit ? litWin : darkWin });
      if (s.style === 'apt' || s.style === 'house') bx(g, 1.0, 0.08, 0.16, '#e8e8e0', x, y - 0.1, fz + 0.04, { ol: 0.02 });
      if (s.style !== 'tower' && rnd() < 0.18) bx(g, 0.66, 0.46, 0.34, '#e8e8e0', x + 0.62, y - 0.5, fz + 0.15, { ol: 0.025 });
    }
    if (s.style === 'apt' && y > y0) {
      bx(g, w - 0.5, 0.12, 0.7, '#e8e8e0', 0, y - 0.62, fz + 0.32, { ol: 0.03 });
      bx(g, w - 0.5, 0.5, 0.06, '#e8e8e0', 0, y - 0.5, fz + 0.64, { ol: 0.025 });
    }
    const sideCols = Math.floor((d - 0.8) / 1.9);
    for (let j = 0; j < sideCols; j++) {
      const z = -d / 2 + 0.4 + ((d - 0.8) / sideCols) * (j + 0.5);
      for (const sx of [-1, 1]) {
        if (rnd() < 0.35) continue;
        bx(g, 0.08, 1.05, 0.8, '', sx * (w / 2 + 0.03), y, z, { ol: false, mat: rnd() < lit ? litWin : darkWin });
      }
    }
    for (let j = 0; j < cols; j++) {
      if (rnd() < 0.5) continue;
      const x = -w / 2 + 0.4 + span * (j + 0.5);
      bx(g, 0.86, 1.05, 0.08, '', x, y, -fz, { ol: false, mat: rnd() < lit ? litWin : darkWin });
    }
  }

  if (shop) {
    bx(g, w * 0.84, 2.3, 0.08, '', 0, 0.15, fz, { ol: false, mat: glow('#d7f1ee') });
    bx(g, w * 0.84 + 0.2, 0.1, 0.12, INK, 0, 2.45, fz + 0.02, { ol: false });
    bx(g, w, 0.78, 0.16, s.sign?.bg ?? '#75B9B5', 0, 2.62, fz + 0.06, { ol: 0.03 });
    const aw = bx(g, w * 0.88, 0.08, 1.2, s.sign?.bg ?? '#75B9B5', 0, 2.38, fz + 0.65, { ol: 0.025 });
    aw.rotation.x = 0.22;
    if (s.sign) signPlane(g, textTexture(s.sign.text, { bg: s.sign.bg, fg: s.sign.fg, sub: s.sign.sub, w: 512, h: 96 }), w * 0.9, 0.72, 0, 3.01, fz + 0.15);
  } else {
    bx(g, 1.15, 2.05, 0.08, '#3e4a50', w / 2 - 1.0, 0, fz, { ol: 0.025 });
    bx(g, 1.5, 0.12, 0.6, '#c9cdc5', w / 2 - 1.0, 0, fz + 0.3, { ol: 0.02 });
    bx(g, 1.6, 0.1, 0.8, s.color, w / 2 - 1.0, 2.2, fz + 0.38, { ol: 0.025 });
  }

  if (s.vsign && h > 6) {
    const vy = Math.min(h - 3.2, 4.2);
    bx(g, 0.18, 2.8, 0.78, s.vsign.bg, -w / 2 + 0.25, vy, fz + 0.5, { ol: 0.03 });
    const tex = textTexture(s.vsign.text, { bg: s.vsign.bg, fg: s.vsign.fg, vertical: true, w: 128, h: 448 });
    signPlane(g, tex, 0.7, 2.6, -w / 2 + 0.15, vy + 1.4, fz + 0.5, -Math.PI / 2);
    signPlane(g, tex, 0.7, 2.6, -w / 2 + 0.35, vy + 1.4, fz + 0.5, Math.PI / 2);
  }
  if (s.topSign) {
    bx(g, w * 0.7, 1.3, 0.2, s.topSign.bg, 0, h + 0.3, d / 2 - 0.3, { ol: 0.035 });
    signPlane(g, textTexture(s.topSign.text, { bg: s.topSign.bg, fg: s.topSign.fg, w: 512, h: 128 }), w * 0.66, 1.2, 0, h + 0.95, d / 2 - 0.19);
  }

  const props = Math.floor(rnd() * 3) + 1;
  for (let i = 0; i < props; i++) {
    const px = (rnd() - 0.5) * (w - 1.6);
    const pz = (rnd() - 0.5) * (d - 1.6);
    const k = rnd();
    if (k < 0.4) {
      bx(g, 0.9, 0.6, 0.65, '#d6d2c4', px, h + 0.32, pz, { ol: 0.03 });
      cy(g, 0.22, 0.22, 0.04, '#46555c', px, h + 0.92, pz, { ol: 0.015 });
    } else if (k < 0.7 && h > 6) {
      for (const lx of [-0.45, 0.45]) for (const lz of [-0.45, 0.45]) bx(g, 0.08, 0.9, 0.08, '#647A87', px + lx, h + 0.32, pz + lz, { ol: 0.015 });
      cy(g, 0.72, 0.72, 1.35, '#ade3d0', px, h + 1.22, pz, { seg: 14, ol: 0.04 });
      cy(g, 0.75, 0.2, 0.35, '#ade3d0', px, h + 2.57, pz, { seg: 14, ol: 0.03 });
    } else {
      cy(g, 0.035, 0.035, 2.4, '#647A87', px, h + 0.32, pz, { ol: 0.015 });
      bx(g, 0.9, 0.04, 0.04, '#647A87', px, h + 2.2, pz, { ol: 0.012 });
      bx(g, 0.6, 0.04, 0.04, '#647A87', px, h + 1.9, pz, { ol: 0.012 });
    }
  }
  return g;
}

function gachaMachine() {
  const g = new THREE.Group();
  bx(g, 1.3, 1.05, 1.0, '#c25959', 0, 0, 0, { ol: 0.04 });
  bx(g, 1.34, 0.12, 1.04, '#f8f8f8', 0, 0.9, 0, { ol: 0.02 });
  bx(g, 0.4, 0.26, 0.06, '#2b3236', -0.32, 0.12, 0.5, { ol: 0.015 });
  const knob = cy(g, 0.15, 0.15, 0.1, '#f8f8f8', 0.3, 0.38, 0.5, { seg: 14, ol: 0.02 });
  knob.rotation.x = Math.PI / 2;
  knob.position.set(0.3, 0.45, 0.55);
  bx(g, 0.24, 0.05, 0.05, '#2b3236', 0.3, 0.43, 0.61, { ol: false });
  const colors = ['#f3c258', '#66BDE6', '#ebced0', '#8cc48c', '#de794e', '#f8f8f8', '#c25959', '#ade3d0', '#ffd998'];
  for (let i = 0; i < 11; i++) {
    const a = i * 2.4;
    const r = 0.18 + (i % 3) * 0.1;
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), toon(colors[i % colors.length]));
    b.position.set(Math.cos(a) * r, 1.28 + Math.floor(i / 4) * 0.2, Math.sin(a) * r);
    addOutline(b, 0.02);
    g.add(b);
  }
  cy(g, 0.42, 0.5, 0.16, '#c25959', 0, 1.02, 0, { seg: 18, ol: 0.03 });
  const globeMat = new THREE.MeshToonMaterial({ color: '#d8f3f1', transparent: true, opacity: 0.4, depthWrite: false });
  const globe = new THREE.Mesh(new THREE.SphereGeometry(0.62, 22, 16), globeMat);
  globe.position.set(0, 1.66, 0);
  globe.userData.noBatch = true;
  const gol = new THREE.Mesh(globe.geometry, new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide }));
  gol.scale.setScalar(1.06);
  globe.add(gol);
  g.add(globe);
  cy(g, 0.36, 0.42, 0.22, '#c25959', 0, 2.2, 0, { seg: 18, ol: 0.03 });
  const light = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), glow('#ffd998'));
  light.position.set(0, 2.52, 0);
  light.userData.noBatch = true;
  light.userData.blink = 1.3;
  g.add(light);
  signPlane(g, textTexture('盲盒机', { bg: '#c25959', fg: '#f8f8f8', w: 256, h: 80 }), 0.95, 0.3, -0.05, 0.68, 0.505);
  return { g, light };
}

function vending(accent: string) {
  const g = new THREE.Group();
  bx(g, 1.05, 2.0, 0.85, '#f5fdff', 0, 0, 0, { ol: 0.04 });
  bx(g, 1.07, 0.26, 0.87, accent, 0, 1.72, 0, { ol: 0.02 });
  bx(g, 0.8, 1.05, 0.04, '', 0, 0.75, 0.43, { ol: 0.015, mat: glow('#d9f2f6') });
  const bottle = ['#c25959', '#f3c258', '#66BDE6', '#8cc48c'];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) bx(g, 0.1, 0.24, 0.04, '', -0.27 + c * 0.18, 0.85 + r * 0.32, 0.46, { ol: false, mat: glow(bottle[(r + c) % 4]) });
  bx(g, 0.7, 0.22, 0.04, '#2b3236', 0, 0.25, 0.43, { ol: false });
  return g;
}

function utilityPole(rnd: () => number) {
  const g = new THREE.Group();
  cy(g, 0.085, 0.11, 6.6, '#8b9396', 0, -0.2, 0, { seg: 8, ol: 0.03 });
  bx(g, 1.5, 0.1, 0.1, '#647A87', 0, 5.9, 0, { ol: 0.02 });
  bx(g, 1.0, 0.08, 0.08, '#647A87', 0, 5.4, 0, { ol: 0.02 });
  for (const x of [-0.65, 0, 0.65]) cy(g, 0.035, 0.035, 0.14, '#f8f8f8', x, 6.0, 0, { ol: 0.01 });
  if (rnd() < 0.4) cy(g, 0.22, 0.22, 0.6, '#a0a8a6', 0.25, 4.3, 0, { seg: 10, ol: 0.025 });
  if (rnd() < 0.5) bx(g, 0.04, 0.5, 0.3, '#f8f6ef', 0, 2.6, 0.12, { ol: 0.015 });
  const anchors = [new THREE.Vector3(-0.65, 6.14, 0), new THREE.Vector3(0, 6.14, 0), new THREE.Vector3(0.65, 6.14, 0)];
  return { g, anchors };
}

function streetLamp() {
  const g = new THREE.Group();
  cy(g, 0.06, 0.08, 4.3, '#647A87', 0, -0.1, 0, { seg: 8, ol: 0.025 });
  bx(g, 0.06, 0.06, 0.95, '#647A87', 0, 4.1, 0.42, { ol: 0.015 });
  bx(g, 0.3, 0.16, 0.5, '#2b3236', 0, 3.98, 0.85, { ol: 0.02 });
  bx(g, 0.22, 0.03, 0.4, '', 0, 3.95, 0.85, { ol: false, mat: glow('#fff1c4') });
  return g;
}

function pushWire(points: number[], a: THREE.Vector3, b: THREE.Vector3, sagAmt: number) {
  const up = a.clone().add(b).normalize();
  const steps = 10;
  let prev = a.clone();
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const p = a.clone().lerp(b, t).addScaledVector(up, -Math.sin(Math.PI * t) * sagAmt);
    points.push(prev.x, prev.y, prev.z, p.x, p.y, p.z);
    prev = p;
  }
}

/** Named shops sit in a few scattered pockets, not one ring along the road. */
const SHOPS: BuildingSpec[] = [
  // 站台北侧：小夜市街
  { name: '夜间便利', lat: 13.6, lon: 16, yaw: -12, w: 7, d: 5, h: 4.4, color: '#e9ece4', style: 'shop', sign: { text: '夜间便利', sub: '24H · 热饭团 · 关东煮', bg: '#75B9B5', fg: '#f8f8f8' } },
  { name: '晚安公寓', lat: 22, lon: 4, yaw: -48, w: 6, d: 6, h: 9.5, color: '#c9cdc5', style: 'apt', vsign: { text: '晚安公寓', bg: '#c25959', fg: '#f8f8f8' } },
  { name: '推拿', lat: 29, lon: 24, yaw: 55, w: 5, d: 6, h: 12, color: '#ebced0', style: 'apt', vsign: { text: '推拿', bg: '#f3c258', fg: INK } },

  // 东北坡：拉面巷，藏在高处
  { name: '拉面', lat: 24, lon: 62, yaw: -28, w: 6, d: 5, h: 5.2, color: '#de794e', style: 'shop', sign: { text: '拉面', sub: '汤熬到天亮', bg: '#2b3236', fg: '#ffd998' } },
  { name: '黄色小楼', lat: 33, lon: 46, yaw: 70, w: 5, d: 5, h: 6, color: '#ffd998', style: 'house' },
  { name: '灰公寓', lat: 37, lon: 72, yaw: -15, w: 6, d: 6, h: 11, color: '#c9cdc5', style: 'apt' },

  // 东岸：洗衣与补习，离马路更远
  { name: '自助洗衣', lat: 18.5, lon: 132, yaw: 18, w: 7, d: 5, h: 5, color: '#f5fdff', style: 'shop', sign: { text: '自助洗衣', sub: '烘干 40 分钟', bg: '#488BAA', fg: '#f8f8f8' } },
  { name: '补习班', lat: 28, lon: 152, yaw: -45, w: 6, d: 6, h: 10, color: '#d6d2c4', style: 'apt', vsign: { text: '补习班', bg: '#f8f6ef', fg: '#c25959' } },
  { name: '薄荷公寓', lat: 34, lon: 122, yaw: 25, w: 5, d: 6, h: 8, color: '#ade3d0', style: 'apt' },
  { name: '斜屋', lat: 40, lon: 168, yaw: -80, w: 5, d: 5, h: 7, color: '#afe7eb', style: 'house' },

  // 东南高地：钟点房独栋
  { name: '钟点房', lat: 44, lon: 188, yaw: 20, w: 7, d: 7, h: 15, color: '#a0a8a6', style: 'tower', vsign: { text: '钟点房', bg: '#488BAA', fg: '#f8f8f8' } },

  // 西岸加班区：两栋楼错开，不贴马路
  { name: '加班大厦', lat: 18.5, lon: 242, yaw: -12, w: 9, d: 8, h: 20, color: '#647A87', style: 'tower', lit: 0.62, topSign: { text: '加班大厦', bg: '#2b3236', fg: '#f8f8f8' } },
  { name: '写字楼', lat: 32, lon: 260, yaw: 35, w: 6, d: 6, h: 16, color: '#a0a8a6', style: 'tower', lit: 0.45 },
  { name: '按摩', lat: 25, lon: 278, yaw: -50, w: 6, d: 6, h: 11, color: '#c9cdc5', style: 'apt', vsign: { text: '按摩', bg: '#ebced0', fg: '#c25959' } },

  // 西北夜生活角，对着教堂方向但不成排
  { name: '晚安酒馆', lat: 15.5, lon: 320, yaw: 18, w: 6, d: 5, h: 6, color: '#565c5f', style: 'shop', sign: { text: '晚安酒馆', sub: 'VA · 11', bg: '#2b3236', fg: '#ff8fd6' } },
  { name: '网吧', lat: 29, lon: 336, yaw: -30, w: 6, d: 6, h: 13, color: '#bcb1a4', style: 'tower', vsign: { text: '网吧', bg: '#2b3236', fg: '#7af0ff' } },
  { name: '旧书', lat: 38, lon: 350, yaw: 55, w: 5, d: 5, h: 5, color: '#afe7eb', style: 'shop', sign: { text: '旧书', sub: '按斤卖', bg: '#f3c258', fg: INK } },
  { name: '粉公寓', lat: 41, lon: 318, yaw: -20, w: 6, d: 6, h: 9, color: '#ebced0', style: 'apt' },

  // 南半球几处散点
  { name: '夜校', lat: -22, lon: 250, yaw: 200, w: 7, d: 6, h: 12, color: '#bcb1a4', style: 'apt', vsign: { text: '夜校', bg: '#2b3236', fg: '#ffd998' } },
  { name: '小卖部', lat: -14.5, lon: 38, yaw: 160, w: 4.4, d: 3.6, h: 3.4, color: '#ffd998', style: 'shop', sign: { text: '小卖部', sub: '冰棍 · 汽水', bg: '#c25959', fg: '#f8f8f8' } },
  { name: '南边茶馆', lat: -20, lon: 312, yaw: 210, w: 5.5, d: 4.8, h: 4.6, color: '#d6d2c4', style: 'shop', sign: { text: '茶馆', sub: '深夜也开', bg: '#8cc48c', fg: INK } },
];

export function buildWorld(scene: THREE.Scene, smokeScale: number): WorldInfo {
  const rnd = mulberry32(20261110);
  const root = new THREE.Group();
  const colliders: Collider[] = [];
  const seats: Seat[] = [];
  const blinkers: THREE.Object3D[] = [];
  const lots: Collider[] = [];
  const report: string[] = [];
  const pondDir = dirFromLatLon(-26, 150);
  const pondR = 6.5;

  const S = buildSites(root, smokeScale);
  colliders.push(...S.colliders);
  seats.push(...S.seats);
  lots.push(...S.lots);

  const paths: Path[] = [
    pathBetween([-7.2, 210], [-36.5, 210], 1.05, '#d6cdb8'),
    pathBetween([-7.2, 50], [-40.5, 50], 1.05, '#c9c4b3'),
    pathBetween([7.2, 100], [41.5, 100], 1.05, '#d8cfbd'),
    pathBetween([-7.2, 150], [-18.2, 151], 0.9, '#d8c9a8'),
    pathBetween([-7.2, 300], [-21, 302], 0.9, '#d8c9a8'),
  ];
  scene.add(buildGround(pondDir, pondR, S.paved, paths));

  const soft: Collider[] = [];
  const reserve = (dir: THREE.Vector3, rUnits: number) => lots.push(circleCollider(dir, rUnits, 99));
  const reserveLL = (lat: number, lon: number, rUnits: number) => soft.push(circleCollider(dirFromLatLon(lat, lon), rUnits, 99));
  const fits = (c: Collider, roadClear = 7.8) =>
    minAbsLat(c) >= roadClear &&
    lots.every((l) => !footprintsOverlap(l, c, 0.6)) &&
    soft.every((l) => !footprintsOverlap(l, c, 0.3)) &&
    paths.every((p) => !footprintOnPath(c, p));

  reserve(pondDir, (pondR + 1.2) * UNITS_PER_DEG);
  reserve(dirFromLatLon(90, 0), 6);
  reserve(dirFromLatLon(-90, 0), 5);
  {
    const station = place(new THREE.Object3D(), -8.0, 0, 0);
    station.updateWorldMatrix(true, false);
    lots.push(boxCollider(station, 18, 6, 99));
  }
  for (const n of NPCS) if (n.lat !== undefined && n.lon !== undefined) reserveLL(n.lat, n.lon, 1.6);

  for (const s of SHOPS) {
    const b = place(building(s, rnd), s.lat, s.lon, s.yaw);
    root.add(b);
    b.updateWorldMatrix(true, false);
    const col = boxCollider(b, s.w, s.d, s.h);
    if (minAbsLat(col) < 7.6) report.push(`${s.name} 压到了人行道`);
    lots.forEach((l, i) => footprintsOverlap(l, col, 0.3) && report.push(`${s.name} 和第 ${i} 块占地重叠`));
    for (const [i, p] of paths.entries()) if (footprintOnPath(col, p)) report.push(`${s.name} 压到了第 ${i + 1} 条小路`);
    lots.push(col);
    colliders.push(col);
  }

  {
    const lon = 196;
    const W = 12, D = 8;
    const lat = 7.9 + D / 2 / UNITS_PER_DEG;
    const yard = new THREE.Group();
    const sink = sag(7);
    bx(yard, W, 0.2 + sink, D, '#a0a8a6', 0, -sink, 0, { ol: 0.03 });
    for (let x = -W / 2; x <= W / 2 + 0.01; x += 1.2) for (const z of [-D / 2, D / 2]) bx(yard, 0.08, 1.8, 0.08, '#647A87', x, 0, z, { ol: 0.015 });
    for (let z = -D / 2; z <= D / 2 + 0.01; z += 1.2) for (const x of [-W / 2, W / 2]) bx(yard, 0.08, 1.8, 0.08, '#647A87', x, 0, z, { ol: 0.015 });
    for (const z of [-D / 2, D / 2]) {
      bx(yard, W, 0.07, 0.06, '#647A87', 0, 1.7, z, { ol: 0.015 });
      bx(yard, W, 0.05, 0.05, '#647A87', 0, 0.9, z, { ol: 0.012 });
    }
    for (const x of [-W / 2, W / 2]) {
      bx(yard, 0.06, 0.07, D, '#647A87', x, 1.7, 0, { ol: 0.015 });
      bx(yard, 0.05, 0.05, D, '#647A87', x, 0.9, 0, { ol: 0.012 });
    }
    for (const x of [-3.5, 0, 3.5]) {
      bx(yard, 1.8, 2.0, 1.3, '#a0a8a6', x, 0.2, 0.6, { ol: 0.035 });
      for (let k = -2; k <= 2; k++) bx(yard, 0.08, 1.6, 1.4, '#8b9396', x + k * 0.35, 0.4, 0.6, { ol: 0.012 });
      for (const ix of [-0.5, 0, 0.5]) cy(yard, 0.08, 0.1, 0.7, '#f8f8f8', x + ix, 2.2, 0.6, { seg: 8, ol: 0.015 });
    }
    const pipeA = cy(yard, 0.22, 0.22, W - 1.5, '#de794e', 0, 0, -1.4, { seg: 12, ol: 0.035 });
    pipeA.rotation.z = Math.PI / 2;
    pipeA.position.set(0, 1.0, -1.4);
    for (const x of [-4.5, -1, 2.5]) cy(yard, 0.22, 0.22, 3.0, '#de794e', x, 1.0, -1.4, { seg: 12, ol: 0.035 });
    const pipeB = cy(yard, 0.22, 0.22, 7.5, '#de794e', 0, 0, 0, { seg: 12, ol: 0.035 });
    pipeB.rotation.z = Math.PI / 2;
    pipeB.position.set(-0.8, 4.0, -1.4);
    bx(yard, 4.2, 3.4, 2.4, '#d6d2c4', 3.2, 0.2, -2.6, { ol: 0.04 });
    bx(yard, 0.9, 0.5, 0.1, '', 2.2, 2.2, -1.36, { ol: false, mat: glow('#ffd998') });
    bx(yard, 3.4, 1.0, 0.1, '#f8f6ef', -2.6, 0.8, D / 2 + 0.06, { ol: 0.03 });
    signPlane(yard, textTexture('余晖变电所', { bg: '#f8f6ef', fg: INK, w: 512, h: 150, border: INK }), 3.3, 0.95, -2.6, 1.3, D / 2 + 0.12);
    place(yard, lat, lon, 0);
    root.add(yard);
    yard.updateWorldMatrix(true, false);
    const col = boxCollider(yard, W, D, 2.2);
    lots.forEach((l, i) => footprintsOverlap(l, col, 0.3) && report.push(`变电所和第 ${i} 块占地重叠`));
    colliders.push(col);
    lots.push(col);
  }

  const scatter = (count: number, latMin: number, latMax: number, lonMin: number, lonMax: number, label: string) => {
    let placed = 0;
    for (let tries = 0; tries < 400 && placed < count; tries++) {
      const w = 4 + rnd() * 2.5;
      const d = 4 + rnd() * 2;
      const s: BuildingSpec = {
        name: label,
        lat: latMin + rnd() * (latMax - latMin),
        lon: lonMin + rnd() * (lonMax - lonMin),
        yaw: rnd() * 360,
        w,
        d,
        h: 3.6 + rnd() * 5,
        color: PALETTE[Math.floor(rnd() * PALETTE.length)],
        style: rnd() < 0.7 ? 'house' : 'apt',
        lit: 0.25,
      };
      const b = place(building(s, rnd), s.lat, s.lon, s.yaw);
      b.updateWorldMatrix(true, false);
      const col = boxCollider(b, s.w, s.d, s.h);
      if (!fits(col)) continue;
      root.add(b);
      colliders.push(col);
      lots.push(col);
      placed++;
    }
  };
  scatter(5, 48, 68, 20, 100, '北坡民房');
  scatter(4, 42, 62, 200, 280, '西高坡民房');
  scatter(4, 40, 58, 300, 350, '西北坡民房');
  scatter(5, -16, -34, 270, 340, '南边小村');
  scatter(3, -16, -28, 100, 140, '南边民房');
  scatter(3, -14, -26, 165, 205, '南边民房');
  scatter(3, 24, 40, 165, 200, '东南高地民房');

  const station = { lon: 0, lat: -6.9 };
  {
    const depth = 3.05;
    for (let i = -4; i < 4; i++) {
      const seg = new THREE.Group();
      const sk = sag(1.2);
      bx(seg, 2.04, 0.22 + sk, depth, '#c9cdc5', 0, -sk, 0, { ol: 0.03 });
      bx(seg, 2.04, 0.025, 0.3, '#f3c258', 0, 0.22, depth / 2 - 0.25, { ol: false });
      const lon = station.lon + ((i + 0.5) * 2.04) / UNITS_PER_DEG;
      place(seg, station.lat, lon, 180);
      root.add(seg);
      colliders.push(boxCollider(seg, 2.04, depth, 0.22));
    }
    const shelter = new THREE.Group();
    for (const x of [-3.6, 3.6]) for (const z of [-0.95, 0.55]) cy(shelter, 0.07, 0.07, 2.95, '#647A87', x, -0.2, z, { seg: 8, ol: 0.02 });
    bx(shelter, 8.4, 0.2, 2.7, '#75B9B5', 0, 2.95, -0.15, { ol: 0.04 });
    bx(shelter, 8.5, 0.34, 0.12, '#f8f8f8', 0, 2.85, 1.2, { ol: 0.025 });
    bx(shelter, 6.4, 0.04, 0.14, '', 0, 2.9, 0.4, { ol: false, mat: glow('#fff1c4') });
    bx(shelter, 7.6, 2.1, 0.06, '', 0, 0.62, -1.05, { ol: 0.025, mat: glow('#cdeee9') });
    bx(shelter, 2.4, 1.4, 0.16, '#2b3236', 2.3, 1.0, -0.98, { ol: 0.02 });
    signPlane(shelter, textTexture('今晚不加班', { bg: '#f3c258', fg: INK, sub: '余晖站广告位', w: 384, h: 220 }), 2.25, 1.28, 2.3, 1.7, -0.89);
    place(shelter, station.lat - 0.75, station.lon, 180, 0.22);
    root.add(shelter);
    shelter.updateWorldMatrix(true, false);
    const anchor = (x: number, z: number, w: number, d: number, top: number, bottom?: number) => {
      const p = new THREE.Object3D();
      p.position.set(x, 0, z);
      shelter.add(p);
      const c = boxCollider(p, w, d, top);
      if (bottom !== undefined) c.bottom = bottom;
      colliders.push(c);
      p.removeFromParent();
    };
    anchor(0, -1.05, 7.8, 0.3, 3.2);
    anchor(0, -0.15, 8.4, 2.7, 3.5, 3.05);
    for (const x of [-3.6, 3.6]) anchor(x, 0.55, 0.25, 0.25, 3.2);
    for (const [x, id] of [[-1.8, 'station-w'], [1.8, 'station-e']] as const) {
      const b = bench('#a87a5a');
      b.position.set(x, 0, -0.35);
      shelter.add(b);
      b.updateWorldMatrix(true, false);
      colliders.push(boxCollider(b, 1.7, 0.6, 0.72));
      const p = new THREE.Vector3(0, 0, 0.05).applyMatrix4(b.matrixWorld);
      const dir = p.normalize();
      const fwd = new THREE.Vector3(0, 0, 1).transformDirection(b.matrixWorld);
      fwd.addScaledVector(dir, -fwd.dot(dir)).normalize();
      seats.push({ id, dir, fwd, h: 0.52, occupiedBy: null });
    }

    const board = new THREE.Group();
    for (const x of [-1.4, 1.4]) cy(board, 0.06, 0.06, 2.4, '#647A87', x, 0, 0, { seg: 8, ol: 0.02 });
    bx(board, 3.2, 1.0, 0.14, '#f8f6ef', 0, 1.5, 0, { ol: 0.035 });
    const bt = textTexture('余晖站', { bg: '#f8f6ef', fg: INK, sub: 'YUHUI STATION · 夜班 ⇄ 早班', w: 512, h: 160 });
    signPlane(board, bt, 3.1, 0.95, 0, 2.0, 0.075);
    signPlane(board, bt, 3.1, 0.95, 0, 2.0, -0.075, Math.PI);
    place(board, -9.1, -8.4, 180, 0.22);
    root.add(board);
    colliders.push(boxCollider(board, 3.0, 0.3, 2.6));

    const guide = new THREE.Group();
    cy(guide, 0.08, 0.1, 2.6, '#7a6252', 0, -0.1, 0, { seg: 8, ol: 0.02 });
    bx(guide, 1.55, 1.55, 0.1, '#f8f6ef', 0, 1.55, 0, { ol: 0.03 });
    const guideTex = textTexture('北 · 晚钟教堂\n南 · 余晖寺\n西南 · 云栖观', {
      bg: '#f8f6ef',
      fg: INK,
      w: 384,
      h: 384,
      size: 48,
      sub: '顺着石板路走就到',
      border: INK,
    });
    signPlane(guide, guideTex, 1.45, 1.45, 0, 2.32, 0.06);
    signPlane(guide, guideTex, 1.45, 1.45, 0, 2.32, -0.06, Math.PI);
    place(guide, -8.4, 6.2, 200, 0.22);
    root.add(guide);
    colliders.push(boxCollider(guide, 0.4, 0.4, 3.0));

    for (const [i, lon] of [-12.6, -10.6].entries()) {
      const v = place(vending(i ? '#c25959' : '#488BAA'), -8.9, lon, 180, 0.22);
      root.add(v);
      colliders.push(boxCollider(v, 1.1, 0.9, 2.2));
    }
  }

  const gacha = gachaMachine();
  place(gacha.g, -8.5, 8.8, 180, 0.22);
  root.add(gacha.g);
  colliders.push(boxCollider(gacha.g, 1.4, 1.1, 2.5));
  blinkers.push(gacha.light);
  gacha.g.updateWorldMatrix(true, false);
  const gachaInfo = {
    dir: new THREE.Vector3(0, 0, 1.2).applyMatrix4(gacha.g.matrixWorld).normalize(),
    fwd: new THREE.Vector3(0, 0, 1).applyQuaternion(gacha.g.quaternion),
  };

  const mint = new THREE.Group();
  cy(mint, 0.2, 0.15, 0.3, '#b9785a', 0, 0, 0, { seg: 10, ol: 0.02 });
  for (let i = 0; i < 5; i++) {
    const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(0.13, 0), glow('#c8ffb0'));
    const a = i * 1.26;
    leaf.position.set(Math.cos(a) * 0.1, 0.38 + (i % 2) * 0.1, Math.sin(a) * 0.1);
    mint.add(leaf);
  }
  place(mint, -9.0, 5.0, 180, 0.22);
  mint.userData.noBatch = true;
  mint.visible = false;
  root.add(mint);

  const placeBench = (id: string, lat: number, lon: number, yaw: number) => {
    const b = place(bench(), lat, lon, yaw);
    root.add(b);
    b.updateWorldMatrix(true, false);
    colliders.push(boxCollider(b, 1.7, 0.6, 0.5));
    const p = new THREE.Vector3(0, 0, 0.05).applyMatrix4(b.matrixWorld);
    const dir = p.normalize();
    const fwd = new THREE.Vector3(0, 0, 1).transformDirection(b.matrixWorld);
    fwd.addScaledVector(dir, -fwd.dot(dir)).normalize();
    seats.push({ id, dir, fwd, h: 0.3, occupiedBy: null });
    reserveLL(lat, lon, 2);
  };

  {
    const plaza = new THREE.Group();
    const sk = sag(1.1);
    bx(plaza, 2.2, 0.5 + sk, 2.2, '#c9cdc5', 0, -sk, 0, { ol: 0.035 });
    bx(plaza, 1.9, 0.05, 1.9, '#7a6252', 0, 0.5, 0, { ol: false });
    const t = tree(rnd, 1.25);
    t.position.y = 0.5;
    plaza.add(t);
    place(plaza, 11.5, 2, 0);
    root.add(plaza);
    colliders.push(boxCollider(plaza, 2.2, 2.2, 0.5));
    reserveLL(11.5, 2, 2.5);
    placeBench('plaza-w', 9.4, -4, 10);
    placeBench('plaza-e', 9.4, 7, -10);
  }

  placeBench('walk-45', -8.6, 46, 180);
  placeBench('lin-bench', -8.7, 236.5, 180);
  placeBench('lin-bench-2', -8.7, 241.5, 180);
  placeBench('walk-300', -8.6, 306, 180);
  placeBench('pond', -18.6, 152, 0);
  placeBench('pond-2', -19.2, 160, 10);
  placeBench('village', -22.5, 296, 150);
  placeBench('church-yard', 38.5, 100, -20);

  {
    const booth = new THREE.Group();
    bx(booth, 1.1, 2.4, 1.1, '#c25959', 0, 0, 0, { ol: 0.04 });
    bx(booth, 0.9, 1.6, 0.06, '', 0, 0.5, 0.53, { ol: 0.015, mat: glow('#d9f2f6') });
    bx(booth, 1.2, 0.3, 1.2, '#f8f8f8', 0, 2.4, 0, { ol: 0.025 });
    signPlane(booth, textTexture('电话亭', { bg: '#f8f8f8', fg: '#c25959', w: 256, h: 64 }), 1.0, 0.25, 0, 2.55, 0.61);
    place(booth, -8.8, 92, 180);
    root.add(booth);
    colliders.push(boxCollider(booth, 1.15, 1.15, 2.7));
    reserveLL(-8.8, 92, 1.5);
  }

  const poles: THREE.Vector3[][] = [];
  for (let lon = 7.5; lon < 367; lon += 15) {
    const { g, anchors } = utilityPole(rnd);
    place(g, 6.1, lon, 0);
    root.add(g);
    g.updateWorldMatrix(true, false);
    poles.push(anchors.map((a) => a.clone().applyMatrix4(g.matrixWorld)));
    colliders.push(circleCollider(g.position, 0.14, 7));
  }
  const wirePts: number[] = [];
  for (let i = 0; i < poles.length; i++) {
    const a = poles[i];
    const b = poles[(i + 1) % poles.length];
    for (let k = 0; k < 3; k++) pushWire(wirePts, a[k], b[k], 0.45 + k * 0.05);
  }
  const wireGeo = new THREE.BufferGeometry();
  wireGeo.setAttribute('position', new THREE.Float32BufferAttribute(wirePts, 3));
  scene.add(new THREE.LineSegments(wireGeo, new THREE.LineBasicMaterial({ color: INK })));

  for (let lon = 30; lon < 345; lon += 30) {
    if ([70, 150, 215, 300].some((p) => Math.abs(p - lon) < 4)) continue;
    const l = place(streetLamp(), -6.3, lon, 180);
    root.add(l);
    colliders.push(circleCollider(l.position, 0.12, 5));
  }

  const roadMarks = new THREE.Group();
  for (let lon = 0; lon < 360; lon += 3) {
    for (const lat of [-3.55, 3.55]) {
      const m = new THREE.Mesh(boxGeo(1.1, 0.03, 0.1), toon('#e8e8e0'));
      place(m, lat, lon, 0, 0.01);
      roadMarks.add(m);
    }
  }
  for (let lon = 0; lon < 360; lon += 1.6) {
    for (const lat of [-0.55, 0.55]) {
      const m = new THREE.Mesh(boxGeo(1.0, 0.07, 0.08), toon('#565c5f'));
      place(m, lat, lon, 0, 0.02);
      roadMarks.add(m);
    }
    const s = new THREE.Mesh(boxGeo(0.16, 0.04, 1.05), toon('#7a7064'));
    place(s, 0, lon, 0, 0.005);
    roadMarks.add(s);
  }
  for (const c of [15, 70, 80, 150, 215, 300]) {
    for (let i = -2; i <= 2; i++) {
      const m = new THREE.Mesh(boxGeo(0.5, 0.03, 3.6), toon('#e8e8e0'));
      place(m, 0, c + (i * 0.95) / UNITS_PER_DEG, 0, 0.012);
      roadMarks.add(m);
    }
  }
  for (const lon of [40, 130, 200, 280]) {
    const m = new THREE.Mesh(cylGeo(0.45, 0.45, 0.03, 16), toon('#4a575d'));
    place(m, 2.2, lon, 0, 0.01);
    addOutline(m, 0.02);
    roadMarks.add(m);
  }
  root.add(roadMarks);

  for (let i = 0; i < 7; i++) {
    const c = new THREE.Group();
    cy(c, 0.02, 0.24, 0.55, '#de794e', 0, 0, 0, { seg: 10, ol: 0.02 });
    bx(c, 0.48, 0.05, 0.48, '#de794e', 0, 0, 0, { ol: 0.015 });
    cy(c, 0.13, 0.17, 0.1, '#f8f8f8', 0, 0.22, 0, { seg: 10, ol: false });
    const lon = [190, 203, 66, 112, 246, 318, 166][i];
    place(c, 5.2 + rnd() * 1.4, lon, rnd() * 90);
    root.add(c);
    colliders.push(circleCollider(c.position, 0.25, 0.55));
  }

  {
    const tower = new THREE.Group();
    const H = 15;
    const legDir = new THREE.Vector3();
    const Yax = new THREE.Vector3(0, 1, 0);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const a = new THREE.Vector3(sx * 2.1, -0.3, sz * 2.1);
      const b = new THREE.Vector3(sx * 0.45, H, sz * 0.45);
      legDir.subVectors(b, a);
      const len = legDir.length();
      const leg = new THREE.Mesh(cylGeo(0.09, 0.12, len, 6), toon('#f8f8f8'));
      leg.position.copy(a).add(b).multiplyScalar(0.5);
      leg.quaternion.setFromUnitVectors(Yax, legDir.normalize());
      addOutline(leg, 0.03);
      tower.add(leg);
    }
    for (let y = 2; y < H; y += 2.6) {
      const half = 2.1 - (y / H) * 1.65;
      const color = Math.round(y / 2.6) % 2 ? '#c25959' : '#f8f8f8';
      bx(tower, half * 2, 0.12, 0.1, color, 0, y, half, { ol: 0.02 });
      bx(tower, half * 2, 0.12, 0.1, color, 0, y, -half, { ol: 0.02 });
      bx(tower, 0.1, 0.12, half * 2, color, half, y, 0, { ol: 0.02 });
      bx(tower, 0.1, 0.12, half * 2, color, -half, y, 0, { ol: 0.02 });
    }
    bx(tower, 1.8, 0.18, 1.8, '#c25959', 0, H - 0.1, 0, { ol: 0.03 });
    cy(tower, 0.08, 0.1, 5, '#f8f8f8', 0, H, 0, { seg: 6, ol: 0.02 });
    for (const y of [H + 1.5, H + 3]) bx(tower, 1.4, 0.06, 0.06, '#647A87', 0, y, 0, { ol: 0.015 });
    const dish = cy(tower, 0.6, 0.1, 0.3, '#f8f8f8', 0.9, H - 2, 0, { seg: 14, ol: 0.025 });
    dish.rotation.z = -1.2;
    const red = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), glow('#ff5a4e'));
    red.position.set(0, H + 5.15, 0);
    red.userData.noBatch = true;
    red.userData.blink = 0.9;
    tower.add(red);
    blinkers.push(red);
    const hut = new THREE.Group();
    bx(hut, 2.4, 2.2, 2.0, '#d6d2c4', 0, -0.2, 0, { ol: 0.04 });
    bx(hut, 2.7, 0.2, 2.3, '#647A87', 0, 2.0, 0, { ol: 0.03 });
    bx(hut, 0.8, 1.6, 0.06, '#3e4a50', 0.5, 0, 1.02, { ol: 0.02 });
    bx(hut, 0.6, 0.5, 0.06, '', -0.5, 1.0, 1.02, { ol: 0.015, mat: glow('#ffd998') });
    place(tower, 90, 0, 0);
    root.add(tower);
    colliders.push(boxCollider(tower, 4.4, 4.4, H));
    place(hut, 84.5, 60, 240);
    root.add(hut);
    colliders.push(boxCollider(hut, 2.5, 2.1, 2.2));
  }

  {
    const big = tree(rnd, 2.6);
    place(big, -90, 0, 0, -0.2);
    root.add(big);
    colliders.push(circleCollider(big.position, 0.55, 99));
    for (let i = 0; i < 9; i++) {
      const s = new THREE.Mesh(new THREE.IcosahedronGeometry(0.35 + rnd() * 0.25, 0), toon('#a0a8a6'));
      addOutline(s, 0.03);
      place(s, -84.5 - rnd(), i * 40, rnd() * 90, 0.05);
      root.add(s);
    }
  }

  {
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const d = pondR - 0.4 + rnd() * 0.6;
      const lat = -26 + Math.sin(a) * d;
      const lon = 150 + (Math.cos(a) * d) / Math.cos(26 * DEG);
      if (rnd() < 0.5) {
        const reed = new THREE.Group();
        for (let k = 0; k < 4; k++) cy(reed, 0.025, 0.03, 0.8 + rnd() * 0.5, '#6f9e6f', (rnd() - 0.5) * 0.4, -0.05, (rnd() - 0.5) * 0.4, { seg: 5, ol: 0.012 });
        place(reed, lat, lon, 0);
        root.add(reed);
      } else {
        const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(0.3 + rnd() * 0.3, 0), toon('#a0a8a6'));
        addOutline(rock, 0.025);
        place(rock, lat, lon, rnd() * 180, 0.05);
        root.add(rock);
      }
    }
    for (let i = 0; i < 6; i++) {
      const pad = new THREE.Mesh(cylGeo(0.35, 0.35, 0.02, 12), toon('#6fa86f'));
      addOutline(pad, 0.02);
      place(pad, -26 + (rnd() - 0.5) * 7, 150 + (rnd() - 0.5) * 7, 0, 0.015);
      root.add(pad);
    }
    for (const [lat, lon] of [[-16.8, 136.5], [-16.8, 139.5]]) {
      const p = new THREE.Group();
      bx(p, 1.6, 0.5, 0.8, '#a87a5a', 0, -0.1, 0, { ol: 0.03 });
      const flowers = ['#f3c258', '#ebced0', '#f8f8f8', '#c25959'];
      for (let k = 0; k < 6; k++) {
        const f = new THREE.Mesh(new THREE.IcosahedronGeometry(0.12, 0), toon(flowers[k % 4]));
        f.position.set(-0.6 + k * 0.24, 0.5, (rnd() - 0.5) * 0.4);
        addOutline(f, 0.015);
        p.add(f);
      }
      place(p, lat, lon, 180);
      root.add(p);
      colliders.push(boxCollider(p, 1.6, 0.8, 0.45));
      reserveLL(lat, lon, 1.5);
    }
  }

  const plant = (count: number, latMin: number, latMax: number, make: () => THREE.Object3D, r: number, solid: boolean) => {
    let placed = 0;
    for (let tries = 0; tries < count * 12 && placed < count; tries++) {
      const lat = latMin + rnd() * (latMax - latMin);
      const lon = rnd() * 360;
      const dir = dirFromLatLon(lat, lon);
      const probe = circleCollider(dir, r, 99);
      if (!fits(probe, 8.2)) continue;
      const t = place(make(), lat, lon, rnd() * 360);
      root.add(t);
      if (solid) colliders.push(circleCollider(dir, r * 0.25, 99));
      lots.push(probe);
      placed++;
    }
  };
  plant(26, -11, -30, () => tree(rnd, 0.9 + rnd() * 0.4), 1.4, true);
  plant(55, -30, -84, () => tree(rnd, 0.9 + rnd() * 0.6), 1.5, true);
  plant(40, 24, 80, () => tree(rnd, 0.85 + rnd() * 0.5), 1.4, true);
  plant(45, -10, -82, () => {
    const h = new THREE.Group();
    blob(h, 0.45 + rnd() * 0.3, rnd() < 0.5 ? '#6fa86f' : '#7fb878', 0, 0.2, 0, 0);
    return h;
  }, 0.7, false);
  plant(25, 26, 82, () => {
    const h = new THREE.Group();
    blob(h, 0.45 + rnd() * 0.3, rnd() < 0.5 ? '#6fa86f' : '#7fb878', 0, 0.2, 0, 0);
    return h;
  }, 0.7, false);

  const batched = new THREE.Group();
  scene.add(batched);
  batchStatic(root, batched);

  for (const e of S.emitters) scene.add(e.points);

  return {
    colliders,
    seats,
    spots: S.spots,
    sites: S.sites,
    temple: S.temple,
    church: S.church,
    dao: S.dao,
    npcAt: S.npcAt,
    emitters: S.emitters,
    flames: S.flames,
    gacha: gachaInfo,
    mint,
    blinkers,
    pondDir,
    pondRadius: pondR,
    report,
  };
}
