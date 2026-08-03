import { Mesh, MeshStandardMaterial, type Material, type Object3D, type Texture } from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';

export interface Building {
  readonly object: Object3D;
  dispose(): void;
}

/**
 * How hard the baked occlusion bites.
 *
 * Not 1. Occlusion is a visibility term, not a light transport one — it says
 * how much sky a point can see, and says nothing about the light that arrives
 * by bouncing off the ground and the reveals. At full strength the vacant bay
 * went black: it is a recess, so its occlusion is near zero, and the bounce
 * that lit its insulation panels in Blender has no counterpart here.
 */
const OCCLUSION = 0.65;

/**
 * The exterior, lit here rather than painted in Blender.
 *
 * Everything used to arrive as one baked albedo drawn unlit — sun, shadow,
 * bounce and colour flattened into a single map per asset. That map was sharp
 * at exactly one distance, and because nothing was lit, the glazing, the brass
 * screens and the metal cheeks never caught the light.
 *
 * What arrives now is the material itself: tiling brick and concrete on a
 * world-scale UV set, so surface detail is as sharp at the entrance as from the
 * establishing pose, plus one baked occlusion map on a second UV set carrying
 * what real-time light cannot work out — the soffit under the oversail, the
 * window reveals, the undersides of the balcony boxes.
 *
 * **An exterior asset is a hierarchy, not a mesh.** Blender joins each asset
 * into one object carrying a material slot per palette entry, and glTF stores
 * that as one primitive per material, which `GLTFLoader` expands into one child
 * mesh per material. Anything here that reduces an asset to a single mesh keeps
 * one material and silently discards the rest. See `learnings.md` §7e.
 */
export function createBuilding(gltf: GLTF): Building {
  return createBakedPart(gltf.scene);
}

/**
 * One exported object, with every material it carries.
 *
 * Cloned rather than reparented: the GLTF belongs to the asset cache and is
 * handed out again on every later visit to the zone, so its own hierarchy has
 * to stay intact. `Object3D.clone()` copies the tree and shares geometry and
 * materials by reference, which is what makes this cheap.
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
    // The elevation shadows itself: the balcony boxes project 1.45 m and at a
    // 28 degrees sun throw the band across the facade that reads as a real sun.
    // That shading is not in the bake any more, so it has to be cast.
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
 * The top-level objects of an asset — one per object exported from Blender.
 *
 * Not the meshes. The candidates GLB holds four panels and each is a dozen
 * primitives, so traversing to meshes returns nearer fifty objects and loses
 * which panel each belongs to.
 */
export function findParts(gltf: GLTF, expected: number): Object3D[] {
  const parts = [...gltf.scene.children];
  if (parts.length !== expected) {
    throw new Error(`Expected ${expected} objects in asset, found ${parts.length}.`);
  }
  return parts;
}

/**
 * Raises anisotropy on every map the exterior ships.
 *
 * Brick tiles at half a metre per repeat and is read at grazing angles from
 * every pose in the act, which is precisely the case trilinear filtering
 * handles worst — it is also where the facade turned to mush at distance.
 * Applied per zone rather than at load, because it is a quality-tier decision.
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
