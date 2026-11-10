import * as THREE from 'three';
import { R } from './planet';
import { addOutline, toon } from './toon';
import { mulberry32 } from './noise';

const vert = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
}`;

const frag = /* glsl */ `
uniform float uTime;
varying vec3 vDir;
float hash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float noise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float fbm(vec3 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { s += a * noise(p); p *= 2.07; a *= 0.5; }
  return s;
}
void main() {
  vec3 d = normalize(vDir);
  vec3 q = d * 2.4 + vec3(uTime * 0.006, uTime * 0.002, -uTime * 0.004);
  float w = fbm(q + fbm(q * 1.7) * 0.9);
  vec3 base = vec3(0.459, 0.741, 0.765);
  vec3 deep = vec3(0.392, 0.675, 0.706);
  vec3 light = vec3(0.580, 0.827, 0.835);
  vec3 lighter = vec3(0.737, 0.902, 0.894);
  vec3 col = base;
  col = mix(col, deep, smoothstep(0.37, 0.35, w));
  col = mix(col, light, smoothstep(0.55, 0.565, w));
  col = mix(col, lighter, smoothstep(0.64, 0.655, w));
  gl_FragColor = vec4(col, 1.0);
}`;

export class Sky {
  readonly group = new THREE.Group();
  private mat: THREE.ShaderMaterial;
  private clouds = new THREE.Group();
  private specks: THREE.Points;

  constructor() {
    this.mat = new THREE.ShaderMaterial({
      vertexShader: vert,
      fragmentShader: frag,
      uniforms: { uTime: { value: 0 } },
      side: THREE.BackSide,
      depthWrite: false,
    });
    const dome = new THREE.Mesh(new THREE.SphereGeometry(900, 48, 24), this.mat);
    dome.renderOrder = -10;
    dome.frustumCulled = false;
    this.group.add(dome);

    const rnd = mulberry32(7);
    const n = 520;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const v = new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize().multiplyScalar(R + 18 + rnd() * 160);
      pos.set([v.x, v.y, v.z], i * 3);
    }
    const pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.specks = new THREE.Points(pg, new THREE.PointsMaterial({ color: '#f5fdff', size: 0.35, sizeAttenuation: true, transparent: true, opacity: 0.85, depthWrite: false }));
    this.group.add(this.specks);

    for (let i = 0; i < 9; i++) {
      const c = new THREE.Group();
      const puffs = 3 + Math.floor(rnd() * 3);
      for (let k = 0; k < puffs; k++) {
        const s = 1.3 + rnd() * 1.6;
        const m = new THREE.Mesh(new THREE.IcosahedronGeometry(s, 1), toon('#f8f8f8'));
        m.position.set((k - puffs / 2) * 1.7 + rnd(), rnd() * 0.8, (rnd() - 0.5) * 1.6);
        m.scale.y = 0.62;
        addOutline(m, 0.08);
        c.add(m);
      }
      const dir = new THREE.Vector3(rnd() - 0.5, (rnd() - 0.5) * 1.4, rnd() - 0.5).normalize();
      c.position.copy(dir).multiplyScalar(R + 17 + rnd() * 9);
      c.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      this.clouds.add(c);
    }
    this.group.add(this.clouds);
  }

  update(dt: number, t: number) {
    this.mat.uniforms.uTime.value = t;
    this.clouds.rotation.y += dt * 0.012;
    this.clouds.rotation.x += dt * 0.003;
    this.specks.rotation.y -= dt * 0.004;
  }
}
