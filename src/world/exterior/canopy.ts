/**
 * Where the ground is under something, as a field the terrain can ask.
 *
 * Grass does not grow the same under a tree as it does in the open, and the
 * difference is the strongest cue there is that a tree is *standing on* the
 * ground rather than placed on it. Leaf litter, root plate, shade and the
 * mower's inability to get close all land in the same place, so one scalar
 * carries all four.
 *
 * A field rather than a texture because the trees are not authored — they are
 * scattered from a seeded plan at load, and a painted map would be a second
 * description of the same thing, drifting the moment the seed changes.
 *
 * Density is **additive and then saturated**, which is what makes a lone tree a
 * small patch and a group a single larger, darker one without either being
 * asked for. Overlapping discs sum; the exponential keeps the sum inside 0..1
 * however many of them there are.
 */
export interface CanopyField {
  /** Register a crown of this radius, in site metres. */
  add(x: number, z: number, radius: number, weight?: number): void;
  /** How much canopy is over this point: 0 open ground, 1 dense shade. */
  sample(x: number, z: number): number;
  readonly count: number;
}

/**
 * How far past the crown the ground still knows about the tree.
 *
 * Litter falls wider than the canopy and the mower keeps further off than the
 * litter, so the patch is meaningfully larger than the crown. Under it and the
 * ring reads as a shadow with a hard edge; well over it and every tree on the
 * site joins into one continuous stain.
 *
 * There is also a floor set by what samples this. The terrain carries the field
 * per vertex on a 2.5 m grid, so a patch has to be several quads across to be a
 * patch at all — at a crown's own radius it lands on two vertices and the
 * interpolation flattens it to nothing. That is a real constraint rather than a
 * fudge: the visible thing is the rough ground around a tree, and it genuinely
 * is about twice the crown.
 */
const SPREAD = 2.1;
const MARGIN = 2.4;

/** Metres of the lookup grid. Comfortably over the largest reach a crown has. */
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

      // Registered in every cell the disc touches, so a sample only ever has to
      // look in the one cell it falls in.
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
        // Flat under the crown and tangent at the edge, so neither the trunk
        // nor the rim of the patch reads as a ring.
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
