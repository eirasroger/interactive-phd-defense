import {
  Box3,
  Group,
  Matrix4,
  Mesh,
  Vector3,
  type BufferGeometry,
  type InstancedMesh,
  type Material,
  type Object3D,
} from 'three';
import { chunkInstances, type Chunked } from './chunking';

export interface Instanced {
  readonly object: Group;
  readonly meshes: readonly InstancedMesh[];
  dispose(): void;
}

/**
 * Full plant height in local units. `wind.ts` needs it because a tree is split
 * into several primitives and each bounding box covers only its own part.
 * Sway measured per primitive would shear the canopy off the trunk.
 */
export interface PlantMetrics {
  readonly plantHeight: number;
}

/**
 * Caller hook that places one instance. `scatter_planting` exports on a flat
 * floor, so the site drops each plant onto its terrain and rejects plants on
 * paving. Return `false` to drop the instance. `matrix` is in root space and
 * may be rewritten. `bounds` is the whole plant's local box.
 */
export type Seat = (matrix: Matrix4, bounds: Box3) => boolean;

interface Bucket {
  readonly geometry: BufferGeometry;
  readonly material: Material;
  readonly matrices: Matrix4[];
  plantHeight: number;
}

/** Positions sampled when fingerprinting a geometry. */
const SAMPLES = 24;

/**
 * Groups a scattered asset (about 1400 plant nodes) into instanced meshes, one
 * per material and geometry. Buckets are keyed on geometry content because the
 * exporter duplicates mesh data (`Plane.064` is written 29 times). Buckets of
 * one are instanced too, so the wind shader has a single `instanceMatrix` path.
 */
export function collapseToInstances(root: Object3D, seat?: Seat): Instanced {
  root.updateMatrixWorld(true);
  const toRoot = new Matrix4().copy(root.matrixWorld).invert();

  const buckets = new Map<string, Bucket>();
  const bounds = new Map<Object3D, Box3>();
  const matrix = new Matrix4();
  let nodes = 0;
  let refused = 0;

  root.traverse((child) => {
    const mesh = child as Mesh;
    if (!mesh.isMesh) return;
    // glTF splits multi-material objects into one primitive per material.
    // An array here means the export changed upstream.
    if (Array.isArray(mesh.material)) {
      throw new Error(
        `${mesh.name || 'planting mesh'} has ${mesh.material.length} materials; expected one per primitive.`,
      );
    }
    nodes += 1;

    const box = plantBounds(mesh, root, bounds);
    matrix.multiplyMatrices(toRoot, mesh.matrixWorld);
    if (seat && !seat(matrix, box)) {
      refused += 1;
      return;
    }

    const key = `${mesh.material.uuid}|${fingerprint(mesh.geometry)}`;
    const bucket = buckets.get(key) ?? {
      geometry: mesh.geometry,
      material: mesh.material,
      matrices: [],
      plantHeight: 0,
    };

    bucket.matrices.push(matrix.clone());
    bucket.plantHeight = Math.max(bucket.plantHeight, Math.max(box.max.y, 0.001));
    buckets.set(key, bucket);
  });

  const object = new Group();
  object.name = `${root.name || 'asset'}_instanced`;
  const meshes: InstancedMesh[] = [];

  const chunks: Chunked[] = [];

  for (const bucket of buckets.values()) {
    // Split each bucket into spatial chunks so frustum culling can reject
    // them. See `chunking.ts`.
    const chunked = chunkInstances(
      { geometry: bucket.geometry, material: bucket.material, matrices: bucket.matrices },
      root.name || 'planting',
      { plantHeight: bucket.plantHeight },
    );
    chunks.push(chunked);

    for (const instanced of chunked.meshes) {
      object.add(instanced);
      meshes.push(instanced);
    }
  }

  // Logged so a clearance rule that drops too many plants is visible.
  console.info(
    `[exterior] planting: ${nodes - refused} of ${nodes} nodes kept ` +
      `(${refused} on built ground) in ${meshes.length} instanced draws ` +
      `across ${buckets.size} buckets.`,
  );

  return {
    object,
    meshes,
    dispose() {
      // Geometry and materials belong to the asset cache. Only the instance
      // buffers are released here.
      for (const chunk of chunks) chunk.dispose();
    },
  };
}

/**
 * Local-space box of the whole plant a primitive belongs to. `GLTFLoader`
 * groups primitives under an untransformed parent, so the union of their boxes
 * is the plant in vertex-shader space. Cached per node. The root is never used
 * as the plant, since single-primitive plants hang directly off it.
 */
function plantBounds(mesh: Mesh, root: Object3D, cache: Map<Object3D, Box3>): Box3 {
  const parent = mesh.parent;
  const grouped = parent && parent !== root && !(parent as Mesh).isMesh;
  const node = grouped ? parent : mesh;

  const cached = cache.get(node);
  if (cached) return cached;

  const bounds = new Box3();
  node.traverse((child) => {
    const part = child as Mesh;
    if (!part.isMesh) return;
    part.geometry.computeBoundingBox();
    if (part.geometry.boundingBox) bounds.union(part.geometry.boundingBox);
  });

  if (bounds.isEmpty()) bounds.set(new Vector3(-0.5, 0, -0.5), new Vector3(0.5, 1, 0.5));
  cache.set(node, bounds);
  return bounds;
}

/**
 * Content hash of a geometry, so duplicated mesh data shares a bucket. Combines
 * vertex count, index count and a sample of positions.
 */
function fingerprint(geometry: BufferGeometry): string {
  const position = geometry.getAttribute('position');
  const array = position.array as ArrayLike<number>;
  const stride = Math.max(1, Math.floor(array.length / SAMPLES));

  let hash = 0x811c9dc5;
  for (let index = 0; index < array.length; index += stride) {
    hash ^= Math.round((array[index] ?? 0) * 4096);
    hash = Math.imul(hash, 0x01000193);
  }

  return `${position.count}:${geometry.index?.count ?? 0}:${(hash >>> 0).toString(36)}`;
}
