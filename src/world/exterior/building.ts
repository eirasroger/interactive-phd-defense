import { Mesh, MeshStandardMaterial, type Material, type Object3D, type Texture } from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';

export interface Building {
  readonly object: Object3D;
  dispose(): void;
}

/**
 * Baked occlusion strength (0-1). Kept below 1 because occlusion ignores
 * bounce light, so deep recesses such as the vacant bay would go black.
 */
const OCCLUSION = 0.65;

/**
 * The building exterior, lit in real time. Tiling materials use world-scale
 * UVs. A baked occlusion map on a second UV set covers soffits, reveals and
 * balcony undersides. Each asset is a hierarchy with one child mesh per
 * material, so it must be kept whole.
 */
export function createBuilding(gltf: GLTF): Building {
  return createBakedPart(gltf.scene);
}

/**
 * Meshes whose material name starts with `material`. Throws when none match,
 * since callers use this to hide parts. See `learnings.md` §7e.
 */
export function findByMaterial(object: Object3D, material: string): Object3D[] {
  const found: Object3D[] = [];
  object.traverse((child) => {
    const mesh = child as Mesh;
    if (!mesh.isMesh) return;
    const carried = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    if (carried.some((entry) => entry.name.startsWith(material))) found.push(mesh);
  });
  if (found.length === 0) {
    throw new Error(`exterior: no mesh carries a '${material}' material.`);
  }
  return found;
}

/**
 * Clones an exported object with all its materials. Cloning keeps the cached
 * GLTF intact for later visits. Geometry and materials are shared by reference.
 */
export function createBakedPart(source: Object3D): Building {
  const object = source.clone(true);

  let meshes = 0;
  object.traverse((child) => {
    const mesh = child as Mesh;
    if (!mesh.isMesh) return;
    meshes += 1;
    configure(mesh.material);
    mesh.castShadow = true;
    // Balcony boxes cast shadow bands on the facade. This shading is not baked.
    mesh.receiveShadow = true;
  });

  if (meshes === 0) throw new Error(`${source.name || 'exterior part'} contains no mesh.`);
  return { object, dispose() {} };
}

function configure(material: Material | Material[]): void {
  for (const entry of Array.isArray(material) ? material : [material]) {
    if (!(entry instanceof MeshStandardMaterial)) continue;
    if (!entry.aoMap) throw new Error(`${entry.name || 'exterior material'} has no occlusion map.`);

    entry.aoMapIntensity = OCCLUSION;
    entry.envMapIntensity = 1;
  }
}

/**
 * Top-level objects of an asset, one per object exported from Blender. Each
 * can hold many meshes.
 */
export function findParts(gltf: GLTF, expected: number): Object3D[] {
  const parts = [...gltf.scene.children];
  if (parts.length !== expected) {
    throw new Error(`Expected ${expected} objects in asset, found ${parts.length}.`);
  }
  return parts;
}

/**
 * Sets anisotropic filtering on every map, so tiled brick stays sharp at
 * grazing angles. Called per zone because it depends on the quality tier.
 */
export function sharpen(gltf: GLTF, anisotropy: number): void {
  const seen = new Set<Texture>();
  gltf.scene.traverse((child) => {
    const mesh = child as Mesh;
    if (!mesh.isMesh) return;

    for (const entry of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      if (!(entry instanceof MeshStandardMaterial)) continue;
      for (const map of [entry.map, entry.normalMap, entry.roughnessMap, entry.aoMap]) {
        if (!map || seen.has(map)) continue;
        seen.add(map);
        map.anisotropy = anisotropy;
        map.needsUpdate = true;
      }
    }
  });
}
