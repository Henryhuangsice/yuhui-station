import * as THREE from 'three';

export const INK = '#2b3236';
export const DISPLAY_FONT = '"ZCOOL QingKe HuangYou", "PingFang SC", sans-serif';

let gradient: THREE.DataTexture | null = null;
function gradientMap() {
  if (gradient) return gradient;
  gradient = new THREE.DataTexture(new Uint8Array([120, 200, 255]), 3, 1, THREE.RedFormat);
  gradient.minFilter = THREE.NearestFilter;
  gradient.magFilter = THREE.NearestFilter;
  gradient.generateMipmaps = false;
  gradient.needsUpdate = true;
  return gradient;
}

const toonCache = new Map<string, THREE.MeshToonMaterial>();
const glowCache = new Map<string, THREE.MeshBasicMaterial>();

export function toon(color: THREE.ColorRepresentation): THREE.MeshToonMaterial {
  const key = new THREE.Color(color).getHexString();
  let m = toonCache.get(key);
  if (!m) {
    m = new THREE.MeshToonMaterial({ color, gradientMap: gradientMap() });
    toonCache.set(key, m);
  }
  return m;
}

/** Unlit color: lit windows, screens, lamps. */
export function glow(color: THREE.ColorRepresentation): THREE.MeshBasicMaterial {
  const key = new THREE.Color(color).getHexString();
  let m = glowCache.get(key);
  if (!m) {
    m = new THREE.MeshBasicMaterial({ color });
    glowCache.set(key, m);
  }
  return m;
}

export const outlineMat = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide });

const tmpSize = new THREE.Vector3();
const tmpCenter = new THREE.Vector3();

/** Inverted-hull outline: a back-faced copy grown by `t` on every side. */
export function addOutline<T extends THREE.Mesh>(mesh: T, t = 0.035): T {
  const g = mesh.geometry;
  if (!g.boundingBox) g.computeBoundingBox();
  g.boundingBox!.getSize(tmpSize);
  g.boundingBox!.getCenter(tmpCenter);
  if (tmpSize.x < 1e-4 || tmpSize.y < 1e-4 || tmpSize.z < 1e-4) return mesh;
  const o = new THREE.Mesh(g, outlineMat);
  o.scale.set((tmpSize.x + 2 * t) / tmpSize.x, (tmpSize.y + 2 * t) / tmpSize.y, (tmpSize.z + 2 * t) / tmpSize.z);
  o.position.set(tmpCenter.x * (1 - o.scale.x), tmpCenter.y * (1 - o.scale.y), tmpCenter.z * (1 - o.scale.z));
  o.userData.outline = true;
  mesh.add(o);
  return mesh;
}

interface TextOpts {
  bg: string;
  fg: string;
  w?: number;
  h?: number;
  size?: number;
  sub?: string;
  vertical?: boolean;
  border?: string;
}

export function textTexture(text: string, o: TextOpts): THREE.CanvasTexture {
  const w = o.w ?? 512;
  const h = o.h ?? 128;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  g.fillStyle = o.bg;
  g.fillRect(0, 0, w, h);
  if (o.border) {
    g.strokeStyle = o.border;
    g.lineWidth = Math.max(4, Math.min(w, h) * 0.05);
    g.strokeRect(g.lineWidth / 2, g.lineWidth / 2, w - g.lineWidth, h - g.lineWidth);
  }
  g.fillStyle = o.fg;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  if (o.vertical) {
    const chars = [...text];
    const size = o.size ?? Math.min(w * 0.7, (h * 0.86) / chars.length);
    g.font = `${size}px ${DISPLAY_FONT}`;
    const step = (h * 0.9) / chars.length;
    chars.forEach((ch, i) => g.fillText(ch, w / 2, h * 0.05 + step * (i + 0.5)));
  } else {
    const lines = text.split('\n');
    const size = o.size ?? h * (o.sub || lines.length > 1 ? 0.42 : 0.62);
    g.font = `${size}px ${DISPLAY_FONT}`;
    if (lines.length === 1) {
      g.fillText(lines[0], w / 2, o.sub ? h * 0.4 : h * 0.54, w * 0.92);
    } else {
      const step = (h * (o.sub ? 0.58 : 0.7)) / lines.length;
      const top = h * (o.sub ? 0.14 : 0.16);
      lines.forEach((line, i) => g.fillText(line, w / 2, top + step * (i + 0.5), w * 0.9));
    }
    if (o.sub) {
      g.font = `${h * 0.16}px ${DISPLAY_FONT}`;
      g.globalAlpha = 0.85;
      g.fillText(o.sub, w / 2, h * 0.86, w * 0.9);
      g.globalAlpha = 1;
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
