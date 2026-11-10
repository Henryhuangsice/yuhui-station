import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Bakes every static mesh under `root` into one mesh per material and adds the
 * result to `target`. Subtrees flagged `userData.noBatch` are moved over intact.
 * `target` must have an identity world transform.
 */
export function batchStatic(root: THREE.Object3D, target: THREE.Object3D) {
  root.updateMatrixWorld(true);
  const buckets = new Map<THREE.Material, THREE.BufferGeometry[]>();
  const keep: THREE.Object3D[] = [];

  const visit = (o: THREE.Object3D) => {
    if (o.userData.noBatch) {
      keep.push(o);
      return;
    }
    const mesh = o as THREE.Mesh;
    if (mesh.isMesh && !Array.isArray(mesh.material)) {
      const g = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
      for (const name of Object.keys(g.attributes)) {
        if (name !== 'position' && name !== 'normal') g.deleteAttribute(name);
      }
      g.applyMatrix4(mesh.matrixWorld);
      const list = buckets.get(mesh.material) ?? [];
      list.push(g);
      buckets.set(mesh.material, list);
    }
    for (const c of o.children) visit(c);
  };
  visit(root);

  for (const [mat, list] of buckets) {
    const merged = mergeGeometries(list, false);
    list.forEach((g) => g.dispose());
    if (!merged) continue;
    const m = new THREE.Mesh(merged, mat);
    m.matrixAutoUpdate = false;
    target.add(m);
  }
  for (const k of keep) target.attach(k);
}
