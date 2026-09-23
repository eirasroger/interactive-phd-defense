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

/** Metres of ground covered by one texture tile (Poly Haven sizes). */
const TILE: Record<Surface, number> = { clay: 1.8, granite: 1.88, cobble: 1.8, gravel: 1.5 };

/**
 * Per-surface tint, roughness and normal strength. The clay tint mutes the
 * bright terracotta texture so the paths do not outshine the building.
 */
const FINISH: Record<Surface, { tint: number; roughness: number; bump: number }> = {
  clay: { tint: 0xa8867a, roughness: 0.93, bump: 0.7 },
  // Cooled so it contrasts with the red pavers and brick (`world_design.md` §2.2).
  granite: { tint: 0xadb2b4, roughness: 0.82, bump: 0.6 },
  cobble: { tint: 0xb2b2ae, roughness: 0.95, bump: 1.1 },
  gravel: { tint: 0x8b8272, roughness: 0.97, bump: 0.5 },
};

/** Paving height above the terrain, so the ground never pokes through on crests. */
const LIFT = 0.11;

/**
 * Height step between routes in `PATHS` order. Where two paths overlap, the
 * higher-priority one wins the depth test.
 */
const TIER = 0.004;

function tier(path: Path): number {
  return LIFT + (PATHS.length - 1 - PATHS.indexOf(path)) * TIER;
}

/**
 * Top of the entrance beds. `planting.ts` seats the bed plants at this height,
 * since the terrain under the forecourt is lower.
 */
export const BED_TOP = LIFT + 0.05;

/**
 * Metres between path cross-sections. Also sets how finely junctions can cut
 * the paving and how closely it follows the ground.
 */
const STEP = 0.9;

/**
 * Path section (see `work/act1_photo_ideas/`): paving, a granite kerb raised
 * 5 cm so it casts a shadow line, then a dished cobble gutter.
 */
const { kerb: KERB, gutter: GUTTER, rise: RISE, dish: DISH } = PATH_EDGE;

interface Path {
  readonly name: string;
  /** Route this segment belongs to. Segments of the same route never cut each other. */
  readonly route: string;
  readonly surface: Surface;
  readonly halfWidth: number;
  readonly from: number;
  readonly to: number;
  /** The axis the path runs along, and its centre at a position along that axis. */
  readonly axis: 'x' | 'z';
  readonly centre: (along: number) => number;
  /** Distance to this path's paving. Zero on it. */
  readonly off: (x: number, z: number) => number;
}

/**
 * One point of the path cross-section, left to right. `surface` is the material
 * of the span starting here. A repeated offset makes a vertical riser. Offsets
 * only increase, which keeps triangle winding consistent.
 */
interface Node {
  readonly offset: number;
  readonly lift: number;
  readonly surface: Surface;
  /** Distance along the profile, used as the cross-path UV. */
  v: number;
}

/** Max paving span width. Wider spans let the ground poke through on crests. */
const SPAN_WIDTH = 0.8;

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

/** One corner of a quad, in site coordinates. */
type Corner = readonly [number, number];

interface Buffer {
  readonly positions: number[];
  readonly uvs: number[];
  readonly indices: number[];
}

/**
 * One cross-section of a path. `arc` is the distance along the curved
 * centreline, so textures do not stretch on bends.
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

/**
 * All paved routes in priority order. Where two overlap, the earlier one runs
 * through and the later one stops at its edge. See `keep`.
 */
const PATHS: readonly Path[] = [
  {
    name: 'avenue',
    route: 'avenue',
    surface: 'clay',
    halfWidth: AVENUE.halfWidth,
    from: AVENUE_RUN.from,
    // Stops at the bridge.
    to: CROSSING.z - SPAN / 2,
    axis: 'z',
    centre: avenueAt,
    off: offAvenue,
  },
  {
    // Continues on the far side of the bridge.
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
    // Set back from the bank top, leaving room for reeds and boulders.
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

/** Every path crossing with its junction geometry, computed from `PATHS`. */
const JUNCTIONS: readonly Junction<Path>[] = crossings(PATHS);

/** Distance from the crossing to the furthest point of a fillet. */
function reach(at: readonly [number, number], shape: Fillet): number {
  return shape.frames.reduce(
    (far, frame) => Math.max(far, Math.hypot(frame.x - at[0], frame.z - at[1])),
    0,
  );
}

/**
 * Whether a quad of a path section is kept where two routes meet.
 *
 * - The lower-priority route's paving stops inside the higher one's paving.
 *   `tier` hides the small overlap.
 * - Kerbs stop where the junction's curved corner begins (from `junctions.ts`).
 * - A kerb never crosses any other path's paving. This covers merges, which
 *   have no curved corner.
 */
function keep(path: Path, edge: boolean, offset: number, corners: readonly Corner[]): boolean {
  if (edge) {
    const side = Math.sign(offset);
    for (const junction of JUNCTIONS) {
      for (const mouth of junction.mouths) {
        if (mouth.route !== path.route || mouth.side !== side) continue;
        // Any corner counts. The fillet covers the resulting gap.
        if (corners.some(([x, z]) => inMouth(mouth, x, z))) return false;
      }
    }

    for (const other of PATHS) {
      if (other.route === path.route) continue;
      if (corners.some(([x, z]) => other.off(x, z) === 0)) return false;
    }
    return true;
  }

  const rank = PATHS.indexOf(path);
  for (let other = 0; other < rank; other += 1) {
    if (PATHS[other]!.route === path.route) continue;

    // Drop the quad only if all four corners are on the other path's paving.
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
 * Paving around the building. Paths are swept along their curved centrelines
 * and follow the terrain height.
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

  /** Plan position of a section node, offset along the centreline normal so bends keep their width. */
  const point = (path: Path, cut: Section, node: Node): [number, number] => {
    const along = cut.along - node.offset * cut.slope * cut.scale;
    const cross = cut.centre + node.offset * cut.scale;
    return path.axis === 'z' ? [cross, along] : [along, cross];
  };

  /**
   * Paths along Z need the opposite winding from paths along X to face up.
   * Wrong winding makes the path silently disappear through backface culling.
   */
  const quad = (buffer: Buffer, base: number, flip: boolean): void => {
    if (flip) buffer.indices.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
    else buffer.indices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
  };

  /** Adds a triangle, flipping its winding if needed so it always faces up. */
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
   * One junction corner: the paving that fills it, plus the kerb and gutter
   * around its curve. Uses the same section as the straight paths so they meet
   * cleanly.
   */
  const fillet = (path: Path, at: readonly [number, number], shape: Fillet): void => {
    const profile = section(path).filter((node) => node.offset <= -path.halfWidth + 1e-6);
    const lift = tier(path) + TIER / 2;
    const tile = TILE[path.surface];

    // Paving from the crossing point out to the corner edge, in rings so it
    // follows the ground.
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

    // Kerb and gutter around the curve. UVs use world position so the pattern
    // lines up with the surrounding paving.
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
    // Kerb or gutter.
    const edge = a.surface !== path.surface;

    for (const cut of cuts) {
      for (const node of [a, b]) {
        const [x, z] = point(path, cut, node);
        buffer.positions.push(x, surfaceAt(x, z) + lift + node.lift, z);
        // UVs in world metres so every path tiles at the same scale.
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

  // The forecourt is a flat granite plate, matching the ground the building's AO was baked on.
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

  // Planting beds on each side of the entrance path, for the plants in
  // `exterior-planting.glb`. Raised 5 cm so the edge casts a shadow.
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
 * Surface material tiled in world metres. Paths already have world-metre UVs.
 * Boxes pass `width` and `depth` to get a matching repeat.
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
    // Only colour maps are sRGB. Normal maps stay linear.
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
