import {
  Color,
  FrontSide,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  type Material,
  Quaternion,
  Vector3,
  type BufferGeometry,
  type Object3D,
} from 'three';
import {
  freeboardAt,
  offAvenue,
  offBuilt,
  offPromenade,
  riverAt,
  riverSlope,
  riversideAt,
} from './paths';
import { AVENUE, LAND, REALM } from './site';
import { seatAt, surfaceAt } from './terrain';

export interface Bankside {
  readonly object: Group;
  dispose(): void;
}

/** How far clear of built ground a stem has to be, in metres. */
const STEM = 0.05;

/** How deep a plant's base may sit below the water surface it stands in. */
const WADE = -0.3;

/**
 * What grows where, as name prefixes into the planting asset.
 *
 * The reeds are `grass_medium_01`'s tall variants rather than a reed asset,
 * because there is no reed asset and at 1.2 m a tall grass clump is exactly what
 * the photograph's bank is: rough tussock, not cattail.
 */
const SPECIES = {
  reed: ['grass_medium_01_tall', 'grass_medium_01_geonodes_tall', 'grass_medium_02'],
  rough: ['grass_medium_01_mid', 'grass_medium_01_geonodes_mid', 'nettle_plant_tall'],
  bank: ['fern_02', 'nettle_plant_medium', 'shrub_03', 'celandine_01'],
  verge: ['shrub_02', 'shrub_01', 'shrub_03'],
  mass: ['shrub_02'],
} as const;

/**
 * The bank vegetation, the path verges and the boulders.
 *
 * **This is what makes the river a river.** The channel had been narrowed,
 * darkened, meandered and re-shaded across two sessions chasing a complaint that
 * it read as a flat dark stripe, and the shader was never the problem: in
 * `river_besides_pathway` the water *is* a flat dark stripe, glimpsed between
 * masses of tussock and willow with pale boulders breaking the waterline. Take
 * the banks away and no water shader on earth reads as a stream.
 *
 * Placed here rather than in Blender, which is the change of contract task #21
 * describes. Blender exports one template of each species at origin; this puts
 * every instance on the ground from the same centrelines the paving and the
 * terrain use. Nothing can drift, the bank follows the meander for free, and the
 * 26 MB of duplicated transforms in the asset stops being the way density is
 * bought.
 */
export function createBankside(source: Object3D): Bankside {
  const object = new Group();
  object.name = 'bankside';

  const templates = collect(source);
  const placements = new Map<string, Matrix4[]>();
  const meshes: InstancedMesh[] = [];

  let seed = 0x71c33d;
  const random = (): number => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0x100000000;
  };

  const matrix = new Matrix4();
  const spin = new Quaternion();
  const up = new Vector3(0, 1, 0);
  const scale = new Vector3();
  const seat = new Vector3();

  /**
   * Place one plant, sized in **metres of finished height** rather than as a
   * multiple of whatever the asset happens to measure.
   *
   * Scaling by a bare factor was the first version and it put 2468 plants on the
   * site that were individually invisible: the templates come out of Poly Haven
   * at their own scales, so a factor of one means a different size for every
   * species. Normalising through the bounding box is what lets a reed bed be
   * specified as "1.6 m tall" and actually be 1.6 m tall.
   */
  let refused = 0;

  const plant = (group: keyof typeof SPECIES, x: number, z: number, metres: number): void => {
    // Never on built ground. Measured at the stem rather than over the
    // footprint, because a verge shrub is planted hard against the gutter on
    // purpose and its foliage is meant to lean over it — refusing it by its own
    // spread would delete precisely the row that gives the walk its edge.
    if (offBuilt(x, z) <= STEM) {
      refused += 1;
      return;
    }

    const spread = Math.min(metres * 0.4, 0.9);
    const y = seatAt(x, z, spread);
    // Reeds stand in the shallows and that is the point; nothing stands out in
    // open water. The line is drawn at ankle depth in the water's own terms
    // rather than at an absolute level, because the stream falls along its run.
    if (freeboardAt(x, z, y) < WADE) {
      refused += 1;
      return;
    }

    const options = SPECIES[group];
    const key = options[Math.floor(random() * options.length)]!;
    const pool = templates.get(key);
    if (!pool || pool.length === 0) return;

    const index = Math.floor(random() * pool.length);
    const template = pool[index]!;
    const name = `${key}:${index}`;
    const list = placements.get(name) ?? [];
    placements.set(name, list);

    spin.setFromAxisAngle(up, random() * Math.PI * 2);
    const unit = (metres * (0.78 + random() * 0.5)) / template.height;
    scale.set(unit * (0.85 + random() * 0.35), unit, unit * (0.85 + random() * 0.35));
    seat.set(x, y, z);
    list.push(matrix.clone().compose(seat, spin, scale));
  };

  scatterBanks(random, plant);
  scatterVerges(random, plant);

  for (const [name, list] of placements) {
    const [key, index] = name.split(':');
    const template = templates.get(key!)?.[Number(index)];
    if (!template) continue;

    const mesh = new InstancedMesh(template.geometry, template.material, list.length);
    list.forEach((transform, i) => mesh.setMatrixAt(i, transform));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.name = key!;
    object.add(mesh);
    meshes.push(mesh);
  }

  const stones = boulders(random);
  object.add(stones.object);

  const planted = [...placements.values()].reduce((total, list) => total + list.length, 0);
  console.info(
    `[bankside] ${planted} plants in ${meshes.length} draws (${refused} refused), ` +
      `${stones.object.count} boulders.`,
  );

  return {
    object,
    dispose() {
      for (const mesh of meshes) mesh.dispose();
      stones.dispose();
    },
  };
}

type Plant = (group: keyof typeof SPECIES, x: number, z: number, size: number) => void;

/**
 * Both banks of the stream, from the waterline to the top of the swale.
 *
 * Density is graded across the section rather than uniform, and that grading is
 * the whole read: tallest and thickest right at the water where it is wettest,
 * thinning to rough grass at the bank top. A bank planted evenly reads as a
 * green stripe; one that thickens toward the water reads as a watercourse.
 */
function scatterBanks(random: () => number, plant: Plant): void {
  const { river, lake } = LAND;
  const top = river.halfWidth + river.swale;

  for (let x = lake.west + 6; x > -300; x -= 0.8) {
    const centre = riverAt(x);
    const slope = riverSlope(x);
    const across = 1 / Math.hypot(1, slope);

    for (const side of [-1, 1]) {
      for (let i = 0; i < 4; i += 1) {
        // Biased toward the water: squaring the sample puts most of the mass in
        // the wet third of the section.
        //
        // The inner bound is the *waterline*, not the bed's half-width. The bed
        // is flat only out to `halfWidth` and then climbs, and it climbs a good
        // way before it breaks the surface — so a scatter starting at the bed's
        // edge put nearly half its plants out in open water, where they are
        // refused, and the density that was meant to be thickest at the water
        // was thinnest there instead.
        const shore = river.halfWidth * 1.6;
        const t = random() ** 1.7;
        const offset = side * (shore + t * (top - shore));
        const jitter = (random() - 0.5) * 1.1;

        const px = x - offset * slope * across + jitter;
        const pz = centre + offset * across;

        // Heights straight off the photograph: waist-to-chest tussock at the
        // water, thinning to knee-high rough grass at the bank top.
        const wet = 1 - t;
        const group = wet > 0.55 ? 'reed' : wet > 0.25 ? 'rough' : 'bank';
        plant(group, px, pz, 0.55 + wet * 1.15);
      }
    }
  }
}

/**
 * Shrub ribbons along the path edges, outside the cobble gutter.
 *
 * In the reference photography every path has one, and it is doing something
 * a lawn cannot: it gives the walk a wall at knee-to-waist height, so the paving
 * reads as a route through planting rather than as a strip laid on a field.
 */
function scatterVerges(random: () => number, plant: Plant): void {
  const gutter = 1.0;

  // Standing on the paving is refused by `plant` itself now, against the whole
  // path network rather than against whichever route this loop happens to run
  // beside. What is left at the call site is the one thing the network cannot
  // know: a junction has to stay open, so the verge holds well back from where
  // the avenue meets the promenade.
  for (let z = AVENUE.from - 2; z < 80; z += 0.85) {
    for (const side of [-1, 1]) {
      const x = side * (AVENUE.halfWidth + gutter + random() * 2.6);
      if (offPromenade(x, z) < 4) continue;
      plant(random() < 0.55 ? 'mass' : 'verge', x, z, 1.0 + random() * 0.85);
    }
  }

  const promenade = (REALM.forecourtFar + REALM.promenadeFar) / 2;
  const reach = (REALM.promenadeFar - REALM.forecourtFar) / 2 + gutter;
  for (let x = -REALM.run / 2; x < REALM.run / 2; x += 1.1) {
    for (const side of [-1, 1]) {
      const z = promenade + side * (reach + random() * 3.2);
      if (offAvenue(x, z) < 4) continue;
      plant(random() < 0.6 ? 'mass' : 'verge', x, z, 1.0 + random() * 0.9);
    }
  }

  for (let x = -78; x < 62; x += 1.2) {
    for (const side of [-1, 1]) {
      const z = riversideAt(x) + side * (2.95 + random() * 2.8);
      plant(random() < 0.5 ? 'mass' : 'verge', x, z, 0.9 + random() * 0.7);
    }
  }
}

/**
 * Granite boulders, along the waterline and scattered through the swale.
 *
 * Procedural rather than scanned. A boulder is a convex lump, and a jittered
 * icosahedron at 20 triangles is indistinguishable from a 40 000-triangle
 * photogrammetry scan at every distance this is ever seen from — while the scan
 * that was rejected for the asset list was 96 MB on its own.
 *
 * They do two jobs. They furnish the bank the way the photograph's do, and they
 * break the waterline, which is otherwise the clean mathematical curve where a
 * 2.5 m terrain grid meets a swept ribbon.
 */
function boulders(random: () => number): { object: InstancedMesh; dispose(): void } {
  const { river, lake } = LAND;
  const geometry = new IcosahedronGeometry(1, 1);
  const position = geometry.getAttribute('position');
  const lump = new Vector3();

  for (let i = 0; i < position.count; i += 1) {
    lump.fromBufferAttribute(position, i);
    lump.multiplyScalar(0.74 + random() * 0.5);
    lump.y *= 0.72;
    position.setXYZ(i, lump.x, lump.y, lump.z);
  }
  geometry.computeVertexNormals();

  const material = new MeshStandardMaterial({
    color: new Color('#6f6d66'),
    roughness: 0.92,
    metalness: 0,
    side: FrontSide,
  });

  const transforms: Matrix4[] = [];
  const matrix = new Matrix4();
  const spin = new Quaternion();
  const axis = new Vector3();
  const scale = new Vector3();
  const seat = new Vector3();

  for (let x = lake.west + 4; x > -300; x -= 2.2) {
    if (random() > 0.55) continue;
    const centre = riverAt(x);
    const slope = riverSlope(x);
    const across = 1 / Math.hypot(1, slope);

    const side = random() < 0.5 ? -1 : 1;
    // Straddling the waterline — half in, half out, which is the only placement
    // that actually breaks the edge rather than sitting beside it.
    const offset = side * river.halfWidth * (0.55 + random() * 0.95);
    const px = x - offset * slope * across + (random() - 0.5) * 1.4;
    const pz = centre + offset * across;

    const size = 0.22 + random() ** 2 * 0.42;
    axis.set(random() - 0.5, random() - 0.5, random() - 0.5).normalize();
    spin.setFromAxisAngle(axis, random() * Math.PI);
    scale.set(size, size * (0.6 + random() * 0.5), size * (0.8 + random() * 0.5));
    seat.set(px, surfaceAt(px, pz) + size * 0.22, pz);
    transforms.push(matrix.clone().compose(seat, spin, scale));
  }

  const mesh = new InstancedMesh(geometry, material, transforms.length);
  transforms.forEach((transform, i) => mesh.setMatrixAt(i, transform));
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.name = 'boulders';

  return {
    object: mesh,
    dispose() {
      geometry.dispose();
      material.dispose();
      mesh.dispose();
    },
  };
}

/**
 * One usable template per species variant, keyed by node-name prefix.
 *
 * The geometry is **rebaked to the origin with its world rotation and scale**,
 * and skipping that step is what made the first version render nothing visible.
 * A GLB node's geometry is in local space and its real size lives in the parent
 * chain's transform; take the geometry alone and you get a plant at whatever
 * arbitrary scale the authoring tool happened to use. Dropping only the
 * translation keeps the size and the orientation and discards the placement,
 * which is the one part this module is replacing.
 */
function collect(source: Object3D): Map<string, Template[]> {
  const candidates = new Map<string, Mesh[]>();
  const keys = [...new Set(Object.values(SPECIES).flat())];

  source.traverse((node) => {
    if (!(node instanceof Mesh)) return;
    const name = node.name || node.parent?.name || '';
    const key = keys.find((candidate) => name.startsWith(candidate));
    if (!key) return;
    candidates.set(key, [...(candidates.get(key) ?? []), node]);
  });

  const templates = new Map<string, Template[]>();
  const world = new Matrix4();

  for (const [key, meshes] of candidates) {
    // Three variants of each is plenty; past that every extra template is
    // another draw call buying a difference nobody can see.
    //
    // **The cheapest three, not the first three.** Poly Haven ships a shrub as
    // nine variants of the same plant whose triangle counts run from 700 to
    // 23 000, in no particular order — so taking whichever three the traversal
    // reached first was a coin toss between a 700-triangle bank and a
    // 23 000-triangle one for a plant that is 30 cm tall and seen at twenty
    // metres. Nothing about that choice is visible; all of it is payable.
    const chosen = [...meshes]
      .map((mesh) => ({ mesh, cost: triangles(mesh) }))
      .filter((entry) => entry.cost > 0)
      .sort((a, b) => a.cost - b.cost)
      .slice(0, 3);

    const pool: Template[] = [];
    for (const { mesh } of chosen) {
      mesh.updateWorldMatrix(true, false);
      world.copy(mesh.matrixWorld).setPosition(0, 0, 0);

      const geometry = mesh.geometry.clone();
      geometry.applyMatrix4(world);
      geometry.computeBoundingBox();

      const box = geometry.boundingBox;
      pool.push({
        geometry,
        material: mesh.material as Material,
        height: Math.max(0.05, box ? box.max.y - box.min.y : 1),
      });
    }
    if (pool.length > 0) templates.set(key, pool);
  }

  const missing = keys.filter((key) => !templates.has(key));
  if (missing.length > 0) console.warn(`[bankside] no template for ${missing.join(', ')}`);
  return templates;
}

function triangles(mesh: Mesh): number {
  const { geometry } = mesh;
  return (geometry.index?.count ?? geometry.getAttribute('position')?.count ?? 0) / 3;
}

interface Template {
  readonly geometry: BufferGeometry;
  readonly material: Material;
  /** Natural height of the asset, so instances can be sized in metres. */
  readonly height: number;
}
