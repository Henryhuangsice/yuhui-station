import * as THREE from 'three';
import { addOutline, glow, toon } from './toon';

export type HairKind = 'short' | 'buns' | 'bob' | 'pony' | 'spiky' | 'bald' | 'topknot';
export type HatKind = 'none' | 'cap' | 'beanie' | 'headphones' | 'straw' | 'helmet' | 'beret' | 'antenna';
export type AccKind = 'none' | 'backpack' | 'satchel' | 'scarf' | 'glasses' | 'apron';

export interface Look {
  skin: string;
  hair: HairKind;
  hairColor: string;
  hat: HatKind;
  hatColor: string;
  jacket: string;
  pants: string;
  shoes: string;
  acc: AccKind;
  accColor: string;
  neon?: string | null;
}

export const DEFAULT_LOOK: Look = {
  skin: '#f1d3bd',
  hair: 'short',
  hairColor: '#2f2a2a',
  hat: 'none',
  hatColor: '#c9cdc5',
  jacket: '#a0a8a6',
  pants: '#565c5f',
  shoes: '#2b3236',
  acc: 'none',
  accColor: '#c9cdc5',
  neon: null,
};

export type Pose = 'stand' | 'sit' | 'kneel' | 'lotus';
export type Gesture = 'none' | 'wave' | 'pray' | 'bow' | 'incense' | 'shake' | 'reach' | 'fan' | 'tap' | 'strike';
export type PropKind = 'incense' | 'tube' | 'candle' | 'fan' | 'mallet' | null;

export interface AnimState {
  speed: number;
  airborne: boolean;
  pose: Pose;
  gesture: Gesture;
  /** Seconds since the current gesture (re)started. */
  gt: number;
}

const geo = new Map<string, THREE.BufferGeometry>();
function g<T extends THREE.BufferGeometry>(key: string, make: () => T): T {
  let v = geo.get(key);
  if (!v) {
    v = make();
    geo.set(key, v);
  }
  return v as T;
}

function part(parent: THREE.Object3D, geometry: THREE.BufferGeometry, color: string, x = 0, y = 0, z = 0, outline = 0.025) {
  const m = new THREE.Mesh(geometry, toon(color));
  m.position.set(x, y, z);
  if (outline) addOutline(m, outline);
  parent.add(m);
  return m;
}

const FAST: Gesture[] = ['tap', 'fan', 'shake', 'wave'];

export class Avatar {
  readonly root = new THREE.Group();
  private model = new THREE.Group();
  private body = new THREE.Group();
  private upper = new THREE.Group();
  private inner = new THREE.Group();
  private legL = new THREE.Group();
  private legR = new THREE.Group();
  private armL = new THREE.Group();
  private armR = new THREE.Group();
  private head = new THREE.Group();
  private prop = new THREE.Group();
  private aura: THREE.Mesh | null = null;
  private propKind: PropKind = null;
  private phase = 0;
  private time = Math.random() * 10;
  onStep: (() => void) | null = null;

  constructor(public look: Look) {
    this.model.scale.setScalar(0.86);
    this.root.add(this.model);
    this.build();
  }

  setLook(look: Look) {
    this.look = look;
    this.model.clear();
    this.body = new THREE.Group();
    this.upper = new THREE.Group();
    this.inner = new THREE.Group();
    this.legL = new THREE.Group();
    this.legR = new THREE.Group();
    this.armL = new THREE.Group();
    this.armR = new THREE.Group();
    this.head = new THREE.Group();
    this.prop = new THREE.Group();
    const kind = this.propKind;
    const aura = this.aura?.userData.color as string | undefined;
    this.aura = null;
    this.propKind = null;
    this.build();
    this.setProp(kind);
    if (aura) this.setAura(aura);
  }

  private build() {
    const L = this.look;
    this.model.add(this.body);

    for (const [leg, x] of [[this.legL, -0.12], [this.legR, 0.12]] as const) {
      leg.position.set(x, 0.62, 0);
      part(leg, g('leg', () => new THREE.CapsuleGeometry(0.1, 0.34, 4, 8)), L.pants, 0, -0.27, 0);
      part(leg, g('shoe', () => new THREE.BoxGeometry(0.19, 0.12, 0.28)), L.shoes, 0, -0.56, 0.04);
      this.body.add(leg);
    }

    this.upper.position.y = 0.62;
    this.inner.position.y = -0.62;
    this.upper.add(this.inner);
    this.body.add(this.upper);

    const torso = part(this.inner, g('torso', () => new THREE.CapsuleGeometry(0.25, 0.28, 4, 10)), L.jacket, 0, 0.93, 0);
    torso.scale.set(1, 1, 0.78);

    if (L.neon) {
      for (const x of [-0.2, 0.2]) {
        const strip = new THREE.Mesh(g('neon', () => new THREE.BoxGeometry(0.035, 0.36, 0.2)), glow(L.neon));
        strip.position.set(x, 0.95, 0.06);
        this.inner.add(strip);
      }
    }

    for (const [arm, x] of [[this.armL, -0.31], [this.armR, 0.31]] as const) {
      arm.position.set(x, 1.18, 0);
      part(arm, g('arm', () => new THREE.CapsuleGeometry(0.075, 0.32, 4, 8)), L.jacket, 0, -0.22, 0);
      part(arm, g('hand', () => new THREE.SphereGeometry(0.075, 10, 8)), L.skin, 0, -0.45, 0);
      this.inner.add(arm);
    }
    this.armL.rotation.z = -0.12;
    this.armR.rotation.z = 0.12;
    this.prop.position.set(0, -0.47, 0.04);
    this.armR.add(this.prop);

    this.head.position.set(0, 1.32, 0);
    this.inner.add(this.head);
    part(this.head, g('neck', () => new THREE.CylinderGeometry(0.07, 0.08, 0.12, 8)), L.skin, 0, 0.02, 0, 0);
    part(this.head, g('head', () => new THREE.SphereGeometry(0.3, 18, 14)), L.skin, 0, 0.3, 0, 0.028);
    const eyeGeo = g('eye', () => new THREE.CapsuleGeometry(0.028, 0.05, 2, 6));
    for (const x of [-0.105, 0.105]) {
      const eye = new THREE.Mesh(eyeGeo, toon('#1d2224'));
      eye.position.set(x, 0.3, 0.272);
      this.head.add(eye);
    }
    const blush = g('blush', () => new THREE.SphereGeometry(0.045, 8, 6));
    for (const x of [-0.17, 0.17]) {
      const b = new THREE.Mesh(blush, toon('#eeb3a3'));
      b.scale.set(1, 0.55, 0.3);
      b.position.set(x, 0.22, 0.25);
      this.head.add(b);
    }

    this.buildHair(L);
    this.buildHat(L);
    this.buildAcc(L);
  }

  private buildHair(L: Look) {
    if (L.hair === 'bald') return;
    const base = part(this.head, g('hair', () => new THREE.SphereGeometry(0.318, 18, 14)), L.hairColor, 0, 0.34, -0.035, 0.026);
    if (L.hair === 'bob') {
      base.scale.set(1.08, 1.02, 1.04);
      base.position.y = 0.31;
    }
    if (L.hair === 'buns') {
      for (const x of [-0.15, 0.15]) part(this.head, g('bun', () => new THREE.SphereGeometry(0.11, 10, 8)), L.hairColor, x, 0.6, -0.06);
    }
    if (L.hair === 'topknot') {
      part(this.head, g('knot', () => new THREE.SphereGeometry(0.13, 10, 8)), L.hairColor, 0, 0.68, -0.04);
      const pin = part(this.head, g('pin', () => new THREE.BoxGeometry(0.34, 0.035, 0.035)), '#c9a36a', 0, 0.7, -0.04, 0.012);
      pin.rotation.z = 0.2;
    }
    if (L.hair === 'pony') {
      part(this.head, g('pony', () => new THREE.SphereGeometry(0.13, 10, 8)), L.hairColor, 0, 0.36, -0.36);
      const tail = part(this.head, g('tail', () => new THREE.CapsuleGeometry(0.07, 0.2, 4, 8)), L.hairColor, 0, 0.18, -0.42);
      tail.rotation.x = 0.4;
    }
    if (L.hair === 'spiky') {
      const cone = g('spike', () => new THREE.ConeGeometry(0.09, 0.2, 6));
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        const s = part(this.head, cone, L.hairColor, Math.cos(a) * 0.16, 0.6, Math.sin(a) * 0.16 - 0.04, 0.02);
        s.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5);
      }
    }
  }

  private buildHat(L: Look) {
    const c = L.hatColor;
    switch (L.hat) {
      case 'cap':
        part(this.head, g('capTop', () => new THREE.SphereGeometry(0.335, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2)), c, 0, 0.36, -0.01);
        part(this.head, g('brim', () => new THREE.BoxGeometry(0.36, 0.035, 0.22)), c, 0, 0.37, 0.3);
        break;
      case 'beanie': {
        const top = part(this.head, g('beanie', () => new THREE.SphereGeometry(0.34, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2)), c, 0, 0.38, -0.02);
        top.scale.y = 1.15;
        part(this.head, g('cuff', () => new THREE.CylinderGeometry(0.345, 0.345, 0.1, 18)), c, 0, 0.4, -0.02);
        part(this.head, g('pom', () => new THREE.SphereGeometry(0.07, 8, 6)), '#f8f8f8', 0, 0.8, -0.02);
        break;
      }
      case 'headphones':
        part(this.head, g('band', () => new THREE.TorusGeometry(0.34, 0.03, 6, 20, Math.PI)), c, 0, 0.32, 0, 0.018);
        for (const x of [-0.33, 0.33]) {
          const cup = part(this.head, g('cup', () => new THREE.CylinderGeometry(0.1, 0.1, 0.08, 12)), c, x, 0.3, 0);
          cup.rotation.z = Math.PI / 2;
        }
        break;
      case 'straw':
        part(this.head, g('strawBrim', () => new THREE.CylinderGeometry(0.55, 0.55, 0.035, 20)), c, 0, 0.46, -0.02);
        part(this.head, g('strawTop', () => new THREE.CylinderGeometry(0.26, 0.3, 0.2, 16)), c, 0, 0.58, -0.02);
        part(this.head, g('strawBand', () => new THREE.CylinderGeometry(0.305, 0.305, 0.05, 16)), '#c25959', 0, 0.5, -0.02, 0);
        break;
      case 'helmet': {
        part(this.head, g('helmet', () => new THREE.SphereGeometry(0.35, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2)), c, 0, 0.35, -0.01);
        part(this.head, g('helmetRim', () => new THREE.CylinderGeometry(0.39, 0.39, 0.04, 18)), c, 0, 0.36, 0.02);
        const lamp = new THREE.Mesh(g('lamp', () => new THREE.BoxGeometry(0.12, 0.07, 0.04)), glow('#ffe9a8'));
        lamp.position.set(0, 0.52, 0.32);
        this.head.add(lamp);
        break;
      }
      case 'beret': {
        const b = part(this.head, g('beret', () => new THREE.SphereGeometry(0.33, 16, 8)), c, 0.04, 0.55, -0.02);
        b.scale.set(1.05, 0.32, 1.05);
        b.rotation.z = -0.25;
        break;
      }
      case 'antenna': {
        part(this.head, g('antStem', () => new THREE.CylinderGeometry(0.015, 0.015, 0.36, 6)), '#647A87', 0.12, 0.78, -0.05, 0.012);
        const ball = new THREE.Mesh(g('antBall', () => new THREE.SphereGeometry(0.055, 10, 8)), glow(L.neon ?? '#ffd998'));
        ball.position.set(0.12, 0.98, -0.05);
        this.head.add(ball);
        break;
      }
      case 'none':
        break;
    }
  }

  private buildAcc(L: Look) {
    const c = L.accColor;
    switch (L.acc) {
      case 'backpack':
        part(this.inner, g('pack', () => new THREE.BoxGeometry(0.44, 0.48, 0.2)), c, 0, 0.98, -0.26);
        part(this.inner, g('flap', () => new THREE.BoxGeometry(0.4, 0.16, 0.04)), '#f8f8f8', 0, 1.06, -0.37, 0.015);
        break;
      case 'satchel': {
        const strap = part(this.inner, g('strap', () => new THREE.BoxGeometry(0.05, 0.75, 0.04)), c, 0, 1.0, 0.2, 0.012);
        strap.rotation.z = 0.75;
        part(this.inner, g('bag', () => new THREE.BoxGeometry(0.28, 0.22, 0.1)), c, 0.28, 0.68, 0.08);
        break;
      }
      case 'scarf': {
        const s = part(this.inner, g('scarf', () => new THREE.TorusGeometry(0.2, 0.07, 8, 16)), c, 0, 1.24, 0, 0.02);
        s.rotation.x = Math.PI / 2;
        part(this.inner, g('scarfEnd', () => new THREE.BoxGeometry(0.12, 0.3, 0.05)), c, 0.1, 1.05, 0.2, 0.015);
        break;
      }
      case 'glasses':
        for (const x of [-0.105, 0.105]) {
          const r = new THREE.Mesh(g('lens', () => new THREE.TorusGeometry(0.07, 0.014, 6, 14)), toon('#1d2224'));
          r.position.set(x, 0.3, 0.29);
          this.head.add(r);
        }
        break;
      case 'apron':
        part(this.inner, g('apron', () => new THREE.BoxGeometry(0.4, 0.62, 0.04)), c, 0, 0.78, 0.2, 0.015);
        break;
      case 'none':
        break;
    }
  }

  setProp(kind: PropKind) {
    if (kind === this.propKind) return;
    this.propKind = kind;
    this.prop.clear();
    const along = (geometry: THREE.BufferGeometry, mat: THREE.Material, z: number, ol = 0.012) => {
      const m = new THREE.Mesh(geometry, mat);
      m.rotation.x = Math.PI / 2;
      m.position.z = z;
      if (ol) addOutline(m, ol);
      this.prop.add(m);
      return m;
    };
    switch (kind) {
      case 'incense':
        for (const x of [-0.04, 0, 0.04]) {
          const s = along(g('incStick', () => new THREE.CylinderGeometry(0.012, 0.012, 0.5, 5)), toon('#b5653a'), 0.2, 0);
          s.position.x = x;
          const tip = new THREE.Mesh(g('incTip', () => new THREE.SphereGeometry(0.025, 6, 5)), glow('#ff7a4a'));
          tip.position.set(x, 0, 0.45);
          this.prop.add(tip);
        }
        break;
      case 'tube':
        along(g('tube', () => new THREE.CylinderGeometry(0.08, 0.07, 0.3, 10)), toon('#c9a36a'), 0.06, 0.015);
        for (const x of [-0.03, 0, 0.03]) {
          const s = along(g('lot', () => new THREE.BoxGeometry(0.018, 0.22, 0.01)), toon('#e6cf8e'), 0.25, 0);
          s.position.x = x;
        }
        break;
      case 'candle': {
        along(g('candle', () => new THREE.CylinderGeometry(0.03, 0.03, 0.16, 8)), toon('#f8f6ef'), 0.07, 0.01);
        const f = new THREE.Mesh(g('flame', () => new THREE.ConeGeometry(0.03, 0.09, 6)), glow('#ffcf6a'));
        f.rotation.x = Math.PI / 2;
        f.position.z = 0.2;
        this.prop.add(f);
        break;
      }
      case 'fan': {
        along(g('fanHandle', () => new THREE.CylinderGeometry(0.015, 0.015, 0.2, 5)), toon('#7a5a42'), 0.08, 0.01);
        const leaf = new THREE.Mesh(g('fanLeaf', () => new THREE.CylinderGeometry(0.17, 0.17, 0.015, 16)), toon('#e6cf8e'));
        leaf.position.z = 0.32;
        addOutline(leaf, 0.012);
        this.prop.add(leaf);
        break;
      }
      case 'mallet':
        along(g('malletStick', () => new THREE.CylinderGeometry(0.018, 0.018, 0.36, 5)), toon('#7a5a42'), 0.14, 0.01);
        part(this.prop, g('malletHead', () => new THREE.SphereGeometry(0.055, 8, 6)), '#7a5a42', 0, 0, 0.34, 0.012);
        break;
      case null:
        break;
    }
  }

  setAura(color: string | null) {
    if (this.aura) {
      this.model.remove(this.aura);
      this.aura = null;
    }
    if (!color) return;
    const m = new THREE.Mesh(
      g('aura', () => new THREE.SphereGeometry(0.75, 18, 14)),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.BackSide }),
    );
    m.position.y = 0.95;
    m.scale.set(0.95, 1.35, 0.95);
    m.userData.color = color;
    this.model.add(m);
    this.aura = m;
  }

  update(dt: number, s: AnimState) {
    this.time += dt;
    const t = this.time;
    const moving = s.speed > 0.05 && !s.airborne && s.pose === 'stand';
    if (moving) {
      const prev = Math.sin(this.phase);
      this.phase += dt * (7 + s.speed * 5);
      const now = Math.sin(this.phase);
      if (prev * now <= 0 && this.onStep) this.onStep();
    } else {
      this.phase *= 0.9;
    }
    const sw = Math.sin(this.phase) * Math.min(1, s.speed) * 0.75;
    const T = { legLx: 0, legRx: 0, legLz: 0, legRz: 0, armLx: 0, armRx: 0, armLz: -0.12, armRz: 0.12, upX: 0, bodyY: 0, bodyZ: 0, headX: 0 };

    switch (s.pose) {
      case 'stand':
        if (s.airborne) {
          T.legLx = -0.6;
          T.legRx = 0.35;
          T.armLx = -0.4;
          T.armRx = 0.6;
          T.bodyY = 0.05;
        } else {
          T.legLx = sw;
          T.legRx = -sw;
          T.armLx = -sw * 0.8;
          T.armRx = sw * 0.8;
          T.bodyY = moving ? Math.abs(Math.cos(this.phase)) * 0.06 * Math.min(1, s.speed) : Math.sin(t * 2.2) * 0.008;
          T.headX = moving ? 0.04 : Math.sin(t * 0.7) * 0.03;
          T.upX = moving ? 0.06 * Math.min(1, s.speed) : 0;
        }
        break;
      case 'sit':
        T.legLx = T.legRx = -1.45;
        T.armLx = T.armRx = -0.5;
        T.bodyY = -0.4;
        T.bodyZ = -0.05;
        T.headX = Math.sin(t * 0.6) * 0.04 + 0.08;
        break;
      case 'kneel':
        T.legLx = T.legRx = 1.2;
        T.bodyY = -0.36;
        T.bodyZ = 0.08;
        T.armLx = T.armRx = -0.3;
        T.headX = 0.05;
        break;
      case 'lotus':
        T.legLx = T.legRx = -1.5;
        T.legLz = -0.75;
        T.legRz = 0.75;
        T.bodyY = -0.46;
        T.armLx = T.armRx = -0.75;
        T.armLz = 0.35;
        T.armRz = -0.35;
        T.headX = 0.03 + Math.sin(t * 0.5) * 0.02;
        break;
    }

    const pray = () => {
      T.armLx = T.armRx = -1.25;
      T.armLz = 0.62;
      T.armRz = -0.62;
    };
    switch (s.gesture) {
      case 'wave':
        T.armRz = 2.5 + Math.sin(t * 14) * 0.25;
        T.armRx = -0.2;
        break;
      case 'pray':
        pray();
        T.headX += 0.22;
        break;
      case 'bow': {
        const k = 0.5 - 0.5 * Math.cos(((s.gt % 2.4) / 2.4) * Math.PI * 2);
        pray();
        const deep = s.pose === 'kneel';
        T.upX = k * (deep ? 1.15 : 0.7);
        T.headX = 0.15 + k * 0.25;
        if (deep) T.armLx = T.armRx = -1.25 - k * 0.75;
        break;
      }
      case 'incense': {
        const k = 0.5 - 0.5 * Math.cos(((s.gt % 1.7) / 1.7) * Math.PI * 2);
        T.armLx = T.armRx = -1.1 - k * 0.55;
        T.armLz = 0.55;
        T.armRz = -0.55;
        T.upX = k * 0.4;
        T.headX = 0.12;
        break;
      }
      case 'shake':
        T.armLx = T.armRx = -1.05 + Math.sin(t * 24) * 0.18;
        T.armLz = 0.5;
        T.armRz = -0.5;
        T.upX = 0.12;
        break;
      case 'reach':
        T.armRx = -1.45;
        T.armRz = -0.15;
        T.armLx = -0.2;
        T.upX = 0.18;
        break;
      case 'fan':
        T.armRx = -1.1;
        T.armRz = -0.35 + Math.sin(t * 16) * 0.5;
        T.armLx = -0.5;
        T.armLz = 0.3;
        T.upX = 0.12;
        break;
      case 'tap': {
        const hit = Math.exp(-s.gt * 12);
        T.armRx = -1.3 + hit * 0.8;
        T.armRz = -0.2;
        T.armLx = -0.9;
        T.armLz = 0.35;
        T.upX = 0.1 + hit * 0.08;
        break;
      }
      case 'strike': {
        const k = s.gt < 0.45 ? s.gt / 0.45 : Math.max(0, 1 - (s.gt - 0.45) / 0.6);
        T.armLx = T.armRx = -1.45;
        T.armLz = 0.3;
        T.armRz = -0.3;
        T.upX = -0.2 + k * 0.5;
        break;
      }
      case 'none':
        break;
    }

    const rate = FAST.includes(s.gesture) ? 30 : 14;
    const k = 1 - Math.exp(-dt * rate);
    const kb = 1 - Math.exp(-dt * 12);
    this.legL.rotation.x += (T.legLx - this.legL.rotation.x) * kb;
    this.legR.rotation.x += (T.legRx - this.legR.rotation.x) * kb;
    this.legL.rotation.z += (T.legLz - this.legL.rotation.z) * kb;
    this.legR.rotation.z += (T.legRz - this.legR.rotation.z) * kb;
    this.armL.rotation.x += (T.armLx - this.armL.rotation.x) * k;
    this.armR.rotation.x += (T.armRx - this.armR.rotation.x) * k;
    this.armL.rotation.z += (T.armLz - this.armL.rotation.z) * k;
    this.armR.rotation.z += (T.armRz - this.armR.rotation.z) * k;
    this.upper.rotation.x += (T.upX - this.upper.rotation.x) * kb;
    this.head.rotation.x += (T.headX - this.head.rotation.x) * kb;
    this.body.position.y += (T.bodyY - this.body.position.y) * kb;
    this.body.position.z += (T.bodyZ - this.body.position.z) * kb;
    if (this.aura) {
      const a = this.aura.material as THREE.MeshBasicMaterial;
      a.opacity = 0.18 + Math.sin(t * 2.4) * 0.06;
    }
  }
}

let portraitRenderer: THREE.WebGLRenderer | null = null;
const portraitScene = new THREE.Scene();
const portraitCam = new THREE.PerspectiveCamera(30, 0.8, 0.1, 20);

export function renderPortrait(look: Look, w = 320, h = 400): string {
  if (!portraitRenderer) {
    portraitRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    portraitRenderer.setPixelRatio(1);
    portraitScene.add(new THREE.AmbientLight('#ffffff', 1.3));
    const d = new THREE.DirectionalLight('#ffffff', 2.2);
    d.position.set(1.5, 3, 2.5);
    portraitScene.add(d);
  }
  portraitRenderer.setSize(w, h, false);
  portraitCam.aspect = w / h;
  portraitCam.updateProjectionMatrix();
  const a = new Avatar(look);
  a.root.rotation.y = -0.45;
  for (let i = 0; i < 20; i++) a.update(0.05, { speed: 0, airborne: false, pose: 'stand', gesture: 'none', gt: 0 });
  portraitScene.add(a.root);
  portraitCam.position.set(0.4, 1.15, 4.4);
  portraitCam.lookAt(0, 0.85, 0);
  portraitRenderer.setClearColor(0x000000, 0);
  portraitRenderer.render(portraitScene, portraitCam);
  portraitScene.remove(a.root);
  return portraitRenderer.domElement.toDataURL('image/png');
}
