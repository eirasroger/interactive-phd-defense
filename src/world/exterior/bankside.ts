import {
  Group,
  Matrix4,
  Mesh,
  type InstancedMesh,
  type Material,
  Quaternion,
  Vector3,
  type BufferGeometry,
  type Object3D,
} from 'three';
import { chunkInstances, type Chunked } from './chunking';
import {
  bankReach,
  channelHalf,
  freeboardAt,
  offAvenue,
  offBuilt,
  offPromenade,
  riverAt,
  riverSlope,
  riversideAt,
} from './paths';
import { AVENUE, LAND, REALM } from './site';
import { createStones, type StoneField } from './stones';
import { seatAt } from './terrain';

export interface Bankside {
  readonly object: Group;
  dispose(): void;
}

/** Min distance from built ground to a stem, in metres. */
const STEM = 0.05;

/** Max depth of a plant's base below the water surface. */
const WADE = -0.3;

/**
 * Species per zone, as name prefixes in the planting asset. There is no reed
 * asset, so tall grass variants stand in for reeds.
 */
const SPECIES = {
  reed: ['grass_medium_01_tall', 'grass_medium_01_geonodes_tall', 'grass_medium_02'],
  rough: ['grass_medium_01_mid', 'grass_medium_01_geonodes_mid', 'nettle_plant_tall'],
  bank: ['fern_02', 'nettle_plant_medium', 'shrub_03', 'celandine_01'],
  verge: ['shrub_02', 'shrub_01', 'shrub_03'],
  mass: ['shrub_02'],
} as const;

/**
 * River bank plants, path verges and boulders. The bank planting is what makes
 * the water read as a stream (see `river_besides_pathway`).
 *
 * Blender exports one template per species. This places every instance using
 * the same centrelines as the paving and terrain, so the bank follows the river.
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

  let refused = 0;

  /** Places one plant, sized by its final height in metres. */
  const plant = (group: keyof typeof SPECIES, x: number, z: number, metres: number): void => {
    // Checked at the stem only, so verge shrubs can lean over the gutter.
    if (offBuilt(x, z) <= STEM) {
      refused += 1;
      return;
    }

    const spread = Math.min(metres * 0.4, 0.9);
    const y = seatAt(x, z, spread);
    // Allow shallow water only, measured from the local water level.
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

  const chunks: Chunked[] = [];

  for (const [name, list] of placements) {
    const [key, index] = name.split(':');
    const template = templates.get(key!)?.[Number(index)];
    if (!template) continue;

    // Split into cells so they can be culled. See `chunking.ts`.
    const chunked = chunkInstances(
      { geometry: template.geometry, material: template.material, matrices: list },
      key!,
    );
    chunks.push(chunked);

    for (const mesh of chunked.meshes) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      object.add(mesh);
      meshes.push(mesh);
    }
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
      for (const chunk of chunks) chunk.dispose();
      stones.dispose();
    },
  };
}

type Plant = (group: keyof typeof SPECIES, x: number, z: number, size: number) => void;

/**
 * Both river banks, from the waterline to the bank top. Plants are densest and
 * tallest at the water, thinning to rough grass at the top.
 */
function scatterBanks(random: () => number, plant: Plant): void {
  const { lake } = LAND;

  for (let x = lake.west + 6; x > -300; x -= 0.8) {
    const centre = riverAt(x);
    const slope = riverSlope(x);
    const across = 1 / Math.hypot(1, slope);
    // Follows the channel's width, including the outlet flare.
    const top = bankReach(x);

    for (const side of [-1, 1]) {
      for (let i = 0; i < 4; i += 1) {
        // Starts at the waterline and is biased toward it.
        const shore = channelHalf(x) * 1.6;
        const t = random() ** 1.7;
        const offset = side * (shore + t * (top - shore));
        const jitter = (random() - 0.5) * 1.1;

        const px = x - offset * slope * across + jitter;
        const pz = centre + offset * across;

        // Chest-high at the water, knee-high at the bank top.
        const wet = 1 - t;
        const group = wet > 0.55 ? 'reed' : wet > 0.25 ? 'rough' : 'bank';
        plant(group, px, pz, 0.55 + wet * 1.15);
      }
    }
  }
}

/** Shrub strips along the path edges, outside the gutter. */
function scatterVerges(random: () => number, plant: Plant): void {
  const gutter = 1.0;

  // `plant` keeps shrubs off paving. Here we also keep junctions open.
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

/** Boulders along the waterline. They break up its otherwise perfect curve. */
function boulders(random: () => number): StoneField {
  const { lake } = LAND;

  return createStones('boulders', '#66645d', random, (place) => {
    for (let x = lake.west + 4; x > -300; x -= 2.2) {
      if (random() > 0.55) continue;
      const centre = riverAt(x);
      const slope = riverSlope(x);
      const across = 1 / Math.hypot(1, slope);

      const side = random() < 0.5 ? -1 : 1;
      // Half in, half out of the water.
      const offset = side * channelHalf(x) * (0.55 + random() * 0.95);
      const px = x - offset * slope * across + (random() - 0.5) * 1.4;
      const pz = centre + offset * across;

      place(px, pz, 0.22 + random() ** 2 * 0.42, 1, 0.22);
    }
  });
}

/**
 * Templates per species, keyed by node-name prefix. Geometry keeps its world
 * rotation and scale but is moved to the origin.
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
    // Keep the three cheapest variants. Triangle counts vary a lot between them.
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
  /** Asset height, so instances can be sized in metres. */
  readonly height: number;
}
