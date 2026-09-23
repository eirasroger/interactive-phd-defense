import type { Vec3 } from '@/engine/camera/types';

/**
 * Site dimensions in metres.
 *
 * The building itself comes from `tools/blender/exterior_building.py` as baked
 * GLBs. These values must match that script. glTF export maps Blender
 * (x, y, z) to (x, z, -y), so the building faces +Z here, toward the camera.
 */

export const SITE = {
  groundSize: 900,
} as const;

export const LAND = {
  size: 900,
  /** Flat ground under the building and paving. Any slope here would lift the paving. */
  core: { halfWidth: 34, near: 26, far: -12 },
  lake: {
    west: 70,
    east: 320,
    near: 220,
    far: 58,
    surface: -1.15,
    /**
     * Basin shape. `shelf` is the shallow edge, `slope` the distance from the
     * shelf to full `depth`, `margin` the depth at the end of the shelf.
     */
    depth: 4.6,
    shelf: 7,
    slope: 55,
    margin: 0.6,
    /**
     * `shore` is the bank height above the water. `apron` is how far the lake
     * shapes the ground, and needs to be wide to cover 4.6 m of relief.
     * `beach` is the width of the bank itself.
     */
    shore: 0.75,
    apron: 34,
    beach: 7,
  },
  /** The stream flowing west out of the lake, set in a shallow grassy valley. */
  river: {
    z: 84,
    /**
     * Meander amplitude and wavelength scale (wavelength is 2π times `wave`).
     * The bank top reaches `wander + halfWidth + swale` from the centre and must
     * stay clear of the verge at 34.
     */
    wander: 13,
    wave: 18,
    /** Half the water width. */
    halfWidth: 1.8,
    /** Distance from the water's edge to the top of the bank. */
    swale: 5,
    /** Bed depth below the water surface, which falls to the west. */
    depth: 0.55,
    /** Bank top height above the water. See `riverSurface` in `paths.ts`. */
    freeboard: 1.9,
    /** Floodplain width past the bank top. */
    plain: 18,
    /**
     * The outlet. `widen` opens the mouth to about 15 m over `reach`. `scour`
     * deepens the bed at the lake and `drown` carries that dip into the lake.
     */
    mouth: { widen: 3.2, reach: 26, scour: 1.9, drown: 14 },
  },
  /** Raised ground that closes the horizon. `beyond` is the far bank of the river. */
  ridge: { side: -118, far: -60, beyond: 104, height: 7.5 },
  /** Gentle rolling ground. Anything under about a metre is invisible on a projector. */
  swell: { height: 1.2, metres: 52 },
} as const;

/** One hill: an elliptical dome, rotated in plan. Landforms combine several. */
export interface Hill {
  readonly centre: readonly [number, number];
  readonly radius: number;
  readonly height: number;
  /** Width across divided by length along. `yaw` turns the long axis. */
  readonly aspect: number;
  readonly yaw: number;
}

/**
 * Hills that fill the flat areas `LAND.ridge` leaves. The trees on them rise
 * with the ground, which breaks up the horizon.
 *
 * The knoll is a compact dome east of the building. The esker is a long ridge
 * far to the west, seen through the trees on it.
 */
export const HILLS = {
  masses: [
    // The knoll. Kept north of z = -10 so it stays off the flat forecourt.
    { centre: [64, -36], radius: 50, height: 13.5, aspect: 0.74, yaw: -0.6 },
    { centre: [110, -54], radius: 38, height: 7.5, aspect: 0.74, yaw: -0.6 },

    // The esker, placed under the treeline on the left of the overview shot.
    // It has a gap where the river runs, because the river level follows the
    // ground and would rise over any hill placed on it. The side masses run
    // east-west to fit the narrow space between the channel and the belt.
    { centre: [-196, -46], radius: 84, height: 24, aspect: 0.36, yaw: 1.5 },
    { centre: [-200, 42], radius: 74, height: 19, aspect: 0.28, yaw: 0.1 },
    { centre: [-192, 140], radius: 70, height: 16, aspect: 0.34, yaw: -0.1 },
    // A nearer shoulder on the far bank, so the near woodland has an uneven top.
    { centre: [-70, 150], radius: 62, height: 15, aspect: 0.36, yaw: -0.15 },
  ] as readonly Hill[],
  /**
   * Noise on the hill outlines in metres, at a long and a short wavelength.
   * The short one stays well above the 2.5 m ground quad size.
   */
  ragged: { broad: 14, fine: 4.5 },
  /** Where bare rock shows, as a threshold on soil thinness (high and steep ground). */
  outcrop: { from: 0.62, to: 1.2 },
} as const;

/** The avenue from the bridge to the front door. Its far end is `CROSSING` in `paths.ts`. */
export const AVENUE = {
  /** +Z of the promenade junction. */
  from: 34,
  halfWidth: 3.2,
  /** Side-to-side bow. Zero so the entrance is centred at the end of the path in scene 9. */
  wander: 0,
} as const;

/** The footbridge, placed where `AVENUE` crosses `LAND.river`. The span is `SPAN` in `paths.ts`. */
export const BRIDGE = {
  /** How far past each bank top the deck lands. */
  bearing: 1.6,
  /** Same width as the avenue. */
  halfWidth: 3.2,
  /** Deck height above the bank top, and extra rise at midspan. */
  deck: 0.09,
  camber: 0.35,
  rail: 1.1,
} as const;

/**
 * The kerb and gutter along every path: a granite kerb `rise` high, then
 * cobbles sunk `dish` below it. `realm.ts` builds the section; `offBuilt` in
 * `paths.ts` needs the width.
 */
export const PATH_EDGE = { kerb: 0.3, gutter: 0.55, rise: 0.05, dish: 0.03 } as const;

export const PATH_EDGE_WIDTH = PATH_EDGE.kerb + PATH_EDGE.gutter;

/**
 * Where each end of the riverside walk turns onto the promenade, in x. Both
 * ends turn, so the two paths form a loop with the pavilion at the east bend.
 */
const MERGE = { west: [-96, -134], east: [44, 84] } as const;

/** The riverside walk. Its centreline is `riversideAt`. */
export const RIVERSIDE = {
  from: MERGE.west[1],
  to: MERGE.east[1],
  halfWidth: 2.1,
  merge: MERGE,
} as const;

/** The park pavilion, south of the riverside walk near the lake, turned to the walk's bearing. */
export const PAVILION = {
  centre: [47, 65] as const,
  width: 17,
  depth: 7.4,
  /** Eaves height at the low end, and how much the sloped roof rises. */
  height: 3.9,
  rake: 1.3,
  /** Louvre spacing and gap. A realistic 30 mm gap is too thin to render cleanly. */
  louvre: 0.22,
  reveal: 0.06,
  /** No planting within this distance of the walls. */
  clear: 2.6,
} as const;

/** The playground. `oval` squashes it in Z so it does not look like a target from above. */
export const PLAYGROUND = {
  centre: [-42, 45] as const,
  radius: 15,
  oval: 0.72,
  fence: 1.25,
  mast: 7.5,
} as const;

/** Park planting: counts, sizes and spacing. Species come from the assets via `trees.ts`. */
export const PARK = {
  /** Max triangles per instanced tree template. Heavier species go to the woodland billboards. */
  budget: 58000,
  avenue: {
    /** Spacing between trees, and trunk distance from the path edge. */
    pitch: 9,
    standback: 3.4,
    /** The asset's own height. Scaling a spruce down makes it look thin. */
    height: 12.5,
  },
  /** Placement attempts for tree groups. About half get rejected. */
  groups: 34,
} as const;

/**
 * Rock slabs showing through the hills, mostly buried. Attempts per hectare,
 * kept only where `outcropAt` has already removed the grass.
 */
export const OUTCROP = {
  perHectare: 1400,
  /** Slab size in metres, and how flat. */
  size: [0.8, 3.0] as const,
  squat: 0.34,
  /** How far the centre sits below ground, as a fraction of size. */
  sink: 0.3,
  tone: '#565550',
} as const;

/** The woodland belt, as distance from the site centre. Eight rows deep so it reads as a forest. */
export const WOODLAND = {
  near: 96,
  far: 260,
  ranks: 8,
  /** About one tree per 20 m². Six triangles each. */
  count: 3600,
  height: { min: 9, max: 21 },
  /** The approach corridor kept clear for the overview camera. */
  corridor: { halfWidth: 46, clear: 190 },
  /** Extra trees on the far river bank, which the belt alone leaves thin. */
  bank: { count: 1100, z: [98, 156] as const, x: [-240, 64] as const },
  /**
   * Trees on the hills, per hectare. Drawn as billboards since the camera never
   * gets within 60 m of them. Full models here cost millions of triangles.
   */
  hills: { perHectare: 230, height: { min: 7, max: 17 } },
} as const;

/** Total building height, including the parapet. */
export const BUILDING_HEIGHT = 16.95;

export const BUILDING_WIDTH = 33.6;
export const BAY = 4.2;

/**
 * The main entrance on the +Z face, where Act I hands over to Act II.
 * `position.z` is the recessed ground-floor wall.
 */
export const ENTRANCE = {
  /** Two bays. Must match `ENTRANCE["width"]` in the Blender script. */
  width: BAY * 2,
  height: 3.2,
  position: [0, 1.6, 6.4] as Vec3,
  /** How far the upper floors overhang the entrance wall. */
  oversail: 1.6,
  /** How far the canopy sticks out past the columns. */
  canopyProud: 1.4,
  /**
   * Width of the fixed glass panel at each side, which is also how far each
   * door leaf slides. Matches `BAY / 2` in the Blender script.
   */
  sidelight: BAY / 2,
} as const;

/**
 * The lobby behind the doors. Mirrors `VESTIBULE` in
 * `tools/blender/exterior_building.py` (Blender y -6.4 is web z +6.4).
 *
 * The ceiling light slots in the GLB are only emissive surfaces and do not light
 * anything in three.js, so `createEntrance` adds real lights.
 */
export const VESTIBULE = {
  /** The door plane. */
  front: 6.4,
  depth: 9.0,
  height: 3.9,
  width: 11.0,
  /** Inset of the ceiling light slots from each side wall. */
  washInset: 1.1,
  recess: { width: 6.2, height: 3.2, depth: 3.0 },
} as const;

/** Back wall of the lobby, where the corridor starts. */
export const VESTIBULE_BACK = VESTIBULE.front - VESTIBULE.depth;

/**
 * The plane where the exterior stops rendering as the camera walks in. It sits
 * just past the recess, since the floor hands over there. Releasing any earlier
 * leaves the camera flying through empty space.
 */
export const THRESHOLD_Z = VESTIBULE_BACK - VESTIBULE.recess.depth - 0.1;

/**
 * The empty facade bay. It stays open in `exterior-building.glb` until Act IV,
 * when `facadeSlotFill` fills it.
 */
export const SLOT = {
  width: BAY,
  height: 12.4,
  /** Centre of the empty bay, on the brick face. */
  position: [-10.5, 10.2, 8] as Vec3,
} as const;

/**
 * The paving in front of the building, as bands parallel to the facade. Each
 * value is the +Z of the band's far edge and must match `build_paving()` in the
 * Blender script. Rebuilt here because glTF cannot carry world-scale tiling.
 */
export const REALM = {
  forecourtFar: 22.6,
  bedNear: 17.0,
  pathHalfWidth: 3.6,
  halfWidth: 25.0,
  /** No planting inside the promenade. */
  promenadeFar: 31.1,
  vergeFar: 34.1,
  /** Paving length. Must cover both ends of the riverside walk's merge. */
  run: 290.0,
} as const;

/** The row of four facade options on the promenade east of the building. */
export const REVIEW = {
  count: 4,
  /** Centre of the row, on the ground. */
  centre: [62.0, 3.7, 27.0] as Vec3,
  /**
   * The x `facade-candidates.glb` was exported at. The runtime offsets by the
   * difference. Set this to `centre[0]` after re-exporting.
   */
  baked: -95.0,
  /** Camera distance south of the row, and how far west it aims. */
  standoff: 30,
  lead: 4,
  /** Half-width of the no-planting strip. Covers the camera's view at 30 m. See `inReviewShot`. */
  clear: 24,
  spacing: 5.6,
  /** How far along the promenade the panels move when off stage, away from the building. */
  offstage: 52,
  /** Extra travel per panel so they arrive one after another, starting nearest the building. */
  stagger: 9,
  /**
   * Zone progress range where the row stands on site, from `scaffold` (7/11)
   * to `objectives` (10/11). The panels move during beats that face away from
   * them. Written as fractions because `act1/index.ts` checks them exactly
   * against `index / (count - 1)`.
   */
  from: 7 / 11,
  to: 10 / 11,
} as const;

/**
 * Zone progress at which the opening cloud clears. Tied to deck position so
 * jumping back to the title closes it again. It clears on the way to `contents`.
 */
export const CLOUD = { clears: 0 } as const;

/**
 * Zone progress at which the scaffold comes down. `gaps` (9/11) is the only
 * Act I beat facing away from the building. `act1/index.ts` checks this.
 * The empty facade bay stays open until Act IV.
 */
export const CONSTRUCTION = { struck: 9 / 11 } as const;
