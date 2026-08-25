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
 * The plant's own full height, in the geometry's local units.
 *
 * Carried on every `InstancedMesh` this produces because `wind.ts` cannot
 * derive it: a tree arrives as three or four primitives — bark, twig, dead
 * branches, trunk — and each one's bounding box describes only its own part.
 * Normalising sway against the primitive would give the twig mesh full
 * amplitude at the height where the bark mesh has none, and the canopy would
 * visibly shear off the trunk. Sway has to be a function of height up *the
 * plant*, so the plant is what gets measured.
 */
export interface PlantMetrics {
  readonly plantHeight: number;
}

/**
 * Where one instance ends up, decided by the caller.
 *
 * The asset carries a *plan* — which plant, where in x and z, how big, which
 * way round — and nothing it can say about the vertical is worth believing:
 * `scatter_planting` places every one of them on a level Blender floor, and the
 * ground they arrive on rolls nine metres. So the site gets to move each
 * instance onto its own terrain and to refuse the ones that landed on paving,
 * and this module stays a bucketing routine that knows nothing about either.
 *
 * Return `false` to drop the instance. `matrix` is in the root's space and is
 * the caller's to rewrite; `bounds` is the whole plant's local box, which is
 * what tells a 12 m fir from a grass tuft drawn with the same call.
 */
export type Seat = (matrix: Matrix4, bounds: Box3) => boolean;

interface Bucket {
  readonly geometry: BufferGeometry;
  readonly material: Material;
  readonly matrices: Matrix4[];
  plantHeight: number;
}

/** Positions sampled when fingerprinting a geometry. Enough to never collide. */
const SAMPLES = 24;

/**
 * Collapses a scattered asset into one draw call per distinct thing drawn.
 *
 * The planting arrives from Blender as ~1400 separate nodes, one per plant, and
 * `GLTFLoader` rebuilds them as ~1400 draw calls. Bucketed by *what they draw*
 * rather than by where they stand, the same site costs a dozen — at which point
 * density is free.
 *
 * **Buckets are keyed on geometry content, not on `geometry.uuid`.** The
 * exporter duplicates mesh data for some species (`Plane.064` is written 29
 * times), so keyed by identity those become buckets of one and the instancing
 * silently does nothing.
 *
 * **Everything is instanced, including buckets of one.** It saves no draw call
 * by itself; it buys every plant reaching the vertex shader through
 * `instanceMatrix`, so the wind has one path to handle rather than two.
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
    // A multi-material object is one primitive per material by the time glTF
    // has been through it, so a mesh here carries exactly one. Anything else is
    // a structural change upstream and should be seen, not averaged away.
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
    // Split by position rather than drawn as one field. A bucket's instances
    // are scattered over the whole site, so as a single mesh it is culled by a
    // volume the size of the site and never rejected by either frustum — see
    // `chunking.ts`.
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

  // The refusal count is reported rather than assumed. A clearance rule that is
  // working and one that is quietly emptying the site look identical from any
  // camera, and this is the only number that separates them.
  console.info(
    `[exterior] planting: ${nodes - refused} of ${nodes} nodes kept ` +
      `(${refused} on built ground) in ${meshes.length} instanced draws ` +
      `across ${buckets.size} buckets.`,
  );

  return {
    object,
    meshes,
    dispose() {
      // Geometry and materials belong to the asset cache and are handed out
      // again on the next visit to the zone. Only the instance buffers added
      // here are this object's to release.
      for (const chunk of chunks) chunk.dispose();
    },
  };
}

/**
 * The whole plant this primitive belongs to, as a local-space box.
 *
 * `GLTFLoader` expands a multi-primitive mesh into a `Group` holding one child
 * per primitive, and those children carry no transform of their own — so the
 * union of their geometry bounding boxes, taken on the parent, is the plant
 * measured in exactly the space the vertex shader sees. Cached per node
 * because every instance of a template asks the same question.
 *
 * The box rather than the height alone: the wind normalises sway against the
 * height, and the site needs a crown radius to decide what a placement clears.
 *
 * **The root is never the plant.** A single-primitive plant is exported as a
 * bare `Mesh` hanging off the scene, so taking the parent reaches the scene
 * itself and measures the union of every geometry on the site.
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
 * A content hash of a geometry, so duplicated mesh data buckets as one.
 *
 * Vertex and index counts alone would merge genuinely different plants that
 * happen to match, so a spread of actual positions is folded in as well. Two
 * geometries agreeing on all of that are the same geometry.
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
