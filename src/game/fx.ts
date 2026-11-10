import * as THREE from 'three';
import { glow } from './toon';

const vert = /* glsl */ `
attribute float aSize;
attribute float aAlpha;
uniform float uScale;
varying float vAlpha;
void main() {
  vAlpha = aAlpha;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * uScale / max(0.1, -mv.z);
  gl_Position = projectionMatrix * mv;
}`;

const frag = /* glsl */ `
uniform vec3 uColor;
varying float vAlpha;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  if (d > 0.5) discard;
  float edge = smoothstep(0.5, 0.42, d);
  gl_FragColor = vec4(uColor, edge * vAlpha);
}`;

interface Particle {
  p: THREE.Vector3;
  v: THREE.Vector3;
  life: number;
  max: number;
  size: number;
}

export interface SmokeOpts {
  color: string;
  rate: number;
  life: number;
  size: number;
  rise: number;
  spread: number;
  alpha: number;
  max?: number;
}

/** CPU point-sprite emitter that drifts "up" along the local planet normal. */
export class Smoke {
  readonly points: THREE.Points;
  readonly origin = new THREE.Vector3();
  readonly up = new THREE.Vector3(0, 1, 0);
  rate: number;
  private parts: Particle[] = [];
  private acc = 0;
  private geo = new THREE.BufferGeometry();
  private pos: Float32Array;
  private size: Float32Array;
  private alpha: Float32Array;
  private max: number;
  private side = new THREE.Vector3();
  private side2 = new THREE.Vector3();

  constructor(private o: SmokeOpts, scale: number) {
    this.rate = o.rate;
    this.max = o.max ?? 80;
    this.pos = new Float32Array(this.max * 3);
    this.size = new Float32Array(this.max);
    this.alpha = new Float32Array(this.max);
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    this.geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1));
    const mat = new THREE.ShaderMaterial({
      vertexShader: vert,
      fragmentShader: frag,
      uniforms: { uColor: { value: new THREE.Color(o.color) }, uScale: { value: scale } },
      transparent: true,
      depthWrite: false,
    });
    this.points = new THREE.Points(this.geo, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 2;
  }

  set(origin: THREE.Vector3, up: THREE.Vector3) {
    this.origin.copy(origin);
    this.up.copy(up).normalize();
    const ref = Math.abs(this.up.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
    this.side.crossVectors(ref, this.up).normalize();
    this.side2.crossVectors(this.up, this.side).normalize();
    return this;
  }

  burst(n: number) {
    for (let i = 0; i < n; i++) this.spawn(2.5);
  }

  private spawn(kick = 1) {
    if (this.parts.length >= this.max) return;
    const o = this.o;
    const a = Math.random() * Math.PI * 2;
    const r = Math.random() * o.spread;
    const p = this.origin.clone().addScaledVector(this.side, Math.cos(a) * r).addScaledVector(this.side2, Math.sin(a) * r);
    const v = this.up
      .clone()
      .multiplyScalar(o.rise * (0.7 + Math.random() * 0.6) * kick)
      .addScaledVector(this.side, (Math.random() - 0.5) * 0.3 * kick)
      .addScaledVector(this.side2, (Math.random() - 0.5) * 0.3 * kick);
    this.parts.push({ p, v, life: 0, max: o.life * (0.7 + Math.random() * 0.6), size: o.size * (0.7 + Math.random() * 0.6) });
  }

  update(dt: number, t: number) {
    this.acc += dt * this.rate;
    while (this.acc > 1) {
      this.acc -= 1;
      this.spawn();
    }
    let n = 0;
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const q = this.parts[i];
      q.life += dt;
      if (q.life >= q.max) {
        this.parts.splice(i, 1);
        continue;
      }
      q.p.addScaledVector(q.v, dt);
      q.p.addScaledVector(this.side, Math.sin(t * 1.3 + i) * dt * 0.12);
      q.v.multiplyScalar(1 - dt * 0.35);
    }
    for (const q of this.parts) {
      const k = q.life / q.max;
      this.pos[n * 3] = q.p.x;
      this.pos[n * 3 + 1] = q.p.y;
      this.pos[n * 3 + 2] = q.p.z;
      this.size[n] = q.size * (0.6 + k * 1.2);
      this.alpha[n] = this.o.alpha * Math.min(1, k * 6) * (1 - k);
      n++;
    }
    this.geo.setDrawRange(0, n);
    (this.geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (this.geo.attributes.aSize as THREE.BufferAttribute).needsUpdate = true;
    (this.geo.attributes.aAlpha as THREE.BufferAttribute).needsUpdate = true;
  }
}

interface Transient {
  obj: THREE.Object3D;
  t: number;
  dur: number;
  tick: (k: number, obj: THREE.Object3D) => void;
}

/** Short-lived effects: bell rings, rising wish lights, flying pills. */
export class Effects {
  readonly group = new THREE.Group();
  private list: Transient[] = [];
  private ringGeo = new THREE.RingGeometry(0.85, 1, 40);
  private orbGeo = new THREE.SphereGeometry(0.16, 12, 10);

  ring(at: THREE.Vector3, normal: THREE.Vector3, color = '#fff1c4', size = 5) {
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false });
    const m = new THREE.Mesh(this.ringGeo, mat);
    m.position.copy(at);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
    this.add(m, 1.6, (k, o) => {
      o.scale.setScalar(0.3 + k * size);
      mat.opacity = 0.8 * (1 - k);
    });
  }

  orb(from: THREE.Vector3, up: THREE.Vector3, color = '#fff1c4', height = 9, dur = 3.5) {
    const m = new THREE.Mesh(this.orbGeo, glow(color).clone());
    const mat = m.material as THREE.MeshBasicMaterial;
    mat.transparent = true;
    this.add(m, dur, (k, o) => {
      o.position.copy(from).addScaledVector(up, k * height).addScaledVector(new THREE.Vector3(1, 0, 0), Math.sin(k * 9) * 0.15);
      o.scale.setScalar(1 + Math.sin(k * 20) * 0.15 - k * 0.5);
      mat.opacity = 1 - k * k;
    });
  }

  arc(from: THREE.Vector3, to: () => THREE.Vector3, up: THREE.Vector3, color: string, dur = 0.8, done?: () => void) {
    const m = new THREE.Mesh(this.orbGeo, glow(color));
    m.scale.setScalar(0.8);
    this.add(
      m,
      dur,
      (k, o) => {
        o.position.copy(from).lerp(to(), k).addScaledVector(up, Math.sin(k * Math.PI) * 2.2);
      },
      done,
    );
  }

  private add(obj: THREE.Object3D, dur: number, tick: Transient['tick'], done?: () => void) {
    this.group.add(obj);
    const entry: Transient = { obj, t: 0, dur, tick };
    tick(0, obj);
    this.list.push(entry);
    if (done) entry.tick = ((orig) => (k: number, o: THREE.Object3D) => {
      orig(k, o);
      if (k >= 1) done();
    })(tick);
  }

  update(dt: number) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const e = this.list[i];
      e.t += dt;
      const k = Math.min(1, e.t / e.dur);
      e.tick(k, e.obj);
      if (k >= 1) {
        this.group.remove(e.obj);
        this.list.splice(i, 1);
      }
    }
  }
}
