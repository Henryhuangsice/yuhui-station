import * as THREE from 'three';
import { UNITS_PER_DEG, place } from './planet';
import { addOutline, glow, textTexture, toon } from './toon';
import { boxCollider, updateBoxCollider, type Collider } from './colliders';

const CAR_L = 6;
const CAR_W = 2.3;
const GAP = 0.5;

function car(front: boolean) {
  const g = new THREE.Group();
  const add = (w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number, ol = 0.04) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y + h / 2, z);
    if (ol) addOutline(m, ol);
    g.add(m);
    return m;
  };
  add(CAR_W, 1.1, CAR_L, toon('#75B9B5'), 0, 0.35, 0);
  add(CAR_W, 1.3, CAR_L, toon('#f5fdff'), 0, 1.45, 0);
  add(CAR_W - 0.3, 0.18, CAR_L - 0.4, toon('#a0a8a6'), 0, 2.75, 0, 0.03);
  for (const x of [-1, 1]) {
    add(0.06, 0.8, CAR_L - 0.8, glow('#fff1c4'), x * (CAR_W / 2 + 0.02), 1.7, 0, 0);
    for (let i = -2; i <= 2; i++) add(0.08, 0.86, 0.08, toon('#2b3236'), x * (CAR_W / 2 + 0.03), 1.67, i * 1.05, 0);
  }
  add(CAR_W + 0.04, 0.08, CAR_L + 0.04, toon('#2b3236'), 0, 1.4, 0, 0);
  for (const z of [-CAR_L / 2 + 1, CAR_L / 2 - 1]) {
    add(CAR_W - 0.5, 0.4, 0.9, toon('#565c5f'), 0, 0.05, z, 0.025);
  }
  if (front) {
    add(CAR_W - 0.5, 0.75, 0.06, glow('#fff1c4'), 0, 1.7, CAR_L / 2 + 0.02, 0);
    for (const x of [-0.75, 0.75]) add(0.3, 0.16, 0.06, glow('#ffe9a8'), x, 0.7, CAR_L / 2 + 0.02, 0.015);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.32), new THREE.MeshBasicMaterial({ map: textTexture('夜班 ⇄ 早班', { bg: '#2b3236', fg: '#ffd998', w: 320, h: 72 }) }));
    sign.position.set(0, 2.55, CAR_L / 2 + 0.03);
    g.add(sign);
    const pole = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.0, 0.05), toon('#2b3236'));
    pole.position.set(0, 3.35, 0.6);
    pole.rotation.x = -0.6;
    g.add(pole);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.05, 0.05), toon('#2b3236'));
    bar.position.set(0, 3.75, 0.3);
    g.add(bar);
  }
  return g;
}

export class Tram {
  readonly group = new THREE.Group();
  readonly colliders: Collider[];
  private cars: THREE.Group[];
  private lon = 150;
  private v = 7;
  private wait = 0;
  private stopped = false;
  private cooldown = 0;
  onArrive: (() => void) | null = null;
  onDepart: (() => void) | null = null;

  constructor() {
    this.cars = [car(true), car(false)];
    this.cars.forEach((c) => this.group.add(c));
    this.place();
    this.colliders = this.cars.map((c) => boxCollider(c, CAR_W, CAR_L, 3.0));
  }

  get isStopped() {
    return this.stopped;
  }

  private place() {
    const step = (CAR_L + GAP) / UNITS_PER_DEG;
    this.cars.forEach((c, i) => place(c, 0, this.lon - i * step, 90, 0.08));
  }

  update(dt: number) {
    const VMAX = 7.5;
    const A = 2.2;
    if (this.stopped) {
      this.wait -= dt;
      if (this.wait <= 0) {
        this.stopped = false;
        this.cooldown = 40;
        this.onDepart?.();
      }
    } else {
      const ahead = ((((0 - this.lon) % 360) + 360) % 360) * UNITS_PER_DEG;
      let target = VMAX;
      if (this.cooldown <= 0) target = Math.min(VMAX, Math.sqrt(2 * A * Math.max(0, ahead - 0.05)) + 0.15);
      this.v += THREE.MathUtils.clamp(target - this.v, -A * dt * 1.6, A * dt);
      const move = this.v * dt;
      if (this.cooldown <= 0 && ahead <= move + 0.02) {
        this.lon = 0;
        this.v = 0;
        this.stopped = true;
        this.wait = 8;
        this.onArrive?.();
      } else {
        this.lon += move / UNITS_PER_DEG;
        this.cooldown -= move;
      }
      this.lon = ((this.lon % 360) + 360) % 360;
    }
    this.place();
    this.cars.forEach((c, i) => updateBoxCollider(this.colliders[i], c));
  }
}
