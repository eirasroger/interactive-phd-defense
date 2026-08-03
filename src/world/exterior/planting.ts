import {
  Box3,
  FrontSide,
  Matrix4,
  Mesh,
  Quaternion,
  Vector3,
  type MeshStandardMaterial,
  type Object3D,
} from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { CanopyField } from './canopy';
import { collapseToInstances } from './instancing';
import { inBeds, plantable } from './paths';
import { BED_TOP } from './realm';
import { seatAt } from './terrain';
import { applyVariance } from './variance';
import { applyWind, type Wind } from './wind';

export interface Planting {
  readonly object: Object3D;
  update(dt: number): void;
  dispose(): void;
}

export interface PlantingInputs {
  /** Trees register here so the ground under them can know they are there. */
  readonly canopy: CanopyField;
}

/** Above this a plant is a tree, and the ground under it changes. */
const TREE = 4;

/**
 * How much clear ground a plant is asked for, as a fraction of its own radius.
 *
 * Under one, so a canopy overhangs a walk while the trunk stays out of it —
 * which is what an avenue is for. Ground cover gets almost nothing, which is
 * correct: a grass tuft at the very edge of the gutter is what a real verge
 * looks like.
 */
const CLEAR = 0.45;

/** Beyond this a footprint is worth seating on its lowest point, not its centre. */
const BROAD = 0.4;

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
 * **The asset's vertical is discarded on the way in.** `scatter_planting` sets
 * every plant at z = 0.05 on a level Blender floor, and the ground it arrives on
 * rolls between −4.6 m and +7.5 m — so the whole scatter was hanging at datum,
 * a metre in the air across half the park and buried to the crown across the
 * other half. It also knew nothing about the paving, the playground or the
 * building's plate, all of which are built here and none of which exist in the
 * Blender scene at all.
 *
 * That is not a bug in the asset. An exported scatter is a **plan**: which
 * plant, where in x and z, how big, which way round. Everything that depends on
 * the terrain has to be decided against the terrain, and the terrain lives here.
 * Duplicating `heightAt` into the Blender script so the export could seat itself
 * would be two descriptions of one landform, which is `learnings.md` §7f in the
 * vertical.
 *
 * Three things then happen, in an order that matters. The kept nodes are
 * collapsed into instanced draws, which is what makes density affordable at all;
 * each instance is tinted, which stops a species reading as one plant reprinted;
 * and the wind is patched onto the materials, which is what makes the site read
 * as alive. The tint and the wind both need the instances to exist first, so
 * nothing here reorders.
 */
export function createPlanting(gltf: GLTF, { canopy }: PlantingInputs): Planting {
  const position = new Vector3();
  const spin = new Quaternion();
  const scale = new Vector3();

  const instanced = collapseToInstances(gltf.scene, (matrix: Matrix4, bounds: Box3) => {
    matrix.decompose(position, spin, scale);

    const { x, z } = position;
    const height = bounds.max.y * scale.y;
    const radius =
      Math.max(bounds.max.x - bounds.min.x, bounds.max.z - bounds.min.z) * 0.5 * scale.x;

    if (!plantable(x, z, radius * CLEAR)) return false;

    // The entrance beds are built ground, so their planting stands on the bed
    // rather than on the terrain 14 cm below the forecourt it is cut into.
    position.y = inBeds(x, z)
      ? BED_TOP - 0.03
      : seatAt(x, z, radius > BROAD ? Math.min(radius, 1.6) : 0);
    matrix.compose(position, spin, scale);

    if (height >= TREE) canopy.add(x, z, radius);
    return true;
  });

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
