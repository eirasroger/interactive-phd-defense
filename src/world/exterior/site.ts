import type { Vec3 } from '@/engine/camera/types';

/**
 * The site, in world units. Metres throughout.
 *
 * The building's form is owned by `tools/blender/exterior_building.py` and
 * arrives as baked GLBs; what lives here is only what the runtime also needs.
 * **These must agree with the Blender script.** Blender is Z-up and builds the
 * building facing -Y; glTF export maps Blender (x, y, z) to (x, z, -y), so the
 * building faces +Z here — the direction the camera approaches from.
 */

export const SITE = {
  groundSize: 900,
} as const;

/** The land the park sits in, as a plan. */
export const LAND = {
  size: 900,
  /** Level ground the building and its paving stand on. Landform inside it would float the paving. */
  core: { halfWidth: 34, near: 26, far: -12 },
  lake: {
    west: 70,
    east: 320,
    near: 220,
    far: 58,
    surface: -1.15,
    /**
     * The basin, as a bowl rather than a pan. `shelf` is the shallow margin the
     * river's gravel runs out into, `slope` how far past it the bed takes to
     * reach `depth`, `margin` the depth where the shelf ends.
     */
    depth: 4.6,
    shelf: 7,
    slope: 55,
    margin: 0.6,
    /**
     * How far above the water the shore stands, how far the apron reaches, and
     * how far the ground takes to reach `shore`.
     *
     * `apron` is the reach over which the lake governs the ground at all, and
     * has to be wide because the relief swings 4.6 m. `beach` is the bank's own
     * form. Running them together grades 0.75 m over 34 m — a 1.3° mudflat, and
     * the ground shading keys its silt line on freeboard.
     */
    shore: 0.75,
    apron: 34,
    beach: 7,
  },
  /**
   * The stream, running west out of the lake across every sightline out of the
   * site. Narrow and stony, set in a grassy swale rather than banked between
   * walls: a channel you look *down* into from a bridge.
   */
  river: {
    z: 84,
    /**
     * Meander amplitude, and the sine's argument scale — plan wavelength is 2π
     * times it. Rivers meander at ten to fourteen channel widths. Amplitude is
     * capped by what it runs between: the bank top reaches
     * `wander + halfWidth + swale` off centre, still clear of the verge at 34.
     */
    wander: 13,
    wave: 18,
    /** Half the wetted width. A park brook, not a river. */
    halfWidth: 1.8,
    /** How far each bank takes to climb from the water back to grade. */
    swale: 5,
    /**
     * How far the bed sits below the water, not what level it is at — the
     * surface falls west, and a bed at a fixed level under a falling surface
     * rises through it. The depth of the *valley* is `freeboard`, not this.
     */
    depth: 0.55,
    /**
     * How far the top of the bank stands above the water. The water is by
     * construction below its own banks wherever the ground goes — see
     * `riverSurface` in `paths.ts`.
     */
    freeboard: 1.9,
    /** How far the floodplain reaches past the bank top. Roughly three channel widths. */
    plain: 18,
    /**
     * The outlet.
     *
     * `widen` opens the mouth from 3.6 m to 15 m across and `reach` is how far
     * back up the run that reaches. `scour` is how much deeper the bed is at the
     * lake, and `drown` how far inside the lake that fall keeps going — the
     * scour straddles the shoreline rather than finishing on it, so the bed can
     * be 1.3 m under at the outlet while the bank above still lies back at 8°.
     */
    mouth: { widen: 3.2, reach: 26, scour: 1.9, drown: 14 },
  },
  /** Where the ground lifts to close a sightline. `beyond` is the far bank of the river. */
  ridge: { side: -118, far: -60, beyond: 104, height: 7.5 },
  /**
   * Amplitude and wavelength of the undulation that stops the rest reading as a
   * stage. Relief only works when a near rise hides a far hollow, which needs
   * metres — at 0.75 m it was invisible on a projector.
   */
  swell: { height: 1.2, metres: 52 },
} as const;

/**
 * The avenue — the walk from the bridge to the front door.
 *
 * Where it ends is not a number here: the avenue ends at the bridge and the
 * bridge is where the river is, so the far end is `CROSSING` in `paths.ts`.
 */
export const AVENUE = {
  /** +Z of the promenade junction. */
  from: 34,
  halfWidth: 3.2,
  /**
   * Bow amplitude, as a half sine so the centreline arrives on axis at both
   * ends. Zero by decision: scene 9 wants the entrance centred at the end of the
   * path, which a bow exists to hide.
   */
  wander: 0,
} as const;

/**
 * The footbridge. Its position is not authored — it is the intersection of
 * `AVENUE` and `LAND.river`. The span is `SPAN` in `paths.ts`, measured at the
 * skew the avenue actually crosses at.
 */
export const BRIDGE = {
  /** How far past the top of each bank the deck lands. */
  bearing: 1.6,
  /** Deck width, and it is the avenue's — a footbridge is a piece of the path. */
  halfWidth: 3.2,
  /** Deck surface above the bank top, and how much it rises at midspan. */
  deck: 0.09,
  camber: 0.35,
  rail: 1.1,
} as const;

/**
 * The built strip either side of every carriageway: a granite kerb standing
 * `rise` proud, then cobbles dished `dish` below it as a gutter.
 *
 * The section is `realm.ts`'s business; the width lives here because `offBuilt`
 * in `paths.ts` needs the same number the paving is built from.
 */
export const PATH_EDGE = { kerb: 0.3, gutter: 0.55, rise: 0.05, dish: 0.03 } as const;

/** How far the built edge reaches past the carriageway. */
export const PATH_EDGE_WIDTH = PATH_EDGE.kerb + PATH_EDGE.gutter;

/**
 * The riverside walk, as the reach it runs over. Its centreline is
 * `riversideAt`; what lives here is where it starts and stops, which every
 * scatter that has to keep clear of it needs.
 */
export const RIVERSIDE = {
  /** The west end, deep inside the woodland belt — the connection is implied, not built. */
  from: -134,
  /** The east end, at the lake shore, where the pavilion gives the walk a destination. */
  to: 62,
  halfWidth: 2.1,
  /** Where the turn toward the promenade begins and ends, in x. Outside `WOODLAND.clear`. */
  merge: { from: -96, to: -134 },
} as const;

/**
 * The park pavilion, beside the riverside walk at the lake end.
 *
 * Placed rather than positioned: south of the walk, clear of the lake's apron,
 * far enough back that the path still reaches open water. Its rotation is the
 * walk's own bearing.
 */
export const PAVILION = {
  centre: [47, 65] as const,
  width: 17,
  depth: 7.4,
  /** Eaves at the low end, and how much the wedge roof climbs across the plan. */
  height: 3.9,
  rake: 1.3,
  /**
   * Louvre pitch and the gap between boards. Coarse on purpose: at a true 30 mm
   * reveal the shadow line is under two pixels from anywhere the camera stands,
   * so it aliases into static rather than reading as a line.
   */
  louvre: 0.22,
  reveal: 0.06,
  /** How far past the wall nothing may be planted. */
  clear: 2.6,
} as const;

/**
 * The children's playground. `oval` squashes the enclosure in Z so it does not
 * read as a target from the overview pose.
 */
export const PLAYGROUND = {
  centre: [-42, 45] as const,
  radius: 15,
  oval: 0.72,
  fence: 1.25,
  mast: 7.5,
} as const;

/**
 * The park's planting plan — how many, how big, how far off the walk. The
 * species are whatever the asset carries, addressed through `trees.ts`.
 */
export const PARK = {
  /**
   * Triangles a template may cost before the park declines to instance it. The
   * assets ship an LOD ladder from two million triangles down to twenty
   * thousand; this decides which rung is used, and a species that arrives too
   * heavy is left to the woodland belt's billboards.
   */
  budget: 58000,
  avenue: {
    /**
     * Metres between ranks, and how far the trunk stands off the paved edge.
     * The standback is beyond the gutter so the canopy overhangs the walk while
     * the trunk never stands in it.
     */
    pitch: 9,
    standback: 3.4,
    /** Height, and it is the asset's own — scaling a mature spruce down renders it thin. */
    height: 12.5,
  },
  /** Informal groups in the open grass. An attempt count: roughly half are refused. */
  groups: 34,
} as const;

/**
 * The woodland belt, as radial distance from the site centre. Deep rather than
 * tall: eight ranks read as a wood you cannot see into, one rank reads as a row
 * of trees with a horizon behind it.
 */
export const WOODLAND = {
  near: 96,
  far: 260,
  ranks: 8,
  /** One tree per ~20 m², which is what a managed northern wood carries. Six triangles each. */
  count: 3600,
  height: { min: 9, max: 21 },
  /**
   * The approach corridor, kept clear well past the belt. Only the wedge the
   * overview camera occupies is cleared — a uniform standoff also strips the far
   * bank of the river, which two scenes look straight at.
   */
  corridor: { halfWidth: 46, clear: 190 },
  /**
   * The far bank of the river, planted denser than the belt behind it. At that
   * radius the belt's annulus is barely into its first rank, so it comes out thin.
   */
  bank: { count: 1100, z: [98, 156] as const, x: [-240, 64] as const },
} as const;

/** Overall height of the massing, parapet cap included. */
export const BUILDING_HEIGHT = 16.95;

/** Width across the elevation, and the bay module it is composed from. */
export const BUILDING_WIDTH = 33.6;
export const BAY = 4.2;

/**
 * The main entrance, on the +Z face — the hinge between Act I and Act II. It
 * sits in the recessed ground floor, so `position.z` is the set-back wall line
 * rather than the face of the mass above it.
 */
export const ENTRANCE = {
  width: 6.4,
  height: 3.2,
  /** Centre of the opening, on the set-back ground-floor wall. */
  position: [0, 1.6, 6.4] as Vec3,
  /** How far the mass above oversails the entrance wall. */
  oversail: 1.6,
  /** How far the canopy projects past the column line, toward the camera. */
  canopyProud: 1.4,
} as const;

/**
 * The specification slot — one bay of brick cladding never placed, and the only
 * part of the building that differs between Act I and Act IV. The bay is
 * permanently unclad in `exterior-building.glb`; `facadeSlotFill` fills it.
 */
export const SLOT = {
  width: BAY,
  height: 12.4,
  /** Centre of the vacant bay, on the brick face. */
  position: [-10.5, 10.2, 8] as Vec3,
} as const;

/**
 * The public realm, as bands running parallel to the elevation. Values are the
 * +Z distances of each band's far edge, and must agree with `build_paving()` in
 * the Blender script — the same ground is lit there and rebuilt here.
 *
 * Rebuilt in Three.js rather than exported because it is six boxes whose
 * materials tile in world metres, which glTF has no way to carry.
 */
export const REALM = {
  /** Paved forecourt, from the building face out. */
  forecourtFar: 22.6,
  /** Planting beds, inset from the entrance path. */
  bedNear: 17.0,
  pathHalfWidth: 3.6,
  halfWidth: 25.0,
  /** Pedestrian promenade. Nothing may be planted inside this band. */
  promenadeFar: 31.1,
  vergeFar: 34.1,
  /** Paving stops inside the woodland belt, where a path ending is what a path does. */
  run: 250.0,
} as const;

/**
 * The review row — where the four options stand, on the promenade east of the
 * building, thirty-odd metres from the scaffold pose and on the same side of the
 * site so the two beats are one continuous move.
 */
export const REVIEW = {
  count: 4,
  /** Centre of the row, on the ground plane. */
  centre: [62.0, 3.7, 27.0] as Vec3,
  /**
   * Where `facade-candidates.glb` was exported from, in x. The runtime stands
   * the row at `centre` and carries the difference; set this to `centre[0]` once
   * the asset is re-exported.
   */
  baked: -95.0,
  /** How far south of the row its own camera stands, and how far west it aims. */
  standoff: 30,
  lead: 4,
  /**
   * Half-width of the corridor nothing may be planted in. Wider than the row,
   * because what has to stay clear is the frame: at the 30 m standoff a 40° lens
   * covers nineteen metres either side of the aim point. See `inReviewShot`.
   */
  clear: 24,
  spacing: 5.6,
  /**
   * How far along the promenade, away from the building, the panels park. The
   * direction is the sign of `centre[0]`, so the row always walks off to the
   * outside of the site.
   */
  offstage: 52,
  /**
   * Extra travel per panel so the row assembles in sequence, applied from the
   * building outward — the reverse would have far panels crossing near ones.
   */
  stagger: 9,
  /**
   * The span of zone progress over which the row stands on site: `scaffold`
   * (5/10) to `objectives` (8/10), bracketing `alternatives` at 6/10. The travel
   * happens on beats that face away from the row, so the panels are only ever
   * seen standing. `act1/index.ts` asserts the deck still agrees with these.
   */
  from: 0.5,
  to: 0.8,
} as const;
