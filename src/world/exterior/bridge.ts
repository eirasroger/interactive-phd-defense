import {
  BoxGeometry,
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
} from 'three';
import { bankAt, CROSSING, riverSurface, SPAN } from './paths';
import { BRIDGE, LAND } from './site';

export interface Bridge {
  readonly object: Group;
  dispose(): void;
}

/** Spacing in metres of deck boards, parapet bars and bearers. */
const BOARD = 0.22;
const BAR = 0.3;
const BEARER = 1.35;

/** Number of sections along the span for a lofted member. */
const LOFT = 24;

/**
 * Footbridge where the avenue crosses the stream: corten edge beams, timber
 * deck, bar parapet. Built in code so it follows `CROSSING` when the avenue or
 * river moves. Deck height comes from `bankAt` so it meets the paving flush.
 */
export function createBridge(): Bridge {
  const object = new Group();
  object.name = 'bridge';

  // Aligned with the avenue so both ends stay on the path. `SPAN` is long
  // enough to clear the bank at the resulting skew.
  const half = SPAN / 2;

  // Bank top level. The cut terrain would put the deck in the channel.
  const deck = bankAt(CROSSING.x) + BRIDGE.deck;
  // Abutment height needed to reach the river bed.
  const foot = deck - (riverSurface(CROSSING.x) - LAND.river.depth) + 0.6;

  const materials = {
    // Weathered grey timber, kept darker than the paving and the building.
    timber: new MeshStandardMaterial({ color: 0x6e5c46, roughness: 0.92, metalness: 0 }),
    corten: new MeshStandardMaterial({ color: 0x6f4230, roughness: 0.72, metalness: 0.15 }),
    steel: new MeshStandardMaterial({ color: 0x33322f, roughness: 0.55, metalness: 0.5 }),
  };

  const span = new Group();
  span.position.set(CROSSING.x, deck, CROSSING.z);
  object.add(span);

  const geometries: BufferGeometry[] = [];
  const instanced: InstancedMesh[] = [];

  const add = (geometry: BufferGeometry, material: MeshStandardMaterial, x = 0, y = 0, z = 0): Mesh => {
    geometries.push(geometry);
    const mesh = new Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    span.add(mesh);
    return mesh;
  };

  const instance = (
    geometry: BufferGeometry,
    material: MeshStandardMaterial,
    seats: readonly Vector3[],
  ): void => {
    geometries.push(geometry);
    const mesh = new InstancedMesh(geometry, material, seats.length);
    const matrix = new Matrix4();
    const identity = new Quaternion();
    const one = new Vector3(1, 1, 1);
    seats.forEach((seat, index) => mesh.setMatrixAt(index, matrix.compose(seat, identity, one)));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    span.add(mesh);
    instanced.push(mesh);
  };

  /** Deck rise above the abutments at `t` (0-1 along the span). Zero at both ends, peak at midspan. */
  const camber = (t: number): number => Math.sin(t * Math.PI) * BRIDGE.camber;

  /**
   * Rectangular member swept along the deck camber, so beams and rails follow
   * the deck with no gap at midspan. Sampled at `LOFT` sections.
   */
  const loft = (width: number, depth: number, drop: number): BufferGeometry => {
    const positions: number[] = [];
    const indices: number[] = [];
    const w = width / 2;

    for (let station = 0; station <= LOFT; station += 1) {
      const t = station / LOFT;
      const top = camber(t) - drop;
      const z = -half + t * SPAN;
      // Same corner order at every section keeps the winding consistent.
      positions.push(-w, top, z, w, top, z, w, top - depth, z, -w, top - depth, z);
    }

    for (let station = 0; station < LOFT; station += 1) {
      const near = station * 4;
      const far = near + 4;
      for (let corner = 0; corner < 4; corner += 1) {
        const a = near + corner;
        const b = near + ((corner + 1) % 4);
        indices.push(a, b, far + corner, b, far + ((corner + 1) % 4), far + corner);
      }
    }

    // End caps, visible from the paving.
    const last = LOFT * 4;
    indices.push(0, 3, 2, 0, 2, 1);
    indices.push(last, last + 1, last + 2, last, last + 2, last + 3);

    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
  };

  // Edge beams, cambered with the deck.
  for (const side of [-1, 1]) {
    add(loft(0.14, 0.42, 0.06), materials.corten, side * (BRIDGE.halfWidth + 0.05));
  }

  // Transverse bearers under the boards, visible from the bank.
  const bearers = Math.round(SPAN / BEARER);
  const bearerSeats: Vector3[] = [];
  for (let i = 0; i < bearers; i += 1) {
    const t = (i + 0.5) / bearers;
    bearerSeats.push(new Vector3(0, camber(t) - 0.19, -half + t * SPAN));
  }
  instance(new BoxGeometry(BRIDGE.halfWidth * 2, 0.16, 0.12), materials.steel, bearerSeats);

  // Deck as discrete boards that step the camber. Laid close so the water
  // does not show through the joints.
  const boards = Math.round(SPAN / BOARD);
  const boardSeats: Vector3[] = [];
  for (let i = 0; i < boards; i += 1) {
    const t = (i + 0.5) / boards;
    // Lowered by half its thickness so the board top is at deck level.
    boardSeats.push(new Vector3(0, camber(t) - 0.04, -half + t * SPAN));
  }
  instance(new BoxGeometry(BRIDGE.halfWidth * 2, 0.08, BOARD * 0.94), materials.timber, boardSeats);

  // Parapet: vertical bars, a flat top rail and a bottom rail along the camber.
  const bars = Math.round(SPAN / BAR);
  const bar = new BoxGeometry(0.02, BRIDGE.rail, 0.02);
  for (const side of [-1, 1]) {
    const barSeats: Vector3[] = [];
    for (let i = 0; i < bars; i += 1) {
      const t = (i + 0.5) / bars;
      barSeats.push(new Vector3(side * BRIDGE.halfWidth, camber(t) + BRIDGE.rail / 2, -half + t * SPAN));
    }
    instance(bar.clone(), materials.steel, barSeats);

    add(loft(0.1, 0.05, -BRIDGE.rail), materials.steel, side * BRIDGE.halfWidth);
    add(loft(0.06, 0.04, -0.14), materials.steel, side * BRIDGE.halfWidth);
  }
  bar.dispose();

  // Abutments, from the deck down past the bed. Height follows the channel
  // depth at the crossing.
  for (const side of [-1, 1]) {
    add(
      new BoxGeometry(BRIDGE.halfWidth * 2 + 0.4, foot, 1.2),
      materials.corten,
      0,
      -foot / 2 - 0.3,
      side * (half - 0.4),
    );
  }

  // No wing walls: they would land inside the avenue paving, and the terrain
  // is already level at the crossing.

  return {
    object,
    dispose() {
      for (const geometry of geometries) geometry.dispose();
      for (const mesh of instanced) mesh.dispose();
      for (const material of Object.values(materials)) material.dispose();
    },
  };
}
