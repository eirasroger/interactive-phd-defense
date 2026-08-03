import { Box3, Group, InstancedMesh, Matrix4, Mesh, type BufferGeometry, type Material, type Object3D } from 'three';

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
 * The planting arrives from Blender as 1396 separate nodes — every grass tuft,
 * fern and tree placed by `scatter_planting` is its own object. glTF stores
 * that honestly and `GLTFLoader` rebuilds it just as honestly, as ~1400 `Mesh`
 * objects, which is ~1400 draw calls for a site that still reads as empty.
 *
 * That is the whole reason density was unaffordable, and the diagnosis matters
 * because it is not the one the file size suggests. The payload was never the
 * constraint. Bucket the nodes by *what they draw* rather than by where they
 * stand and the same site costs a dozen draws, at which point ten thousand
 * plants cost no more than the fourteen hundred did.
 *
 * **Buckets are keyed on geometry content, not on `geometry.uuid`.** The
 * exporter shares mesh data for most of the site but duplicated it for the
 * nettles — `Plane.064` alone is written 29 times as 29 distinct meshes with
 * one node each. Keyed by identity those are 73 buckets of one instance and
 * the instancing silently does nothing for them; fingerprinted by content they
 * collapse to three. Duplicated geometry is an upstream fault worth fixing at
 * the source too, but the runtime should not be the thing that depends on it.
 *
 * **Everything is instanced, including buckets of one.** A one-instance
 * `InstancedMesh` saves no draw call by itself; what it buys is that every
 * plant reaches the vertex shader through `instanceMatrix`, so the wind has
 * exactly one path to handle rather than two. The trees are the smallest
 * buckets on the site and the most important things on it to move.
 */
export function collapseToInstances(root: Object3D): Instanced {
  root.updateMatrixWorld(true);
  const toRoot = new Matrix4().copy(root.matrixWorld).invert();

  const buckets = new Map<string, Bucket>();
  const heights = new Map<Object3D, number>();
  let nodes = 0;

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

    const key = `${mesh.material.uuid}|${fingerprint(mesh.geometry)}`;
    const bucket = buckets.get(key) ?? {
      geometry: mesh.geometry,
      material: mesh.material,
      matrices: [],
      plantHeight: 0,
    };

    bucket.matrices.push(new Matrix4().multiplyMatrices(toRoot, mesh.matrixWorld));
    bucket.plantHeight = Math.max(bucket.plantHeight, plantHeight(mesh, heights));
    buckets.set(key, bucket);
  });

  const object = new Group();
  object.name = `${root.name || 'asset'}_instanced`;
  const meshes: InstancedMesh[] = [];

  for (const bucket of buckets.values()) {
    const instanced = new InstancedMesh(bucket.geometry, bucket.material, bucket.matrices.length);
    bucket.matrices.forEach((matrix, index) => instanced.setMatrixAt(index, matrix));
    instanced.instanceMatrix.needsUpdate = true;
    // Instance transforms are written once and never touched, so the field is
    // culled as one volume. Without this the bounding sphere stays the source
    // mesh's — a single plant at the origin — and the whole field pops out of
    // existence the moment the camera looks away from that point.
    instanced.computeBoundingSphere();
    (instanced.userData as { plantHeight: number }).plantHeight = bucket.plantHeight;
    object.add(instanced);
    meshes.push(instanced);
  }

  console.info(`[exterior] planting: ${nodes} nodes collapsed to ${meshes.length} instanced draws.`);

  return {
    object,
    meshes,
    dispose() {
      // Geometry and materials belong to the asset cache and are handed out
      // again on the next visit to the zone. Only the instance buffers added
      // here are this object's to release.
      for (const mesh of meshes) mesh.dispose();
    },
  };
}

/**
 * The height of the whole plant this primitive belongs to, in local units.
 *
 * `GLTFLoader` expands a multi-primitive mesh into a `Group` holding one child
 * per primitive, and those children carry no transform of their own — so the
 * union of their geometry bounding boxes, taken on the parent, is the plant
 * measured in exactly the space the vertex shader sees. Cached per node
 * because every instance of a template asks the same question.
 */
function plantHeight(mesh: Mesh, cache: Map<Object3D, number>): number {
  const node = mesh.parent && !(mesh.parent as Mesh).isMesh ? mesh.parent : mesh;

  const cached = cache.get(node);
  if (cached !== undefined) return cached;

  const bounds = new Box3();
  node.traverse((child) => {
    const part = child as Mesh;
    if (!part.isMesh) return;
    part.geometry.computeBoundingBox();
    if (part.geometry.boundingBox) bounds.union(part.geometry.boundingBox);
  });

  const height = bounds.isEmpty() ? 1 : Math.max(bounds.max.y, 0.001);
  cache.set(node, height);
  return height;
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
