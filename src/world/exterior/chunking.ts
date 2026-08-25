import { InstancedMesh, Matrix4, Vector3, type BufferGeometry, type Material } from 'three';

/**
 * A field of instances, split into cells the frustum can reject.
 *
 * **An `InstancedMesh` is culled as one volume, and a field is the size of the
 * site.** Every consumer here was doing the right thing at the draw-call level
 * and paying for it at the vertex level: the park's 408 tree primitives are nine
 * draws, which is excellent, and their bounding sphere is three hundred metres
 * across, which means three hundred metres of trees are submitted whenever any
 * one of them is on screen. Measured across Act I's eleven poses, between 6% and
 * 98% of the site was actually inside the frame, and the renderer drew 100% of
 * it every time.
 *
 * The shadow pass is the half that is wasted on *every* pose rather than on
 * some of them. `WebGLShadowMap` culls casters against the light's frustum using
 * the same bounding volume, and the exterior's is 57.6 m wide against a field
 * that is not — so of 10.8M cast-shadow triangles, 5.4M fell outside the shadow
 * camera and were rasterised into it anyway.
 *
 * Splitting by position gives both frusta something they can reject. It costs
 * draw calls, which is the resource this scene has most of: Act I renders 484
 * of them, and the vertex work is what the frame is actually bound by.
 */
export interface Chunk {
  /** Cell this mesh holds, so parallel fields can be paired by position. */
  readonly key: string;
  readonly mesh: InstancedMesh;
}

export interface Chunked {
  readonly chunks: readonly Chunk[];
  readonly meshes: readonly InstancedMesh[];
  dispose(): void;
}

/** The cell a world position falls in. One definition, so fields can be paired. */
export const cellKey = (position: Vector3, cell: number = CELL): string =>
  `${Math.floor(position.x / cell)}:${Math.floor(position.z / cell)}`;

/**
 * Metres across one cell.
 *
 * A floor and a ceiling, and they are close together. Smaller cells reject more
 * but a cell holding two plants is a draw call spent on two plants, and the
 * planting alone buckets into 83 distinct things drawn. Larger cells reject
 * nothing: at the site's own scale there is one cell and this module has done
 * nothing but add a loop.
 *
 * Overridable per field, because a field that also uses its cells to decide a
 * level of detail wants them smaller than one that only uses them to cull — see
 * `parkland.ts` `LOD_CELL`.
 *
 * Swept rather than reasoned about, because the two costs trade against each
 * other and only measurement says where. At 1080p across five Act I poses, 40 m
 * and 80 m came out within noise of each other: 40 m rejects more geometry
 * (18.3M triangles against 19.0M at `overview`) and spends the difference on
 * draw calls (1958 against 1198). 80 m is the same frame for half the calls,
 * which is the better of two equal answers — fewer calls is less main thread per
 * frame and less instance buffer on the GPU, and both matter more on a weaker
 * machine than on the one this was measured on.
 */
export const CELL = 80;

export interface ChunkInput {
  readonly geometry: BufferGeometry;
  readonly material: Material;
  readonly matrices: readonly Matrix4[];
}

/**
 * One `InstancedMesh` per occupied cell.
 *
 * Cells are keyed off world position and only the occupied ones are built, so a
 * bucket of five instances costs at most five draws however large the site is.
 *
 * Every mesh carries the same `userData` the un-chunked one did, because `wind.ts`
 * reads `plantHeight` off it and cannot be given a mesh that has lost it.
 */
export function chunkInstances(
  { geometry, material, matrices }: ChunkInput,
  name: string,
  userData: Record<string, unknown> = {},
  cellSize: number = CELL,
): Chunked {
  const cells = new Map<string, Matrix4[]>();
  const position = new Vector3();

  for (const matrix of matrices) {
    position.setFromMatrixPosition(matrix);
    const key = cellKey(position, cellSize);
    const cell = cells.get(key);
    if (cell) cell.push(matrix);
    else cells.set(key, [matrix]);
  }

  const chunks: Chunk[] = [];

  for (const [key, cell] of cells) {
    const mesh = new InstancedMesh(geometry, material, cell.length);
    cell.forEach((matrix, index) => mesh.setMatrixAt(index, matrix));
    mesh.instanceMatrix.needsUpdate = true;
    // The whole point. Without this the sphere stays the source geometry's —
    // one plant at the origin — and the cell is culled by where the template
    // was authored rather than by where its instances stand.
    mesh.computeBoundingSphere();
    mesh.name = `${name}@${key}`;
    Object.assign(mesh.userData, userData);
    chunks.push({ key, mesh });
  }

  return {
    chunks,
    meshes: chunks.map((chunk) => chunk.mesh),
    dispose() {
      for (const chunk of chunks) chunk.mesh.dispose();
    },
  };
}
