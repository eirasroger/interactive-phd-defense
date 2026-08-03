import type { Vec3 } from '@/engine/camera/types';

/**
 * The site, in world units.
 *
 * The building's *form* is owned by `tools/blender/exterior_building.py` and
 * arrives as baked GLBs. What lives here is only what the runtime also needs:
 * the dimensions camera poses and the shadow frustum are derived from.
 *
 * **These must agree with the Blender script.** Blender is Z-up and builds the
 * building facing -Y; glTF y-up export maps Blender (x, y, z) to (x, z, -y), so
 * the building faces +Z here — the direction the camera approaches from.
 */

export const SITE = {
  groundSize: 900,
} as const;

/**
 * The land the park sits in, as a plan.
 *
 * The exterior used to be a flat 900 m plane with a painted cylinder at 420 m,
 * and the emptiness that produced was not a planting problem — it was that the
 * eye reached the edge of the world and found nothing stopping it. Three
 * hundred metres of mown lawn in every direction cannot be filled; filling it
 * costs everything and still reads as empty.
 *
 * So the site is **bounded rather than filled.** A lake to the north, rising
 * ground and woodland closing the other three sides, and nothing beyond the
 * canopy line that has to exist at all — because nothing beyond it can be seen.
 * The whole far field becomes somebody else's problem for the cost of a ridge
 * and eight hundred billboards.
 *
 * Blender is Z-up facing -Y and glTF maps that to web +Z, so **the camera
 * approaches from +Z** and the lake goes at -Z, read past the building on the
 * establishing sightline that currently ends in nothing.
 */
export const LAND = {
  size: 900,
  /**
   * The flat ground the building and its paving stand on.
   *
   * Everything inside this stays at y = 0 because the realm bands in
   * `realm.ts` are flat boxes and the building's AO was baked against level
   * ground. Landform outside it is free; landform inside it would float the
   * paving or bury it.
   *
   * It now stops at the promenade's far verge rather than 42 m past it. The
   * old value held the whole avenue corridor dead level, which is most of why
   * the park read as a table — the one stretch of ground the camera walks down
   * for three consecutive scenes was the one stretch guaranteed to be flat.
   */
  core: { halfWidth: 34, near: 26, far: -12 },
  /**
   * The lake, in the +X quadrant, reaching past the camera on the east side.
   *
   * It used to sit at −Z, behind the building, where no Act I pose could see
   * more than a band of it either side of the massing — water that cannot be
   * seen is not worth its draw call. Out here it is square on from the bridge,
   * read past the building's east flank on the overview, and it is what the
   * river visibly issues from.
   */
  lake: {
    west: 70,
    east: 320,
    near: 220,
    far: 58,
    surface: -1.15,
    depth: 3.4,
    /**
     * How far above the water the shore stands, and how far the apron reaches.
     *
     * The same fix as the river's freeboard and for the same reason: the basin
     * was cut to an absolute level into ground that is free to roll below it,
     * so around a third of the shoreline was under its own water. A lake with
     * no beach anywhere is a puddle painted on a field.
     */
    shore: 0.75,
    apron: 34,
  },
  /**
   * The stream, running west out of the lake across every sightline out of the
   * site.
   *
   * Narrow, stony and set in a grassy swale rather than banked between walls —
   * `river_besides_pathway` is a channel you look *down* into from a bridge,
   * with the water surface a good two metres below the path. That drop is the
   * whole reason it works as a boundary at close range: it stops the eye
   * without standing anything in the way.
   *
   * The surface falls west from the lake outlet, because water that leaves a
   * lake goes downhill and a level stream reads as a moat.
   */
  river: {
    z: 84,
    /**
     * Meander amplitude, and the wavelength it repeats over.
     *
     * `wave` is the sine's argument scale, so the plan wavelength is 2π times
     * it. At 74 that was 465 m for a 404 m river — under one bend end to end,
     * which is a canal with a kink in it. Rivers meander at ten to fourteen
     * channel widths, and this channel is 7.2 m wide, so the wavelength wants
     * to be near 110 m and the amplitude a good fraction of it.
     *
     * Amplitude is capped by what it runs between: the bank top reaches
     * `wander + halfWidth + swale` off centre, and at 13 that is 52 m at the
     * nearest, still clear of the promenade's verge at 34.
     */
    wander: 13,
    wave: 18,
    /**
     * Half the wetted width, and it is small.
     *
     * `river_besides_pathway` is a stream you could nearly step across — three
     * metres of open water, and most of that hidden under bank vegetation. At
     * 3.6 this was a 7.2 m channel, which is a river rather than the park brook
     * the photograph shows, and a wide flat sheet is exactly what read as a
     * canal.
     */
    halfWidth: 1.8,
    /**
     * How far each bank takes to climb from the water back to grade.
     *
     * This was 13 m for a 1.5 m drop — a 6° slope, which is not a bank, it is a
     * lawn with a wet bit in the middle. The channel read as a flat dark stripe
     * lying on the park with no sense of depth at all.
     *
     * `river_besides_pathway` is a channel you look *down into*: a couple of
     * metres of fall over three or four, steep enough that the far bank is a
     * face rather than a foreshortened plane. That is what stops the eye, and it
     * is entirely a question of the angle rather than of the width.
     */
    swale: 5,
    /**
     * How far the bed sits below the water, not what level it is at.
     *
     * Held as a depth rather than an absolute height because the surface falls
     * west, and a bed at a fixed level under a falling surface eventually rises
     * through it and the stream runs dry at the far end. A real bed parallels
     * its own water.
     *
     * The depth of the *valley* and the depth of the *water* are two different
     * numbers, and conflating them cost the stream its character twice over:
     * nearly two metres of water in the first version, 1.2 m in the second, both
     * far past the range the bed shading fades over, so the channel rendered as
     * one flat opaque colour bank to bank. A park stream is ankle-deep. The
     * valley is what has the two metres in it.
     */
    depth: 0.55,
    /**
     * How far the top of the bank stands above the water.
     *
     * This replaces the two absolute surface levels that used to live here.
     * They were chosen against a flat plane and did not survive the relief
     * being added: for most of its length the stream's surface sat *above* the
     * ground beside it, which is why it read as a teal stripe lying on the lawn
     * with no bank, no valley and a bridge crossing nothing.
     *
     * Held as a freeboard instead, the water is *by construction* below its own
     * banks wherever the ground goes — see `riverSurface` in `paths.ts`. The
     * value is what `river_besides_pathway` shows: a channel you look down into
     * from about two metres, over a swale of four or five, which is a bank you
     * read as a face rather than as a foreshortened plane.
     */
    freeboard: 1.9,
    /**
     * How far the floodplain reaches past the top of the bank.
     *
     * The band over which the surrounding relief is eased to the bank top. Too
     * narrow and the valley is a trench with a rim; too wide and the stream
     * flattens the whole park. This is roughly three channel widths, which is
     * what a small watercourse actually occupies.
     */
    plain: 18,
  },
  /**
   * Where the ground lifts to close a sightline.
   *
   * `beyond` is the rise on the far bank of the river, which is what the
   * audience looks at across the water from the bridge — and the only one of
   * the three that appears in a foreground beat.
   */
  ridge: { side: -118, far: -60, beyond: 104, height: 7.5 },
  /**
   * Amplitude and wavelength of the undulation that stops the rest reading as
   * a stage.
   *
   * At 0.75 m this was defensible as a real park grade and completely invisible
   * on a projector — the ground read as flat because at a hundred metres and a
   * grazing angle, a metre of fall across fifty is below the threshold at which
   * anything occludes anything else. Relief only starts doing its job when a
   * near rise hides a far hollow, and that needs metres, not centimetres.
   */
  swell: { height: 1.2, metres: 52 },
} as const;

/**
 * The avenue — the tree-lined walk from the bridge to the front door.
 *
 * Act I's last three scenes happen on it, and the reference photograph it comes
 * from (`tree_rich_path_toward_building`) is a *curve*: the path bows away and
 * the canopy closes over the bend, so the end is implied before it is seen. A
 * straight run to a centred door shows the audience the whole answer in the
 * first frame of a three-scene approach.
 *
 * The bow is a half sine, so the centreline arrives on axis at both ends — it
 * meets the promenade square and it meets the bridge square — and swings
 * `wander` metres out of line in between. Nothing has to be reconciled at
 * either junction.
 *
 * Where it *ends* is not a number here. The avenue ends at the bridge and the
 * bridge is where the river is, so the far end is `CROSSING` in `paths.ts` —
 * derived, so that meandering the river moves the bridge and the walk with it.
 */
export const AVENUE = {
  /** +Z of the promenade junction. */
  from: 34,
  halfWidth: 3.2,
  /**
   * Straight, by decision.
   *
   * The bow was 5.5 m and its whole purpose was to hide the entrance until the
   * walk was most of the way down it. The brief for scene 9 asks for the
   * opposite — the entrance centred at the end of the path — and for the door
   * to be visible from the bridge. Both cannot be true, and the terminated
   * vista won.
   *
   * The parameter stays rather than the bow being deleted, because the machinery
   * that reads it is correct and only the value is a preference. What now has to
   * carry the interest over 50 m is the tree rows and the lamp rhythm, which is
   * how a formal avenue works anyway.
   */
  wander: 0,
} as const;

/**
 * The footbridge, where the avenue crosses the stream.
 *
 * The hinge of the walk: standing on it the lake is east, the river runs west,
 * and the building closes the avenue behind you. Its position is not authored —
 * it is the intersection of `AVENUE` and `LAND.river`, so the three cannot
 * drift apart.
 */
export const BRIDGE = {
  /**
   * How far past the top of each bank the deck lands.
   *
   * The span itself is not a number here — it is `SPAN` in `paths.ts`, measured
   * from the channel the bridge actually has to cross at the skew the avenue
   * actually crosses it at. A typed span is a claim about a meander, and the
   * meander wins.
   */
  bearing: 1.6,
  /**
   * Deck width, and it is the avenue's.
   *
   * A footbridge is a piece of the path. At 2.2 m the deck was two-thirds of the
   * walk that ran onto it, so the paving visibly necked down at the abutment and
   * the two read as separate objects that happened to touch.
   */
  halfWidth: 3.2,
  /** Deck surface above the bank top, and how much it rises at midspan. */
  deck: 0.09,
  camber: 0.35,
  rail: 1.1,
} as const;

/**
 * The built strip either side of every carriageway.
 *
 * A narrow granite kerb standing `rise` proud of the paving, then a strip of
 * small cobbles dished `dish` below it as a gutter against the planting. The
 * section itself is `realm.ts`'s business; what lives here is the width,
 * because it is not only a paving dimension — it is the edge everything else on
 * the site has to keep clear of, and `offBuilt` in `paths.ts` needs the same
 * number the paving is built from. Two copies of it is two different answers to
 * where the path stops.
 */
export const PATH_EDGE = { kerb: 0.3, gutter: 0.55, rise: 0.05, dish: 0.03 } as const;

/** How far the built edge reaches past the carriageway, in metres. */
export const PATH_EDGE_WIDTH = PATH_EDGE.kerb + PATH_EDGE.gutter;

/**
 * The riverside walk, as the reach it runs over.
 *
 * Its centreline is `riversideAt`; what lives here is only where it starts and
 * stops, which both the paving and every scatter that has to keep clear of it
 * need to know. It was previously buried in `realm.ts`'s path table, so nothing
 * else could ask whether it was standing on it — and things were.
 */
export const RIVERSIDE = {
  from: -78,
  to: 62,
  halfWidth: 2.1,
} as const;

/**
 * The children's playground, in the west park between promenade and river.
 *
 * Placed rather than positioned: it has to sit north of the promenade, south of
 * the river's bank top, east of the review row's clearance, and out of the
 * avenue's terminated vista. That leaves one pocket of open ground and this is
 * its middle.
 *
 * `oval` squashes the enclosure in Z so it does not read as a target from the
 * overview pose, which is the one shot that sees it in plan.
 */
export const PLAYGROUND = {
  centre: [-42, 45] as const,
  radius: 15,
  oval: 0.72,
  fence: 1.25,
  mast: 7.5,
} as const;

/**
 * The park's planting plan.
 *
 * Trees themselves are not described here — they are whichever trees the
 * planting asset happens to carry, addressed through `trees.ts`. What lives
 * here is the plan: how many, how big, and how far off the walk. Swap the
 * species in `fetch_assets.py` and every number below still means what it says.
 */
export const PARK = {
  /**
   * Triangles a template may cost before the park declines to instance it.
   *
   * Expressed as a budget rather than as a list of allowed species, because the
   * asset is free to change and the frame budget is not. Poly Haven's conifers
   * ship an LOD ladder from two million triangles down to twenty thousand; this
   * is what decides which rung the park is standing on, and a species that
   * arrives too heavy is simply left to the woodland belt, which photographs it
   * onto a billboard and never pays for its geometry.
   */
  budget: 58000,
  avenue: {
    /**
     * Metres between ranks, and how far the trunk stands off the paved edge.
     *
     * The standback is beyond the shrub verge and beyond the gutter, so the
     * canopy overhangs the walk — which is the whole point of an avenue — while
     * the trunk never stands in it. `plantable` then enforces the same thing
     * against the crown's actual radius, so a broad species pushes itself out
     * rather than growing through the paving.
     */
    pitch: 9,
    standback: 3.4,
    /**
     * Height, and it is the asset's own.
     *
     * The rows were first planted at 8.5 m, which is the size a young street
     * tree is and the size the old jacaranda canopy was assembled at. These are
     * not street trees — they are fourteen-metre spruce, and squashing one to
     * 8.5 m does not make a young spruce, it makes a mature one rendered thin:
     * the trunk stays as slender as it was modelled and the crown comes down
     * with it, so a row of them reads as scrub rather than as an avenue.
     */
    height: 12.5,
  },
  /**
   * Informal groups in the open grass, two to four trees each.
   *
   * An attempt count, not a tree count: roughly half are refused for standing
   * in a path, in the playground or in the water, which is the clearance rules
   * working rather than a fault. `[parkland]` prints both numbers.
   */
  groups: 34,
} as const;

/**
 * The woodland belt, as radial distance from the site centre.
 *
 * Deep rather than tall is the whole trick: six ranks of billboards at
 * increasing distance read as a wood you cannot see into, where one rank reads
 * as a row of trees with a horizon behind it.
 */
export const WOODLAND = {
  near: 96,
  far: 260,
  ranks: 8,
  /**
   * One tree per ~20 m², which is what a managed northern wood actually
   * carries. At 900 it was one per 65 m² and you could see clean through the
   * belt to the fog behind it — which defeats the only thing the belt is for.
   * They are six triangles each; density here is free and thinness is not.
   */
  count: 3600,
  height: { min: 9, max: 21 },
  /**
   * The approach corridor, kept clear well past the belt.
   *
   * This replaces a uniform standoff across the whole +Z half. The overview
   * pose has to stand 150 m back to hold the building, the lake, the river and
   * the avenue in one frame, and a belt at a uniform radius puts that camera
   * inside the wood — but pushing the *entire* near side back that far also
   * strips the far bank of the river, which is the treeline the audience looks
   * at across the water from the bridge in two separate scenes.
   *
   * So only the wedge the camera actually occupies is cleared. Either side of
   * it the wood comes right down to the far bank, and the gap on the axis is
   * where the sky and the distant district read through.
   */
  corridor: { halfWidth: 46, clear: 190 },
  /**
   * The far bank of the river, planted denser than the belt behind it.
   *
   * A wooded bank at 100 m is the single most-seen piece of landscape in the
   * act — it closes the view from the bridge, from the avenue and from the
   * riverside path. The belt's radial scatter alone leaves it thin, because at
   * that radius the annulus is barely into its first rank.
   */
  bank: { count: 1100, z: [98, 156] as const, x: [-240, 64] as const },
  /** No trees inside this, or they stand in the shot the review row needs. */
  clear: { x: [-120, -70] as const, z: [18, 66] as const },
} as const;

/** Overall height of the massing, parapet cap included. */
export const BUILDING_HEIGHT = 16.95;

/** Width across the elevation, and the bay module it is composed from. */
export const BUILDING_WIDTH = 33.6;
export const BAY = 4.2;

/**
 * The main entrance, on the +Z face.
 *
 * This is the hinge between Act I and Act II: the last shot of the exterior is
 * square to this opening, and the corridor begins behind it. Keeping it as a
 * named constant means the Act I camera and the Act II threshold are derived
 * from one position rather than two that can drift.
 *
 * It sits in the recessed ground floor, so `position.z` is the set-back wall
 * line and not the face of the mass above it.
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
 * The specification slot — one bay of brick cladding never placed.
 *
 * Act I's device, and the only part of the building that differs between Act I
 * and Act IV. The bay is permanently unclad in `exterior-building.glb`; the
 * cladding that fills it in Act IV is `facadeSlotFill`, a separate asset.
 *
 * Three Act I scenes are framed on it and Act IV returns to it, so it is a
 * named position rather than a number repeated in four camera poses.
 */
export const SLOT = {
  width: BAY,
  height: 12.4,
  /** Centre of the vacant bay, on the brick face. */
  position: [-10.5, 10.2, 8] as Vec3,
} as const;

/**
 * The public realm, as bands running parallel to the elevation.
 *
 * No carriageway and no kerbs: the building stands in a pedestrian park, so the
 * approach is a promenade wide enough to read as public space rather than as a
 * pavement. Values are the +Z distances of each band's far edge from the origin,
 * and must agree with `build_paving()` in the Blender script — the same ground
 * is lit there and rebuilt here.
 *
 * It is rebuilt in Three.js rather than exported because it is six boxes whose
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
  /**
   * A 600 m ribbon ran the promenade out past the edge of the world in both
   * directions, which is as much of the emptiness as the bare lawn was. Paving
   * now stops inside the woodland belt, where a path ending is what a path
   * does rather than something the eye has to explain.
   */
  run: 250.0,
} as const;

/**
 * The review row — where the four options stand, far west of the building.
 *
 * They used to hang in the air overlapping the vacant bay, which asked one
 * shot to carry the building, the slot and four alternatives at once. They then
 * stood close enough that Act I's westward poses kept catching them at a frame
 * edge, and keeping the building's corner in their own shot forced a 43 m
 * standoff that left them small.
 *
 * Out here neither constraint applies. No other pose can reach them, so the
 * travel on and off is genuinely unobserved, and their own camera comes in to
 * 30 m. Nothing of the building is in that frame; the link back to the vacant
 * bay is carried by the scenes either side, which are both on it.
 *
 * Positions are baked into `facade-candidates.glb`; what lives here is the
 * travel. They enter from off the west edge of frame and leave the same way,
 * so nothing is ever seen appearing or vanishing on the spot. Must agree with
 * `REVIEW` in the Blender script.
 */
export const REVIEW = {
  count: 4,
  /** Centre of the row, on the ground plane. */
  centre: [-95.0, 3.7, 27.0] as Vec3,
  /** How far south of the row its own camera stands, and how far west it aims. */
  standoff: 30,
  lead: 4,
  spacing: 5.6,
  /** How far west of their resting place the panels park, in metres. */
  offstage: 52,
  /**
   * Extra travel per panel, so the row assembles and disperses in sequence
   * rather than sliding as one rigid object. Applied east to west, so the
   * panel nearest the building arrives first and the row builds away from it —
   * the reverse would have the far panels crossing through the near ones.
   */
  stagger: 9,
  /**
   * The span of zone progress over which the row stands on site.
   *
   * It opens a scene *before* the options are looked at and closes a scene
   * after, and that is the whole point. The panels travel at the moment the
   * span opens and closes, which is a moment the camera is settled on the
   * building with the review row well outside the frustum — so they are only
   * ever seen standing, never seen arriving.
   *
   * Act I's scene order decides these numbers, so `act1/index.ts` asserts the
   * deck still agrees with them. Insert a scene anywhere before `practice` and
   * the row would otherwise stay parked off frame for the whole act, with the
   * scene that argues about it playing to an empty promenade.
   */
  from: 0.4,
  to: 0.7,
} as const;
