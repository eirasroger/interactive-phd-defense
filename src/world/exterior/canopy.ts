/**
 * Canopy density field the terrain samples to change the ground under trees
 * (litter, shade, unmown grass). Built from the seeded tree plan at load, so it
 * always matches the trees.
 *
 * Overlapping discs add up, then an exponential saturates the sum into 0 to 1.
 * A lone tree makes a small patch and a group makes one larger, darker patch.
 */
export interface CanopyField {
  /** Register a crown of this radius, in site metres. */
  add(x: number, z: number, radius: number, weight?: number): void;
  /** Canopy over this point: 0 open ground, 1 dense shade. */
  sample(x: number, z: number): number;
  readonly count: number;
}

/**
 * Patch reach = crown radius * SPREAD + MARGIN (metres), about twice the crown.
 * Smaller looks like a hard-edged shadow and is lost on the terrain's 2.5 m
 * vertex grid. Larger merges all trees into one stain.
 */
const SPREAD = 2.1;
const MARGIN = 2.4;

/** Lookup grid cell size in metres. Larger than any crown's reach. */
const CELL = 24;

/** How fast overlapping crowns saturate. Two touching trees reach about 0.8. */
const DENSITY = 0.95;

export function createCanopyField(): CanopyField {
  const xs: number[] = [];
  const zs: number[] = [];
  const reaches: number[] = [];
  const weights: number[] = [];
  const cells = new Map<number, number[]>();

  const key = (ix: number, iz: number): number => ix * 73856093 + iz * 19349663;

  return {
    add(x: number, z: number, radius: number, weight = 1): void {
      const reach = radius * SPREAD + MARGIN;
      const index = xs.length;
      xs.push(x);
      zs.push(z);
      reaches.push(reach);
      weights.push(weight);

      // Added to every cell the disc touches, so a sample checks only its own cell.
      const from = Math.floor((x - reach) / CELL);
      const to = Math.floor((x + reach) / CELL);
      const near = Math.floor((z - reach) / CELL);
      const far = Math.floor((z + reach) / CELL);

      for (let ix = from; ix <= to; ix += 1) {
        for (let iz = near; iz <= far; iz += 1) {
          const id = key(ix, iz);
          const bucket = cells.get(id);
          if (bucket) bucket.push(index);
          else cells.set(id, [index]);
        }
      }
    },

    sample(x: number, z: number): number {
      const bucket = cells.get(key(Math.floor(x / CELL), Math.floor(z / CELL)));
      if (!bucket) return 0;

      let sum = 0;
      for (const index of bucket) {
        const reach = reaches[index]!;
        const dx = x - xs[index]!;
        const dz = z - zs[index]!;
        const squared = (dx * dx + dz * dz) / (reach * reach);
        if (squared >= 1) continue;
        // Flat at the centre and zero-slope at the edge, so no visible ring.
        const falloff = 1 - squared;
        sum += weights[index]! * falloff * falloff;
      }

      return 1 - Math.exp(-sum * DENSITY);
    },

    get count(): number {
      return xs.length;
    },
  };
}
