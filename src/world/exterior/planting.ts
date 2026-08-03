import { FrontSide, Mesh, type MeshStandardMaterial, type Object3D } from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';

export interface Planting {
  readonly object: Object3D;
  dispose(): void;
}

/**
 * Trees, hedge and meadow grass, lit rather than baked.
 *
 * Everything else in the exterior arrives with its lighting in a texture. The
 * planting does not, and deliberately: unwrapping and lightmapping thousands of
 * alpha-mapped leaf cards would cost far more than lighting them in the browser,
 * and it would fix them to one sun while the whole point of the rest of the act
 * is that the building can change state.
 *
 * Their contribution to the building is already paid for. They stood in the
 * Blender scene while it baked, so the leaf shadow falling across the brick is
 * in the building's texture even though the leaves casting it are lit here.
 */
export function createPlanting(gltf: GLTF): Planting {
  const object = gltf.scene;
  const materials = new Set<MeshStandardMaterial>();

  object.traverse((child) => {
    const mesh = child as Mesh;
    if (!mesh.isMesh) return;

    mesh.castShadow = true;
    mesh.receiveShadow = false;

    for (const material of materialsOf(mesh)) {
      materials.add(material);
      // Leaves are single-sided cards in the source asset. Lit from one face
      // only, half of every canopy goes black as the camera moves around it.
      material.side = FrontSide;
      material.shadowSide = FrontSide;
      material.alphaTest = Math.max(material.alphaTest, 0.35);
      material.transparent = false;
      material.depthWrite = true;
      material.needsUpdate = true;
    }
  });

  return {
    object,
    // Geometry, materials and textures all belong to the asset cache and are
    // shared with every later visit, so nothing is disposed here.
    dispose() {
      materials.clear();
    },
  };
}

function materialsOf(mesh: Mesh): MeshStandardMaterial[] {
  return (
    Array.isArray(mesh.material) ? mesh.material : [mesh.material]
  ) as MeshStandardMaterial[];
}
