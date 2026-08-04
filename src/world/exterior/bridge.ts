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

/** Boards across the deck, bars in the parapet, and bearers under it, per metre. */
const BOARD = 0.22;
const BAR = 0.3;
const BEARER = 1.35;

/** Stations along the span that a lofted member is described at. */
const LOFT = 24;

/**
 * The footbridge where the avenue crosses the stream.
 *
 * Weathering steel edge beams, timber deck, slim vertical bar parapet — the
 * flat dark top rail in the corner of `river_besides_pathway` is this bridge,
 * and it is what the audience's hands are on in scene 3.
 *
 * Built as geometry rather than imported, for the same reason the paving is:
 * its position is the intersection of the avenue and a meandering river, and
 * the moment either moves an exported mesh is in the wrong place. Everything
 * here derives from `CROSSING`.
 *
 * **The deck is the path, at the path's level.** Both ends stand on `bankAt` —
 * the same bank top the avenue arrives at and the terrain is eased to — so
 * paving and deck meet flush by construction. Taking the height from `heightAt`
 * at the abutments instead samples a point part-way down the bank.
 */
export function createBridge(): Bridge {
  const object = new Group();
  object.name = 'bridge';

  // Aligned with the avenue, NOT square to the flow.
  //
  // Squaring it to the water was wrong and obviously so once built: at a 48°
  // bend, rotating the deck about its centre swings each end off the path axis,
  // so the bridge sat beside the avenue instead of carrying it. A footbridge is
  // a piece of the path. The path decides — and `SPAN` is then long enough for
  // both ends to reach past the bank at whatever skew that produces.
  const half = SPAN / 2;

  // The level the avenue arrives at, which is the bank top either side. Nothing
  // is sampled from the cut terrain: that is what put the deck in the channel.
  const deck = bankAt(CROSSING.x) + BRIDGE.deck;
  // How far the abutments have to reach to sit on solid ground rather than
  // hover over the slope they are cut into.
  const foot = deck - (riverSurface(CROSSING.x) - LAND.river.depth) + 0.6;

  const materials = {
    // Weathered, not fresh-sawn. At 0x9a7448 the deck was the brightest and most
    // saturated surface in the frame from the bridge pose — brighter than the
    // paving it continues and brighter than the building it points at, which
    // inverts the whole shot. Outdoor timber greys within a season.
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

  /**
   * Height of the deck above its abutments, at a position along the span.
   *
   * **A hump, not a ramp.** This was `cos(t π) × −c + c`, which is zero at one
   * abutment and `2c` at the other — a monotonic 0.7 m climb rather than a
   * 0.35 m rise at midspan. Everything else on the structure was built straight,
   * so the deck visibly lifted off its own edge beams and out through its own
   * parapet as it went, and the boards read as planks hanging in mid-air over
   * the water. Nothing about the modelling was wrong; the curve was.
   */
  const camber = (t: number): number => Math.sin(t * Math.PI) * BRIDGE.camber;

  /**
   * A rectangular-section member swept along the deck's own curve.
   *
   * Under a cambered deck a straight box is a chord — flush at the abutments
   * and a third of a metre below the deck at midspan, which is the daylight that
   * makes a deck look unsupported. Lofted at `LOFT` stations, one every 80 cm
   * against a 3° maximum slope.
   */
  const loft = (width: number, depth: number, drop: number): BufferGeometry => {
    const positions: number[] = [];
    const indices: number[] = [];
    const w = width / 2;

    for (let station = 0; station <= LOFT; station += 1) {
      const t = station / LOFT;
      const top = camber(t) - drop;
      const z = -half + t * SPAN;
      // Corners in a consistent order round the section, so the side walls are
      // one strip and the winding never depends on the sign of anything.
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

    // Both ends capped: the beam is seen end-on from the paving that runs onto
    // the deck, and an open tube there is a hole in the structure.
    const last = LOFT * 4;
    indices.push(0, 3, 2, 0, 2, 1);
    indices.push(last, last + 1, last + 2, last, last + 2, last + 3);

    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
  };

  // Edge beams, cambered with the deck they carry. Deep enough to read as
  // structure from the bank, which is the one view that asks the bridge to
  // explain how it stands up.
  for (const side of [-1, 1]) {
    add(loft(0.14, 0.42, 0.06), materials.corten, side * (BRIDGE.halfWidth + 0.05));
  }

  // Transverse bearers between the beams. Boards spanning nothing read as
  // floating; boards on joists read as a deck. Only ever seen from the bank and
  // from the water.
  const bearers = Math.round(SPAN / BEARER);
  const bearerSeats: Vector3[] = [];
  for (let i = 0; i < bearers; i += 1) {
    const t = (i + 0.5) / bearers;
    bearerSeats.push(new Vector3(0, camber(t) - 0.19, -half + t * SPAN));
  }
  instance(new BoxGeometry(BRIDGE.halfWidth * 2, 0.16, 0.12), materials.steel, bearerSeats);

  // Deck, as discrete boards. One cambered slab would need a curved mesh and
  // would still read as a ramp; boards step the camber and give the deck the
  // only fine-grained texture on the whole structure.
  //
  // Laid close. At 0.82 of the pitch the joints were 4 cm of open sky between
  // every board — a grating rather than a deck, and from any pose below the
  // parapet you could see the water through the walk you were standing on.
  const boards = Math.round(SPAN / BOARD);
  const boardSeats: Vector3[] = [];
  for (let i = 0; i < boards; i += 1) {
    const t = (i + 0.5) / boards;
    // Sunk by half its own thickness so the *top* of the board is the deck
    // level, which is what has to arrive flush with the paving.
    boardSeats.push(new Vector3(0, camber(t) - 0.04, -half + t * SPAN));
  }
  instance(new BoxGeometry(BRIDGE.halfWidth * 2, 0.08, BOARD * 0.94), materials.timber, boardSeats);

  // Parapet. Bars carry it, the flat top rail is what the eye actually reads,
  // and the bottom rail keeps the bars from floating over the cambered deck.
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

  // Abutments, reaching from the deck down past the bed. Their depth is the
  // cut they stand in rather than a fixed 3.2 m block: the channel's level is
  // derived from the terrain now, so a typed depth would either float above the
  // bed or bury the deck depending on where the meander happened to run.
  for (const side of [-1, 1]) {
    add(
      new BoxGeometry(BRIDGE.halfWidth * 2 + 0.4, foot, 1.2),
      materials.corten,
      0,
      -foot / 2 - 0.3,
      side * (half - 0.4),
    );
  }

  // No wing walls. They were tried, running back into the bank from each
  // abutment, and they landed 1.3 m past the deck ends — which is inside the
  // avenue's paving, so each one surfaced as a slab standing in the middle of
  // the walk. There is nothing for them to retain in any case: the terrain is
  // eased to the bank top across the whole crossing, so the paving arrives on
  // level ground and the abutment is the only thing holding anything up.

  return {
    object,
    dispose() {
      for (const geometry of geometries) geometry.dispose();
      for (const mesh of instanced) mesh.dispose();
      for (const material of Object.values(materials)) material.dispose();
    },
  };
}
