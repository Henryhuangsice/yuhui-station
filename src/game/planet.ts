import * as THREE from 'three';

export const R = 34;
export const DEG = Math.PI / 180;
export const UNITS_PER_DEG = R * DEG;

const Y = new THREE.Vector3(0, 1, 0);
const Z = new THREE.Vector3(0, 0, 1);
const tmpM = new THREE.Matrix4();
const tmpQ = new THREE.Quaternion();
const tmpX = new THREE.Vector3();
const tmpZ = new THREE.Vector3();

export function dirFromLatLon(lat: number, lon: number, out = new THREE.Vector3()) {
  const la = lat * DEG;
  const lo = lon * DEG;
  return out.set(Math.cos(la) * Math.sin(lo), Math.sin(la), Math.cos(la) * Math.cos(lo));
}

export function latLonOf(dir: THREE.Vector3) {
  const lat = Math.asin(THREE.MathUtils.clamp(dir.y, -1, 1)) / DEG;
  const lon = Math.atan2(dir.x, dir.z) / DEG;
  return { lat, lon };
}

/** East and south tangents at a surface normal. Local frame is X = east, Y = up, Z = south. */
export function tangentFrame(n: THREE.Vector3) {
  const ref = Math.abs(n.y) > 0.999 ? Z : Y;
  const east = new THREE.Vector3().crossVectors(ref, n).normalize();
  const south = new THREE.Vector3().crossVectors(east, n).normalize();
  return { east, south };
}

export function frameQuat(n: THREE.Vector3, yawDeg = 0, out = new THREE.Quaternion()) {
  const { east, south } = tangentFrame(n);
  tmpM.makeBasis(east, n, south);
  out.setFromRotationMatrix(tmpM);
  if (yawDeg) out.multiply(tmpQ.setFromAxisAngle(Y, yawDeg * DEG));
  return out;
}

export function place<T extends THREE.Object3D>(obj: T, lat: number, lon: number, yawDeg = 0, lift = 0): T {
  const n = dirFromLatLon(lat, lon);
  obj.position.copy(n).multiplyScalar(R + lift);
  frameQuat(n, yawDeg, obj.quaternion);
  return obj;
}

/** Orientation whose local +Y is `up` and local +Z is `fwd` (fwd must be tangent). */
export function quatFromUpForward(up: THREE.Vector3, fwd: THREE.Vector3, out = new THREE.Quaternion()) {
  tmpX.crossVectors(up, fwd).normalize();
  tmpZ.crossVectors(tmpX, up);
  tmpM.makeBasis(tmpX, up, tmpZ);
  return out.setFromRotationMatrix(tmpM);
}

/** Rotation that carries `dir` a surface distance `dist` along tangent `moveDir`. */
export function surfaceStep(dir: THREE.Vector3, moveDir: THREE.Vector3, dist: number, out = new THREE.Quaternion()) {
  tmpX.crossVectors(dir, moveDir);
  if (tmpX.lengthSq() < 1e-10) return out.identity();
  return out.setFromAxisAngle(tmpX.normalize(), dist / R);
}

export function projectTangent(v: THREE.Vector3, up: THREE.Vector3) {
  return v.addScaledVector(up, -v.dot(up));
}

/** How far the ground drops below a flat footprint of the given half-size. */
export function sag(half: number) {
  return (half * half) / (2 * R) + 0.05;
}
