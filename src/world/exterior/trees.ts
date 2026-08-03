import { Box3, Matrix4, Mesh, Vector3, type BufferGeometry, type Material, type Object3D } from 'three';

/**
 * The trees the site already has, addressed as reusable templates.
 *
 * **Nothing here downloads, exports or builds a tree.** The planting asset
 * carries fully modelled conifers with their own LOD ladder, they are already
 * in memory before the zone mounts, and the woodland belt already photographs
 * them for its billboards. Everything on the site that needs a tree can be
 * pointed at the same meshes.
 *
 * That is worth stating because the alternative was tried and shipped. The park
 * had a second 25 MB asset of its own — a jacaranda trunk plus loose leaf
 * sprigs, and two Mediterranean olives — from which a canopy was reassembled at
 * runtime by scattering a hundred and ninety sprigs onto an ellipsoidal shell.
 * It cost a second download the size of the first, twelve thousand instances,
 * and it did not work: the shell never lines up with the branch structure it is
 * supposed to be growing from, so every tree read as a sawn-off trunk standing
 * inside a detached cloud of ferns. The olives, whose own sprigs were too small
 * to register at all, read as dead sticks.
 *
 * A modelled tree has its foliage attached to its branches because it grew
 * that way. There is no cheaper source of that than an artist who already did
 * it, and this project has four of them loaded.
 */
export interface TreeTemplate {
  readonly name: string;
  /** Height in metres as the template stands, before it is scaled to a size. */
  readonly height: number;
  /** Crown radius at that height, which is the clearance a placement needs. */
  readonly radius: number;
  readonly triangles: number;
  readonly parts: readonly TreePart[];
}

export interface TreePart {
  readonly geometry: BufferGeometry;
  readonly material: Material;
}

/** Below this a plant is understorey, not a tree. */
const MIN_HEIGHT = 4;

/**
 * Every distinct tree in an asset, tallest first.
 *
 * Deduplicated by the geometries a node draws rather than by name: the same
 * tree is placed a dozen times under a dozen node names, and treating each
 * placement as a species would give a dozen identical templates.
 *
 * The geometry is **rebaked to the origin carrying the node's own rotation and
 * scale**, with its base on y = 0. A glTF node's geometry is in local space and
 * its real size lives in the parent chain's transform, so taking the geometry
 * alone gives a tree at whatever scale the authoring tool happened to use.
 * Dropping only the translation keeps the size and discards the placement,
 * which is the one part a template is replacing.
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

    // Seated on its own base, so a placement is `heightAt` and nothing else.
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
