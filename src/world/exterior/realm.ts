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
  CROSSING,
  offAvenue,
  offPromenade,
  offRiverside,
  riversideAt,
  SPAN,
} from './paths';
import { AVENUE, REALM, RIVERSIDE } from './site';
import { heightAt } from './terrain';

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
}

type Surface = keyof RealmTextures;

/** How many metres of ground one tile of each texture covers, from Poly Haven. */
const TILE: Record<Surface, number> = { clay: 1.8, granite: 1.88, cobble: 1.8 };

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
};

/** How far the paving floats above the terrain it follows. */
const LIFT = 0.09;

/**
 * Metres between sections along a path.
 *
 * Also the granularity at which a junction can break, since the crossing is
 * expressed by dropping whole quads. At 2.5 m the avenue's kerb ended in
 * visible 2.5 m teeth either side of the riverside walk.
 */
const STEP = 1.2;

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
const KERB = 0.3;
const GUTTER = 0.55;
const RISE = 0.05;
const DISH = 0.03;

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

function section(path: Path): Node[] {
  const e = path.halfWidth;
  const nodes: Node[] = [
    { offset: -e - KERB - GUTTER, lift: 0, surface: 'cobble', v: 0 },
    { offset: -e - KERB, lift: -DISH, surface: 'granite', v: 0 },
    { offset: -e - KERB, lift: RISE, surface: 'granite', v: 0 },
    { offset: -e, lift: RISE, surface: 'granite', v: 0 },
    { offset: -e, lift: 0, surface: path.surface, v: 0 },
    { offset: e, lift: 0, surface: 'granite', v: 0 },
    { offset: e, lift: RISE, surface: 'granite', v: 0 },
    { offset: e + KERB, lift: RISE, surface: 'granite', v: 0 },
    { offset: e + KERB, lift: -DISH, surface: 'cobble', v: 0 },
    { offset: e + KERB + GUTTER, lift: 0, surface: 'cobble', v: 0 },
  ];

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

const PROMENADE_Z = (REALM.forecourtFar + REALM.promenadeFar) / 2;

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
    from: AVENUE.from - 3,
    // Stops at the near abutment. Past that the deck carries the walk, and
    // paving that ran on would dive into the channel the terrain cuts there.
    to: CROSSING.z - SPAN / 2,
    axis: 'z',
    centre: avenueAt,
    off: offAvenue,
  },
  {
    // The far side of the crossing. The walk used to simply stop at the bridge,
    // so the deck's south end landed on open grass — which is most of why the
    // structure read as dropped into the park rather than as carrying a route
    // through it. A path has two ends.
    name: 'avenue-far',
    route: 'avenue',
    surface: 'clay',
    halfWidth: AVENUE.halfWidth,
    from: CROSSING.z + SPAN / 2,
    to: CROSSING.z + SPAN / 2 + 24,
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
 * Whether a piece of one path gives way to another where they cross.
 *
 * Paths were being swept independently and laid on top of each other, which is
 * fine until two of them meet — and the riverside walk crosses the avenue at
 * exactly the point the camera stands for two scenes. What that produced was
 * two full sections driven through one another: a granite kerb and a cobble
 * gutter running straight across the middle of the avenue, the two carriageways
 * z-fighting where they overlapped, and no junction anywhere in it.
 *
 * A real junction is two rules, and they are not the same rule:
 *
 * - **The minor route stops at the major one's edge.** Its whole section ends
 *   where the avenue's gutter begins; the avenue carries through unbroken.
 * - **The major route drops its kerb and gutter across the minor one's mouth.**
 *   Otherwise the avenue is walled along the very stretch you have to step
 *   across to reach the other path.
 *
 * Both are asked of the path network rather than of hand-placed junction boxes,
 * so meandering the river moves the crossing and the treatment follows it.
 */
function yields(path: Path, edge: boolean, x: number, z: number): boolean {
  const rank = PATHS.indexOf(path);

  for (let other = 0; other < PATHS.length; other += 1) {
    if (PATHS[other]!.route === path.route) continue;
    const distance = PATHS[other]!.off(x, z);
    if (!Number.isFinite(distance)) continue;

    // Junior to it: give way across its whole built width.
    if (other < rank && distance <= KERB + GUTTER) return true;
    // Senior to it: keep the carriageway, drop the edge across its mouth.
    if (other > rank && edge && distance === 0) return true;
  }

  return false;
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
  const buffers = new Map<Surface, { positions: number[]; uvs: number[]; indices: number[] }>();

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

  const strip = (path: Path, cuts: readonly Section[], a: Node, b: Node): void => {
    const surface = a.surface;
    const buffer = buffers.get(surface) ?? { positions: [], uvs: [], indices: [] };
    buffers.set(surface, buffer);

    const base = buffer.positions.length / 3;
    const tile = TILE[surface];
    // Anything that is not the carriageway is the kerb or the gutter, which is
    // what breaks at a junction while the paving itself runs through.
    const edge = a.surface !== path.surface;

    for (const cut of cuts) {
      for (const node of [a, b]) {
        const [x, z] = point(path, cut, node);
        buffer.positions.push(x, heightAt(x, z) + LIFT + node.lift, z);
        // Tiled in world metres both ways, so a 3 m path and a 250 m one read
        // as the same paving rather than as two different products.
        buffer.uvs.push(cut.arc / tile, node.v / tile);
      }
    }

    // Winding depends on which axis the path runs along, and getting it wrong
    // is invisible until it isn't: a path whose triangles face down is silently
    // backface-culled and simply does not appear, with correct vertex counts
    // and no warning anywhere. The avenue runs in +Z with its offsets in X,
    // which is the opposite handedness to a path running in +X with offsets in
    // Z, so one of the two has to be reversed to keep both normals up.
    const flip = path.axis === 'z';
    for (let step = 0; step < cuts.length - 1; step += 1) {
      const near = cuts[step]!;
      const far = cuts[step + 1]!;
      const [x0, z0] = point(path, near, a);
      const [x1, z1] = point(path, far, b);
      if (yields(path, edge, (x0 + x1) / 2, (z0 + z1) / 2)) continue;

      const i = base + step * 2;
      if (flip) buffer.indices.push(i, i + 2, i + 1, i + 1, i + 2, i + 3);
      else buffer.indices.push(i, i + 1, i + 2, i + 1, i + 3, i + 2);
    }
  };

  for (const path of PATHS) {
    const cuts = sections(path);
    const profile = section(path);
    for (let i = 0; i < profile.length - 1; i += 1) {
      strip(path, cuts, profile[i]!, profile[i + 1]!);
    }
  }

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

  return {
    object,
    dispose() {
      for (const child of object.children) {
        if (child instanceof Mesh) child.geometry.dispose();
      }
      forecourt.dispose();
      for (const material of [stone, ...materials.values()]) {
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
