import {
  BoxGeometry,
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

/** Boards across the deck, and bars in the parapet, per metre of span. */
const BOARD = 0.22;
const BAR = 0.3;

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
 * Cambered rather than flat. A level deck between two abutments reads as a
 * plank; the rise is also what lets the parapet clear the bank vegetation at
 * midspan, which is the whole reason you can see the water from it.
 *
 * **The deck is the path, at the path's level.** It used to take its height
 * from `heightAt` sampled at the abutments — which, once the span had been
 * shortened until both ends landed inside the swale, was a point part-way down
 * the bank. The deck therefore sat about a metre below the paving that ran onto
 * it, and the walk fell down a step into a gap. Both ends now stand on the bank
 * top the avenue arrives at, and the terrain is eased to that same bank top, so
 * paving and deck meet flush by construction rather than by coincidence.
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

  const geometries: BoxGeometry[] = [];
  const instanced: InstancedMesh[] = [];
  const add = (
    geometry: BoxGeometry,
    material: MeshStandardMaterial,
    x: number,
    y: number,
    z: number,
  ): Mesh => {
    geometries.push(geometry);
    const mesh = new Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    span.add(mesh);
    return mesh;
  };

  /** Height of the deck above its abutments, at a position along the span. */
  const camber = (t: number): number => Math.cos(t * Math.PI) * -BRIDGE.camber + BRIDGE.camber;

  // Deck, as discrete boards. One cambered slab would need a curved mesh and
  // would still read as a ramp; boards step the camber and give the deck the
  // only fine-grained texture on the whole structure.
  const boards = Math.round(SPAN / BOARD);
  const board = new BoxGeometry(BRIDGE.halfWidth * 2, 0.08, BOARD * 0.82);
  const planks = new InstancedMesh(board, materials.timber, boards);
  const matrix = new Matrix4();
  const identity = new Quaternion();
  const one = new Vector3(1, 1, 1);
  const seat = new Vector3();

  for (let i = 0; i < boards; i += 1) {
    const t = (i + 0.5) / boards;
    seat.set(0, camber(t), -half + t * SPAN);
    planks.setMatrixAt(i, matrix.compose(seat, identity, one));
  }
  planks.instanceMatrix.needsUpdate = true;
  planks.castShadow = true;
  planks.receiveShadow = true;
  span.add(planks);
  instanced.push(planks);

  // Edge beams, straight rather than cambered. A 0.4 m rise over 17 m is under
  // 3%, which a straight beam of this depth absorbs without anyone reading it
  // as wrong, and it saves two curved lofts.
  for (const side of [-1, 1]) {
    add(
      new BoxGeometry(0.11, 0.38, SPAN),
      materials.corten,
      side * (BRIDGE.halfWidth + 0.05),
      BRIDGE.camber * 0.5 - 0.24,
      0,
    );
  }

  // Parapet. Bars carry it, the flat top rail is what the eye actually reads,
  // and the bottom rail keeps the bars from floating over the cambered deck.
  const bars = Math.round(SPAN / BAR);
  const bar = new BoxGeometry(0.02, BRIDGE.rail, 0.02);
  for (const side of [-1, 1]) {
    const rank = new InstancedMesh(bar, materials.steel, bars);
    for (let i = 0; i < bars; i += 1) {
      const t = (i + 0.5) / bars;
      seat.set(side * BRIDGE.halfWidth, camber(t) + BRIDGE.rail / 2, -half + t * SPAN);
      rank.setMatrixAt(i, matrix.compose(seat, identity, one));
    }
    rank.instanceMatrix.needsUpdate = true;
    rank.castShadow = true;
    span.add(rank);
    instanced.push(rank);

    add(
      new BoxGeometry(0.1, 0.05, SPAN),
      materials.steel,
      side * BRIDGE.halfWidth,
      BRIDGE.rail + BRIDGE.camber * 0.5,
      0,
    );
    add(
      new BoxGeometry(0.06, 0.04, SPAN),
      materials.steel,
      side * BRIDGE.halfWidth,
      0.14 + BRIDGE.camber * 0.5,
      0,
    );
  }

  // Abutments, reaching from the deck down past the bed. Their depth is the
  // cut they stand in rather than a fixed 3.2 m block: the channel's level is
  // derived from the terrain now, so a typed depth would either float above the
  // bed or bury the deck depending on where the meander happened to run.
  for (const side of [-1, 1]) {
    add(
      new BoxGeometry(BRIDGE.halfWidth * 2 + 0.4, foot, 1.2),
      materials.corten,
      0,
      -foot / 2 - 0.08,
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
      for (const geometry of [...geometries, board, bar]) geometry.dispose();
      for (const mesh of instanced) mesh.dispose();
      for (const material of Object.values(materials)) material.dispose();
    },
  };
}
