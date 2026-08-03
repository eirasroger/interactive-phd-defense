import { FrontSide, Mesh, type MeshStandardMaterial, type Object3D } from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { collapseToInstances } from './instancing';
import { applyVariance } from './variance';
import { applyWind, type Wind } from './wind';

export interface Planting {
  readonly object: Object3D;
  update(dt: number): void;
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
 *
 * Three things happen on the way in, in an order that matters. The scattered
 * nodes are collapsed into instanced draws, which is what makes density
 * affordable at all; each instance is tinted, which stops a species reading as
 * one plant reprinted; and the wind is patched onto the materials, which is
 * what makes the site read as alive. The tint and the wind both need the
 * instances to exist first, so nothing here reorders.
 */
export function createPlanting(gltf: GLTF): Planting {
  const instanced = collapseToInstances(gltf.scene);

  for (const mesh of instanced.meshes) {
    mesh.castShadow = true;
    // Planting used to receive nothing, which lit every plant identically
    // whatever stood over it. A shrub under a canopy is in shade, and without
    // that it reads as pasted onto the ground rather than growing out of it.
    mesh.receiveShadow = true;

    for (const material of materialsOf(mesh)) {
      // Leaves are single-sided cards in the source asset. Lit from one face
      // only, half of every canopy goes black as the camera moves around it.
      material.side = FrontSide;
      material.shadowSide = FrontSide;
      material.alphaTest = Math.max(material.alphaTest, 0.35);
      material.transparent = false;
      material.depthWrite = true;
      material.needsUpdate = true;
    }
  }

  applyVariance(instanced.meshes);
  const wind: Wind = applyWind(instanced.meshes);

  return {
    object: instanced.object,
    update(dt: number) {
      wind.update(dt);
    },
    // Source geometry, materials and textures belong to the asset cache and are
    // handed out again on every later visit, so none of them are disposed here.
    // The instance buffers and the depth materials are this object's own.
    dispose() {
      wind.dispose();
      instanced.dispose();
    },
  };
}

function materialsOf(mesh: Mesh): MeshStandardMaterial[] {
  return (
    Array.isArray(mesh.material) ? mesh.material : [mesh.material]
  ) as MeshStandardMaterial[];
}
