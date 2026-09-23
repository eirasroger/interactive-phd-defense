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
  /** Trees register here so the ground shader can darken under them. */
  readonly canopy: CanopyField;
}

/** Height in metres above which a plant counts as a tree. */
const TREE = 4;

/**
 * Clear ground a plant needs, as a fraction of its radius. Below 1 so canopies
 * can overhang paths while trunks stay off them.
 */
const CLEAR = 0.45;

/** Radius in metres above which a plant is seated on the lowest ground under its footprint. */
const BROAD = 0.4;

/**
 * Trees, hedge and meadow grass. These are lit at runtime; baking thousands of
 * alpha leaf cards is too costly and would fix them to one sun.
 *
 * The export only supplies plan data (which plant, x/z, scale, rotation). Height
 * comes from the terrain here, since Blender places every plant on a flat floor.
 * Order matters: instancing first, then tint, then wind.
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
    // Keep the review row's current camera view clear.
    if (inReviewShot(x, z)) return false;

    // Plants in the entrance beds sit on the bed top, 14 cm above the terrain.
    position.y = inBeds(x, z)
      ? BED_TOP - 0.03
      : seatAt(x, z, radius > BROAD ? Math.min(radius, 1.6) : 0);
    matrix.compose(position, spin, scale);

    if (height >= TREE) canopy.add(x, z, radius);
    return true;
  });

  for (const mesh of instanced.meshes) {
    mesh.castShadow = true;
    // Shrubs under a canopy need its shade to sit in the ground.
    mesh.receiveShadow = true;

    for (const material of materialsOf(mesh)) {
      // Leaves are single-sided cards in the source asset.
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
    // Geometry, materials and textures belong to the shared asset cache. Only
    // the instance buffers and depth materials are disposed here.
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
