import { Box3, Matrix4, Mesh, Vector3, type BufferGeometry, type Material, type Object3D } from 'three';

/**
 * Reusable tree templates taken from the planting asset's modelled conifers,
 * which are already loaded before the zone mounts. The woodland billboards use
 * the same meshes.
 */
export interface TreeTemplate {
  readonly name: string;
  /** Unscaled height in metres. */
  readonly height: number;
  /** Unscaled crown radius in metres, used as placement clearance. */
  readonly radius: number;
  readonly triangles: number;
  readonly parts: readonly TreePart[];
}

export interface TreePart {
  readonly geometry: BufferGeometry;
  readonly material: Material;
}

/** Minimum tree height in metres. Shorter plants are understorey. */
const MIN_HEIGHT = 4;

/**
 * Every distinct tree in an asset, tallest first. Deduplicated by geometry,
 * since one tree appears under many node names.
 *
 * Geometry is baked with the world rotation and scale, minus translation, and
 * seated with its base on y = 0. The real size lives in the parent transforms.
 */
export function findTrees(source: Object3D): TreeTemplate[] {
  const seen = new Set<string>();
  const found: TreeTemplate[] = [];
  const world = new Matrix4();

  source.updateMatrixWorld(true);

  for (const node of source.children) {
    const meshes: Mesh[] = [];
    const signature: string[] = [];

    node.traverse((child) => {
      const mesh = child as Mesh;
      if (!mesh.isMesh || Array.isArray(mesh.material)) return;
      meshes.push(mesh);
      signature.push(mesh.geometry.uuid);
    });

    if (meshes.length === 0) continue;

    const key = signature.sort().join('|');
    if (seen.has(key)) continue;
    seen.add(key);

    const parts: TreePart[] = [];
    const bounds = new Box3();
    let triangles = 0;

    for (const mesh of meshes) {
      mesh.updateWorldMatrix(true, false);
      world.copy(mesh.matrixWorld).setPosition(0, 0, 0);

      const geometry = mesh.geometry.clone();
      geometry.applyMatrix4(world);
      geometry.computeBoundingBox();
      if (geometry.boundingBox) bounds.union(geometry.boundingBox);

      triangles += (geometry.index?.count ?? geometry.getAttribute('position').count) / 3;
      parts.push({ geometry, material: mesh.material as Material });
    }

    if (bounds.isEmpty()) continue;

    const size = bounds.getSize(new Vector3());
    if (size.y < MIN_HEIGHT) continue;

    // Base on y = 0, so placing a tree only needs `heightAt`.
    for (const part of parts) {
      part.geometry.translate(0, -bounds.min.y, 0);
      part.geometry.computeBoundingSphere();
    }

    found.push({
      name: node.name,
      height: size.y,
      radius: Math.max(size.x, size.z) / 2,
      triangles: Math.round(triangles),
      parts,
    });
  }

  return found.sort((a, b) => b.height - a.height);
}
