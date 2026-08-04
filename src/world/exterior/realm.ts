import {
  BoxGeometry,
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshStandardMaterial,
  RepeatWrapping,
  SRGBColorSpace,
  Vector2,
  type Texture,
} from 'three';
import {
  avenueAt,
  AVENUE_RUN,
  CROSSING,
  offAvenue,
  offPromenade,
  offRiverside,
  PROMENADE_Z,
  riversideAt,
  SPAN,
} from './paths';
import { crossings, inMouth, type Fillet, type Junction } from './junctions';
import { AVENUE, PATH_EDGE, REALM, RIVERSIDE } from './site';
import { surfaceAt } from './terrain';

export interface Realm {
  readonly object: Group;
  dispose(): void;
}

export interface SurfaceMaps {
  readonly map: Texture;
  readonly normal: Texture;
}

export interface RealmTextures {
  readonly clay: SurfaceMaps;
  readonly granite: SurfaceMaps;
  readonly cobble: SurfaceMaps;
  readonly gravel: SurfaceMaps;
}

type Surface = keyof RealmTextures;

/** How many metres of ground one tile of each texture covers, from Poly Haven. */
const TILE: Record<Surface, number> = { clay: 1.8, granite: 1.88, cobble: 1.8, gravel: 1.5 };

/**
 * Per-surface tone and finish.
 *
 * The tint is a deliberate correction rather than a preference. Poly Haven's
 * `red_brick_pavers` is a bright terracotta photographed in full sun, and laid
 * across a 250 m promenade, a 50 m avenue and a riverside walk at that value it
 * read as a running track — the single most saturated thing in a frame whose
 * subject is a dark brick building. Nordic clay pavers weather browner and
 * duller than that, so the map is muted rather than replaced: the joints, the
 * bond and the per-paver variation are all still doing their work.
 *
 * `bump` is normal strength in metres of apparent relief. The gutter cobbles
 * get the most because they are a dished strip of small stones and their whole
 * job is to catch a line of shadow along the path edge.
 */
const FINISH: Record<Surface, { tint: number; roughness: number; bump: number }> = {
  clay: { tint: 0xa8867a, roughness: 0.93, bump: 0.7 },
  // Cooled deliberately. `granite_tile_02` is a warm buff stone, and warm stone
  // against red pavers against dark brick is one hue across the whole frame —
  // which is the tonal flatness `world_design.md` §2.2 puts grey granite at the
  // building specifically to avoid.
  granite: { tint: 0xadb2b4, roughness: 0.82, bump: 0.6 },
  cobble: { tint: 0xb2b2ae, roughness: 0.95, bump: 1.1 },
  // A shade browner than the cobbles and quite matte: this is a mulch surface
  // read at three metres with planting standing in it, not a paved one.
  gravel: { tint: 0x8b8272, roughness: 0.97, bump: 0.5 },
};

/** How far the paving floats above the terrain it follows. */
const LIFT = 0.09;

/**
 * How much higher each route sits than the one below it in the table.
 *
 * A junior route's carriageway is allowed to run a fraction past the senior's
 * edge rather than stopping short of it, because stopping short leaves a sliver
 * of lawn between two paved surfaces and running past leaves nothing at all
 * once the overlap is hidden. Four millimetres is what hides it: enough for the
 * depth test to decide outright, far below anything visible on a surface seen
 * at a metre and a half of eye height.
 */
const TIER = 0.004;

function tier(path: Path): number {
  return LIFT + (PATHS.length - 1 - PATHS.indexOf(path)) * TIER;
}

/**
 * The surface of the entrance beds, which is where their planting stands.
 *
 * Exported because the bed is built here and the plants that go in it are
 * placed in `planting.ts` from the exported scatter. They were seated on the
 * terrain, which under the forecourt is 14 cm below the granite — so every
 * shrub at the entrance was buried to its collar. The bed's own level is the
 * only correct answer and there is exactly one of it.
 */
export const BED_TOP = LIFT + 0.05;

/**
 * Metres between sections along a path.
 *
 * Also the granularity at which a junction can break, since the crossing is
 * expressed by dropping whole quads. At 2.5 m the avenue's kerb ended in
 * visible 2.5 m teeth either side of the riverside walk.
 *
 * And, like `SPAN_WIDTH`, the length of the chord the paving takes across the
 * ground it follows. The riverside walk crosses the top of the river bank at an
 * angle, which is the one place on the site where a metre of chord still lets
 * the crest through.
 */
const STEP = 0.9;

/**
 * The path section, as offsets from the centreline.
 *
 * Straight out of `work/act1_photo_ideas/`, and it is the same everywhere: a
 * paved carriageway, a narrow granite kerb band standing proud of it, then a
 * strip of small cobbles dished as a gutter against the planting.
 *
 * That edge is doing more work than it looks. A path that meets grass directly
 * reads as a strip laid on a lawn; the kerb and gutter are what make it read as
 * *built* — and they are also what any real path needs to stop the surface
 * migrating into the beds, so they are true as well as legible.
 *
 * The two vertical dimensions are what the flat version was missing. A kerb
 * flush with its paving is a change of colour; a kerb 5 cm proud casts a line
 * of shadow down the whole length of the path, and that line is most of what
 * the eye uses to read a path as constructed rather than painted on.
 */
const { kerb: KERB, gutter: GUTTER, rise: RISE, dish: DISH } = PATH_EDGE;

interface Path {
  readonly name: string;
  /**
   * Which route this segment belongs to.
   *
   * Two segments of one route must never give way to each other, and they will
   * if they are only compared by their clearance functions — the avenue's two
   * halves share `offAvenue`, so each read the other as a crossing path and
   * dropped its own kerb the length of the walk.
   */
  readonly route: string;
  readonly surface: Surface;
  readonly halfWidth: number;
  readonly from: number;
  readonly to: number;
  /** Centre of the path at a given position along it, and which axis that is. */
  readonly axis: 'x' | 'z';
  readonly centre: (along: number) => number;
  /** How far this point is off this path's carriageway. Zero when on it. */
  readonly off: (x: number, z: number) => number;
}

/**
 * The section as a polyline across the path, left verge to right verge.
 *
 * Each node carries a cross offset, a height above the paving, and the material
 * of the span that *starts* there. Nodes may repeat an offset — that is how a
 * riser is expressed, as a span of zero plan width and 5 cm of rise.
 *
 * Written as one monotonic profile rather than as five independent lanes for
 * one reason: offsets that only ever increase give every triangle the same
 * winding, and winding is what silently deleted the avenue last time.
 */
interface Node {
  readonly offset: number;
  readonly lift: number;
  readonly surface: Surface;
  /** Distance along the unwrapped profile, so cross-path UVs never stretch. */
  v: number;
}

/**
 * How wide a span of paving may be before it is broken into two.
 *
 * A span is a flat chord across ground that is not flat, and the paving only
 * clears the terrain by `LIFT`, so a span the full width of the path lets the
 * ground rise through the middle of its own paving on any crest — worst on the
 * riverside walk, which runs along the top of the river bank. Raising `LIFT`
 * hides it at the cost of paving that hovers; splitting the span costs a few
 * hundred triangles and removes the cause.
 */
const SPAN_WIDTH = 1.0;

function section(path: Path): Node[] {
  const e = path.halfWidth;
  const nodes: Node[] = [
    { offset: -e - KERB - GUTTER, lift: 0, surface: 'cobble', v: 0 },
    { offset: -e - KERB, lift: -DISH, surface: 'granite', v: 0 },
    { offset: -e - KERB, lift: RISE, surface: 'granite', v: 0 },
    { offset: -e, lift: RISE, surface: 'granite', v: 0 },
  ];

  const lanes = Math.max(1, Math.round((2 * e) / SPAN_WIDTH));
  for (let lane = 0; lane < lanes; lane += 1) {
    nodes.push({ offset: -e + (2 * e * lane) / lanes, lift: 0, surface: path.surface, v: 0 });
  }

  nodes.push(
    { offset: e, lift: 0, surface: 'granite', v: 0 },
    { offset: e, lift: RISE, surface: 'granite', v: 0 },
    { offset: e + KERB, lift: RISE, surface: 'granite', v: 0 },
    { offset: e + KERB, lift: -DISH, surface: 'cobble', v: 0 },
    { offset: e + KERB + GUTTER, lift: 0, surface: 'cobble', v: 0 },
  );

  for (let i = 1; i < nodes.length; i += 1) {
    const a = nodes[i - 1]!;
    const b = nodes[i]!;
    b.v = a.v + Math.hypot(b.offset - a.offset, b.lift - a.lift);
  }
  return nodes;
}

/**
 * One cross-section of a path: where its centre is, which way it is heading and
 * how far along the centreline it is.
 *
 * `arc` is the true distance travelled rather than the axis distance, because
 * the riverside walk follows the meander and runs at up to 50° to its own axis.
 * Tiling on the axis distance there would stretch the pavers half again through
 * every bend and pinch them back on the straights.
 */
/** One corner of a quad, in site coordinates. */
type Corner = readonly [number, number];

interface Buffer {
  readonly positions: number[];
  readonly uvs: number[];
  readonly indices: number[];
}

interface Section {
  readonly centre: number;
  readonly along: number;
  readonly slope: number;
  readonly scale: number;
  readonly arc: number;
}

function sections(path: Path): Section[] {
  const steps = Math.max(1, Math.ceil((path.to - path.from) / STEP));
  const out: Section[] = [];
  let arc = 0;

  for (let step = 0; step <= steps; step += 1) {
    const along = path.from + ((path.to - path.from) * step) / steps;
    const centre = path.centre(along);
    const slope = path.centre(along + 0.5) - path.centre(along - 0.5);
    const previous = out[step - 1];
    if (previous) arc += Math.hypot(along - previous.along, centre - previous.centre);
    out.push({ centre, along, slope, scale: 1 / Math.hypot(1, slope), arc });
  }
  return out;
}

/**
 * Every paved route, **in priority order**.
 *
 * The order is load-bearing, not presentational: where two paths overlap the
 * earlier one runs through and the later one stops at its edge. See `yields`.
 */
const PATHS: readonly Path[] = [
  {
    name: 'avenue',
    route: 'avenue',
    surface: 'clay',
    halfWidth: AVENUE.halfWidth,
    from: AVENUE_RUN.from,
    // Stops at the near abutment. Past that the deck carries the walk, and
    // paving that ran on would dive into the channel the terrain cuts there.
    to: CROSSING.z - SPAN / 2,
    axis: 'z',
    centre: avenueAt,
    off: offAvenue,
  },
  {
    // The far side of the crossing — a path has two ends, and a bridge whose
    // deck lands on open grass reads as dropped into the park.
    name: 'avenue-far',
    route: 'avenue',
    surface: 'clay',
    halfWidth: AVENUE.halfWidth,
    from: CROSSING.z + SPAN / 2,
    to: AVENUE_RUN.to,
    axis: 'z',
    centre: avenueAt,
    off: offAvenue,
  },
  {
    name: 'promenade',
    route: 'promenade',
    surface: 'clay',
    halfWidth: (REALM.promenadeFar - REALM.forecourtFar) / 2,
    from: -REALM.run / 2,
    to: REALM.run / 2,
    axis: 'x',
    centre: () => PROMENADE_Z,
    off: offPromenade,
  },
  {
    // The riverside walk, set back from the bank top so the swale stays open.
    // In the photographs the path never runs along the very edge — the rough
    // ground between the two is where the reeds and the boulders are, and it is
    // most of what makes the water feel like it belongs to the landscape rather
    // than to the path.
    name: 'riverside',
    route: 'riverside',
    surface: 'clay',
    halfWidth: RIVERSIDE.halfWidth,
    from: RIVERSIDE.from,
    to: RIVERSIDE.to,
    axis: 'x',
    centre: riversideAt,
    off: offRiverside,
  },
];

/**
 * Every crossing on the network, with the junction geometry that belongs there.
 *
 * Derived from `PATHS` rather than placed, so meandering the river moves the
 * riverside walk, the crossing and its radii together.
 */
const JUNCTIONS: readonly Junction<Path>[] = crossings(PATHS);

/** How far the furthest point of a fillet's boundary is from the crossing. */
function reach(at: readonly [number, number], shape: Fillet): number {
  return shape.frames.reduce(
    (far, frame) => Math.max(far, Math.hypot(frame.x - at[0], frame.z - at[1])),
    0,
  );
}

/**
 * Whether one quad of one path's section survives where two routes meet.
 *
 * Paths are swept independently and laid on top of each other, so where two
 * meet, two full sections drive through one another — kerb and gutter across the
 * middle of the carriageway, and the two surfaces z-fighting.
 *
 * Two rules, and they are not the same rule:
 *
 * - **The minor route's carriageway stops inside the major one's own paving**,
 *   not inside its kerb. It always reaches the senior surface rather than
 *   stopping short of it; what that costs is up to a step of overlap, which
 *   `tier` makes free by putting the senior surface a few millimetres proud so
 *   it wins the depth test outright. Stopping it at the senior's *built* width
 *   instead leaves a bare strip the width of the kerb across the mouth.
 * - **Both routes' kerbs stop where the junction's own radius takes over.** That
 *   extent is the tangent point of the fillet arc, computed in `junctions.ts`
 *   from the two centrelines, so the kerb ends exactly where it stops being
 *   straight.
 *
 * The junction shape itself is the fillets' business; this function only has to
 * get out of their way.
 */
function keep(path: Path, edge: boolean, offset: number, corners: readonly Corner[]): boolean {
  if (edge) {
    const side = Math.sign(offset);
    for (const junction of JUNCTIONS) {
      for (const mouth of junction.mouths) {
        if (mouth.route !== path.route || mouth.side !== side) continue;
        // Any corner, not the middle: the ribbon can only stop on a quad
        // boundary, so it gives way generously and the fillet's straight lead
        // covers whatever gap that leaves.
        if (corners.some(([x, z]) => inMouth(mouth, x, z))) return false;
      }
    }
    return true;
  }

  const rank = PATHS.indexOf(path);
  for (let other = 0; other < rank; other += 1) {
    if (PATHS[other]!.route === path.route) continue;

    // The whole quad, not its middle. A quad is a metre of path and the routes
    // cross at an angle, so testing the centre decides a metre of ground on
    // where its midpoint happened to fall — which is exactly what left slivers
    // of lawn showing between two paved surfaces that plainly meant to meet.
    let farthest = 0;
    let outside = false;
    for (const [x, z] of corners) {
      const distance = PATHS[other]!.off(x, z);
      if (!Number.isFinite(distance)) {
        outside = true;
        break;
      }
      farthest = Math.max(farthest, distance);
    }
    if (!outside && farthest <= 0) return false;
  }

  return true;
}

/**
 * The paved public realm the building stands in.
 *
 * **Swept ribbons, not axis-aligned boxes.** The previous version was six
 * rectangles, which is fine for a forecourt and impossible for a path that
 * bends — and the reference photography is entirely of paths that bend. A
 * straight run to a centred door also shows the audience the whole answer in
 * the first frame of what is meant to be a three-scene approach.
 *
 * Every path follows `heightAt`. Standing on a flat plane over rolling ground
 * is what produced a 250 m causeway across the park, and it is also why the
 * terrain had to be held dead level under everything the paving touched.
 */
export function createRealm(textures: RealmTextures): Realm {
  const object = new Group();
  object.name = 'realm';

  const materials = new Map<Surface, MeshStandardMaterial>();
  const buffers = new Map<Surface, Buffer>();

  const surfaceBuffer = (surface: Surface): Buffer => {
    const existing = buffers.get(surface);
    if (existing) return existing;
    const created: Buffer = { positions: [], uvs: [], indices: [] };
    buffers.set(surface, created);
    return created;
  };

  /**
   * Where a node of the section lands on the ground, at one cut along the path.
   *
   * Offset along the centreline's normal rather than straight across the axis.
   * A path that swings would otherwise widen through its bends by exactly the
   * factor its centreline is running off-axis by.
   */
  const point = (path: Path, cut: Section, node: Node): [number, number] => {
    const along = cut.along - node.offset * cut.slope * cut.scale;
    const cross = cut.centre + node.offset * cut.scale;
    return path.axis === 'z' ? [cross, along] : [along, cross];
  };

  /**
   * Winding depends on which axis the path runs along, and getting it wrong is
   * invisible until it isn't: a path whose triangles face down is silently
   * backface-culled and simply does not appear, with correct vertex counts and
   * no warning anywhere. The avenue runs in +Z with its offsets in X, which is
   * the opposite handedness to a path running in +X with offsets in Z, so one
   * of the two has to be reversed to keep both normals up.
   */
  const quad = (buffer: Buffer, base: number, flip: boolean): void => {
    if (flip) buffer.indices.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
    else buffer.indices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
  };

  /**
   * One triangle of ground, wound so it faces up whatever order it arrives in.
   *
   * The fillets are fans and rings round an arc whose direction of travel
   * depends on the skew of the crossing, so there is no fixed winding that is
   * correct for all four quadrants. Deciding per triangle from its own plan
   * area is two multiplies and cannot be got wrong — and getting it wrong is
   * the failure that silently deleted the avenue's paving once already, because
   * a backface-culled surface is indistinguishable from a missing one.
   */
  const face = (buffer: Buffer, a: number, b: number, c: number): void => {
    const at = (index: number): [number, number] => [
      buffer.positions[index * 3]!,
      buffer.positions[index * 3 + 2]!,
    ];
    const [ax, az] = at(a);
    const [bx, bz] = at(b);
    const [cx, cz] = at(c);
    const turn = (bx - ax) * (cz - az) - (bz - az) * (cx - ax);
    if (turn > 0) buffer.indices.push(a, c, b);
    else buffer.indices.push(a, b, c);
  };

  /**
   * One quadrant of a junction: the paving that fills the corner, and the kerb
   * and gutter that run round its radius.
   *
   * The section is the same table the ribbons use, read outward from the
   * carriageway edge — so the band the arc carries and the band the straight
   * kerb carries are the same construction, and they meet at the tangent point
   * without anything having to be reconciled.
   */
  const fillet = (path: Path, at: readonly [number, number], shape: Fillet): void => {
    const profile = section(path).filter((node) => node.offset <= -path.halfWidth + 1e-6);
    const lift = tier(path) + TIER / 2;
    const tile = TILE[path.surface];

    // The mouth, swept from the crossing point out to the fillet's boundary.
    //
    // In rings rather than as one fan, for the reason every span of paving on
    // this site is capped at a metre: a triangle reaching five metres across
    // rolling ground is a chord, and the ground comes through the middle of it.
    const surface = surfaceBuffer(path.surface);
    const rings = Math.max(2, Math.ceil(reach(at, shape) / SPAN_WIDTH));
    const base = surface.positions.length / 3;

    for (let ring = 0; ring <= rings; ring += 1) {
      const out = ring / rings;
      for (const frame of shape.frames) {
        const x = at[0] + (frame.x - at[0]) * out;
        const z = at[1] + (frame.z - at[1]) * out;
        surface.positions.push(x, surfaceAt(x, z) + lift, z);
        surface.uvs.push(x / tile, z / tile);
      }
    }

    const span = shape.frames.length;
    for (let ring = 0; ring < rings; ring += 1) {
      for (let step = 0; step < span - 1; step += 1) {
        const near = base + ring * span + step;
        face(surface, near, near + 1, near + span);
        face(surface, near + 1, near + span + 1, near + span);
      }
    }

    // The kerb, its risers and the gutter, as rings offset along each frame's
    // own normal. Tiled on world position rather than on distance round the
    // arc: a junction is where four surfaces meet and the bond has to look
    // continuous with all of them.
    for (let node = 0; node < profile.length - 1; node += 1) {
      const inner = profile[node]!;
      const outer = profile[node + 1]!;
      const buffer = surfaceBuffer(inner.surface);
      const base = buffer.positions.length / 3;

      for (const frame of shape.frames) {
        for (const step of [inner, outer]) {
          const reach = -(step.offset + path.halfWidth);
          const x = frame.x + frame.nx * reach;
          const z = frame.z + frame.nz * reach;
          buffer.positions.push(x, surfaceAt(x, z) + lift + step.lift, z);
          buffer.uvs.push(x / TILE[inner.surface], z / TILE[inner.surface]);
        }
      }

      for (let step = 0; step < shape.frames.length - 1; step += 1) {
        const near = base + step * 2;
        face(buffer, near, near + 1, near + 2);
        face(buffer, near + 1, near + 3, near + 2);
      }
    }
  };

  const strip = (path: Path, cuts: readonly Section[], a: Node, b: Node): void => {
    const buffer = surfaceBuffer(a.surface);
    const base = buffer.positions.length / 3;
    const tile = TILE[a.surface];
    const lift = tier(path);
    // Anything that is not the carriageway is the kerb or the gutter, which is
    // what gives way at a junction while the paving itself runs through.
    const edge = a.surface !== path.surface;

    for (const cut of cuts) {
      for (const node of [a, b]) {
        const [x, z] = point(path, cut, node);
        buffer.positions.push(x, surfaceAt(x, z) + lift + node.lift, z);
        // Tiled in world metres both ways, so a 3 m path and a 250 m one read
        // as the same paving rather than as two different products.
        buffer.uvs.push(cut.arc / tile, node.v / tile);
      }
    }

    const flip = path.axis === 'z';
    for (let step = 0; step < cuts.length - 1; step += 1) {
      const near = cuts[step]!;
      const far = cuts[step + 1]!;

      const survives = keep(path, edge, a.offset, [
        point(path, near, a),
        point(path, near, b),
        point(path, far, a),
        point(path, far, b),
      ]);
      if (survives) quad(buffer, base + step * 2, flip);
    }
  };

  for (const path of PATHS) {
    const cuts = sections(path);
    const profile = section(path);
    for (let i = 0; i < profile.length - 1; i += 1) {
      strip(path, cuts, profile[i]!, profile[i + 1]!);
    }
  }

  for (const junction of JUNCTIONS) {
    for (const shape of junction.fillets) fillet(junction.senior, junction.at, shape);
  }

  console.info(
    `[exterior] realm: ${JUNCTIONS.length} junctions at ` +
      JUNCTIONS.map(
        ({ senior, minor, at }) =>
          `${senior.route}/${minor.route} (${at[0].toFixed(0)}, ${at[1].toFixed(0)})`,
      ).join(', ') +
      '.',
  );

  for (const [surface, buffer] of buffers) {
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(buffer.positions, 3));
    geometry.setAttribute('uv', new Float32BufferAttribute(buffer.uvs, 2));
    geometry.setIndex(buffer.indices);
    geometry.computeVertexNormals();

    const material = surfaceMaterial(textures[surface], surface, surface);
    materials.set(surface, material);

    const mesh = new Mesh(geometry, material);
    mesh.name = surface;
    mesh.receiveShadow = true;
    mesh.castShadow = false;
    object.add(mesh);
  }

  // The forecourt stays a plate rather than a ribbon: it is a plaza, it is the
  // one piece of ground the building's occlusion was baked against, and it is
  // the granite the split in `world_design.md` §2.2 puts at the building.
  const forecourt = new BoxGeometry(REALM.halfWidth * 2, 0.12, REALM.forecourtFar + 8);
  const stone = surfaceMaterial(
    textures.granite,
    'granite',
    'forecourt',
    REALM.halfWidth * 2,
    REALM.forecourtFar + 8,
  );
  const plate = new Mesh(forecourt, stone);
  plate.name = 'forecourt';
  plate.position.set(0, LIFT - 0.06, (REALM.forecourtFar - 8) / 2);
  plate.receiveShadow = true;
  plate.castShadow = false;
  object.add(plate);

  // The two planting beds either side of the entrance path.
  //
  // The plants have always been here — they are in `exterior-planting.glb` and
  // they stood in the Blender scene while the building's occlusion baked around
  // them. What was missing was the bed: on the web side the forecourt is one
  // granite plate, so what the audience saw was shrubs growing out of paving,
  // which is the same reading as "there should be no plants on the ground the
  // building sits on". There should be no plants on the *paving*. A bed is
  // ground given to plants, and it has to look like it.
  //
  // Standing 5 cm proud of the granite so the edge catches a line of shadow,
  // for the same reason the kerbs do.
  const bedWidth = REALM.halfWidth - REALM.pathHalfWidth;
  const bedDepth = REALM.forecourtFar - REALM.bedNear;
  const bedGeometry = new BoxGeometry(bedWidth, 0.1, bedDepth);
  const mulch = surfaceMaterial(textures.gravel, 'gravel', 'bed', bedWidth, bedDepth);

  for (const side of [-1, 1]) {
    const bed = new Mesh(bedGeometry, mulch);
    bed.name = 'bed';
    bed.position.set(
      side * (REALM.pathHalfWidth + bedWidth / 2),
      BED_TOP - 0.05,
      (REALM.bedNear + REALM.forecourtFar) / 2,
    );
    bed.receiveShadow = true;
    bed.castShadow = false;
    object.add(bed);
  }

  return {
    object,
    dispose() {
      for (const child of object.children) {
        if (child instanceof Mesh) child.geometry.dispose();
      }
      forecourt.dispose();
      bedGeometry.dispose();
      for (const material of [stone, mulch, ...materials.values()]) {
        material.map?.dispose();
        material.normalMap?.dispose();
        material.dispose();
      }
    },
  };
}

/**
 * Tiled in world metres.
 *
 * The swept ribbons carry world-metre UVs already, so they repeat at 1:1. The
 * forecourt is a box, whose UVs run 0 to 1 across each face whatever the face
 * measures, so it needs its own repeat derived from its dimensions.
 */
function surfaceMaterial(
  maps: SurfaceMaps,
  surface: Surface,
  name: string,
  width?: number,
  depth?: number,
): MeshStandardMaterial {
  const repeat = width && depth ? [width / TILE[surface], depth / TILE[surface]] : null;

  const tile = (source: Texture, srgb: boolean): Texture => {
    const texture = source.clone();
    texture.name = `${name}${srgb ? '' : '-normal'}`;
    texture.wrapS = RepeatWrapping;
    texture.wrapT = RepeatWrapping;
    // A normal map is a direction, not a colour, and decoding it through the
    // sRGB curve bends every surface angle on the path.
    if (srgb) texture.colorSpace = SRGBColorSpace;
    if (repeat) texture.repeat.set(repeat[0]!, repeat[1]!);
    texture.needsUpdate = true;
    return texture;
  };

  const finish = FINISH[surface];
  return new MeshStandardMaterial({
    map: tile(maps.map, true),
    normalMap: tile(maps.normal, false),
    normalScale: new Vector2(finish.bump, finish.bump),
    color: new Color(finish.tint),
    roughness: finish.roughness,
    metalness: 0,
  });
}
