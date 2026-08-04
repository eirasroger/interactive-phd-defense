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
import { inBeds, inReviewShot, plantable } from './paths';
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
 * Lit rather than baked, unlike everything else in the exterior: lightmapping
 * thousands of alpha-mapped leaf cards costs more than lighting them in the
 * browser, and it would fix them to one sun. Their contribution to the building
 * is already paid for — they stood in the Blender scene while it baked.
 *
 * **The asset's vertical is discarded on the way in.** `scatter_planting` sets
 * every plant at z = 0.05 on a level Blender floor; the ground here rolls
 * between −4.6 m and +7.5 m, and the paving, playground and building plate do
 * not exist in the Blender scene at all. An exported scatter is a *plan* —
 * which plant, where in x and z, how big, which way round — and everything that
 * depends on the terrain is decided here against the terrain.
 *
 * Then, **in this order**: nodes are collapsed into instanced draws, each
 * instance is tinted, and the wind is patched onto the materials. The tint and
 * the wind both need the instances to exist first.
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
    // The exported scatter cleared the wedge the review row's camera looks
    // through at the position the row stood in when the asset was baked. The
    // row has moved since; the corridor that matters is the current one.
    if (inReviewShot(x, z)) return false;

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
    // A shrub under a canopy is in shade; without that it reads as pasted onto
    // the ground rather than growing out of it.
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
