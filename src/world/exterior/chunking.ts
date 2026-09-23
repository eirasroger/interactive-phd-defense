import { InstancedMesh, Matrix4, Vector3, type BufferGeometry, type Material } from 'three';

/**
 * A field of instances split into spatial cells, so the camera and shadow
 * frusta can cull each cell. An `InstancedMesh` is culled as one volume, which
 * for a site-wide field means everything is always drawn. Costs extra draw
 * calls; Act I is bound by vertex work.
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

/** Cell key for a world position. Shared so parallel fields can be paired. */
export const cellKey = (position: Vector3, cell: number = CELL): string =>
  `${Math.floor(position.x / cell)}:${Math.floor(position.z / cell)}`;

/**
 * Cell size in metres. Measured at 1080p over Act I poses: 40 m and 80 m gave
 * the same frame time, and 80 m uses about half the draw calls. Overridable per
 * field (see `parkland.ts` `LOD_CELL`).
 */
export const CELL = 80;

export interface ChunkInput {
  readonly geometry: BufferGeometry;
  readonly material: Material;
  readonly matrices: readonly Matrix4[];
}

/**
 * Builds one `InstancedMesh` per occupied cell. Each mesh gets the given
 * `userData`, since `wind.ts` reads `plantHeight` from it.
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
    // Required for culling: the default sphere is the template geometry's at the origin.
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
