import { AVENUE, BRIDGE, LAND, PLAYGROUND, REALM, REVIEW, RIVERSIDE } from './site';

/**
 * The centrelines the site is laid out from.
 *
 * Every other module in the zone asks this one where things run. The terrain
 * eases its relief along the avenue, the realm sweeps its paving down it, the
 * bridge spans the river at it, the lamp posts step along it and the planting
 * stands back from it — and none of them carries its own copy of the geometry.
 *
 * That matters more here than it looks. The reference photography is of curved
 * paths, and a curve is exactly the kind of thing that gets approximated three
 * times and then disagrees: paving that swings one way, a tree row that swings
 * another, and lamps marching straight through both. Keeping it as one function
 * means the disagreement cannot be expressed.
 */

/**
 * The land form, before any water is cut into it.
 *
 * This lived in `terrain.ts` until the stream was found lying *on* the lawn
 * rather than in a channel, and moving it is the fix rather than a tidy-up.
 * The water levels were absolute numbers — −1.9 m at the outlet falling to
 * −2.8 m — chosen when the ground was a flat plane. The relief that was added
 * later swings ±4.6 m, so for most of its length the stream's surface sat
 * *above* the ground either side of it: no bank, no valley, and a bridge
 * spanning nothing. Absolute levels cannot survive a landform they do not know
 * about.
 *
 * So the ground is now the primary and the water is derived from it. Everything
 * downstream of this — `riverSurface`, the bank tops, the bridge deck — is a
 * measurement of this function rather than a constant that has to be kept in
 * step with it by hand.
 */
export function gradeAt(x: number, z: number): number {
  const { lake, ridge } = LAND;

  const lifted =
    Math.max(
      smoothstep(ridge.side, ridge.side - 90, x),
      smoothstep(ridge.far, ridge.far - 90, z),
      smoothstep(ridge.beyond, ridge.beyond + 80, z),
      smoothstep(lake.east, lake.east + 90, x),
    ) * ridge.height;

  return (1 - pinned(x, z)) * (relief(x, z) + lifted);
}

/**
 * Rolling relief, in three octaves, eased where people walk.
 *
 * A single wavelength is a corrugation: it has one size of thing in it, so the
 * eye reads the period and the ground becomes a pattern. Three octaves at
 * decreasing amplitude give the ground a large form to sit in, a medium form
 * that breaks the large one, and a small one that keeps the grazing-angle
 * silhouette from being a clean curve.
 */
function relief(x: number, z: number): number {
  const { swell } = LAND;
  const wide = swell.metres;

  // The landform octave, three times the wavelength of the others and twice the
  // amplitude. Without it the ground has texture but no shape: a hundred metres
  // of even corrugation is as flat, compositionally, as a plane.
  let height = wave(x / (wide * 3.1) + 7.4, z / (wide * 3.1) - 4.1) * swell.height * 2.2;
  height += wave(x / wide, z / wide) * swell.height;
  height += wave(x / (wide * 0.42) + 31.7, z / (wide * 0.42) - 12.3) * swell.height * 0.45;
  height += wave(x / (wide * 0.17) - 8.1, z / (wide * 0.17) + 5.4) * swell.height * 0.2;

  return height * (1 - 0.72 * walked(x, z));
}

/**
 * Ground that must stay level whatever the relief says: 1 pinned, 0 free.
 *
 * Two places qualify. The forecourt, because the building's ambient occlusion
 * was baked against level ground and its paving is a flat plate. And the review
 * row's patch, because the four candidate panels are exported at fixed heights
 * in `facade-candidates.glb` and would float or sink into a slope.
 */
function pinned(x: number, z: number): number {
  const { core } = LAND;

  const forecourt =
    1 - smoothstep(0, 26, Math.max(Math.abs(x) - core.halfWidth, core.far - z, z - core.near, 0));
  const review =
    1 -
    smoothstep(
      0,
      20,
      Math.max(Math.abs(x - REVIEW.centre[0]) - 34, Math.abs(z - REVIEW.centre[2]) - 18, 0),
    );

  return Math.max(forecourt, review, pitch(x, z));
}

/**
 * How much of a walked route is at this point: 1 on the paving, easing out to 0.
 *
 * A park path is graded — it is not a level plinth, and a dead-level strip
 * through undulating ground reads as a causeway — but a path that rolls at full
 * amplitude reads as a hill the audience is being marched over on the approach
 * to the front door. So the relief is damped along every route rather than
 * removed, and the paving then follows whatever is left.
 */
function walked(x: number, z: number): number {
  const avenue = offAvenue(x, z);
  // Faded in and out along its own length as well as across it, or the damping
  // ends on a step and the avenue reads as a shelf cut into the park.
  const along =
    smoothstep(AVENUE.from - 8, AVENUE.from + 4, z) *
    (1 - smoothstep(CROSSING.z + 12, CROSSING.z + 26, z));
  const onAvenue = Number.isFinite(avenue) ? (1 - smoothstep(0, 9, avenue)) * along : 0;

  const promenade = offPromenade(x, z);
  const onPromenade = Number.isFinite(promenade) ? 1 - smoothstep(0, 14, promenade) : 0;

  return Math.max(onAvenue, onPromenade);
}

/**
 * Where the river's centre is, at a given distance across the site.
 *
 * Meanders, because that is what water does to a floodplain and a stream that
 * does not is read instantly as a drainage channel. Three terms, each doing a
 * different job and none of them decoration:
 *
 * - The fundamental sets the meander wavelength, near ten channel widths.
 * - A third harmonic fattens the lobes and throws them off symmetry. A pure
 *   sine is a *sine*, evenly rounded both ways; a real meander runs long and
 *   flat through the crossing and tight round the bend, which is what the
 *   third harmonic buys for one extra cosine.
 * - Value noise at a much longer wavelength wanders the whole valley, so the
 *   bends are not identical copies marching across the site.
 *
 * It is single-valued in x by construction, which forbids a meander tight
 * enough to double back on itself. That is a real limit and it is the right
 * trade: the terrain cut, the riverside walk and the water ribbon all measure
 * themselves against this function, and every one of them would need a search
 * rather than an evaluation if it could fold.
 */
export function riverAt(x: number): number {
  const { river } = LAND;
  return river.z + meander(x) * river.wander + valley(x) * river.wander * 0.55;
}

/** The bends themselves, as a multiple of `wander`. */
function meander(x: number): number {
  const u = x / LAND.river.wave;
  return Math.sin(u) + 0.22 * Math.sin(3 * u + 1.9);
}

/** The floodplain the bends sit in, wandering at four times their wavelength. */
function valley(x: number): number {
  return wave(x / 190 + 5.3, 2.6);
}

/**
 * Where the riverside walk runs.
 *
 * A **slackened** version of the river rather than a parallel offset of it, and
 * that is a correctness fix before it is a design one. A curve offset by more
 * than its own radius of curvature folds through a cusp and crosses itself —
 * the walk did exactly that on the tightest bend, tying a visible loop in the
 * paving. The meander's radius drops to about 25 m and the walk stands 15 m
 * off, so a true offset is not safely constructible at all.
 *
 * Following the valley but only some of the bends is also what the reference
 * photographs show. A path welded to every meander reads as a towpath; a path
 * running its own line, which the water approaches and retreats from, is what
 * makes the river feel like it was there first.
 *
 * How much it slackens is bounded at both ends, and the lower bound is sharp.
 * Taking only a third of the bends let the gap between path and river close to
 * 4.7 m on the crossings — inside the 6.8 m bank top, so the paving ran down the
 * slope and into the water. The separation is `15 − meander × wander × (1 − k)`,
 * which at k = 0.7 never closes past 10 m and so always clears the bank.
 */
export function riversideAt(x: number): number {
  const { river } = LAND;
  return river.z - 15 + meander(x) * river.wander * 0.7 + valley(x) * river.wander * 0.55;
}

/**
 * How fast the centreline is moving sideways, per metre along.
 *
 * Differenced rather than differentiated: the meander is three terms today and
 * an analytic derivative is a fourth place the formula has to be kept in step.
 */
export function riverSlope(x: number): number {
  return (riverAt(x + 0.5) - riverAt(x - 0.5)) / 1;
}

/**
 * Where the avenue crosses the water, and therefore where the bridge stands.
 *
 * The avenue's bow returns to the site axis at its far end, so the crossing is
 * at x = 0 whatever the bow does; how far out that is depends only on where the
 * river happens to run there. Meander the river and the bridge and the whole
 * walk follow it, which is the point of deriving rather than typing.
 */
export const CROSSING = { x: 0, z: riverAt(0) } as const;

/**
 * Where the avenue's centre is, at a given distance out from the building.
 *
 * A half sine of amplitude `wander`, which is currently zero: the avenue is a
 * straight terminated vista onto the entrance, by decision. The curve survives
 * because it costs nothing and because both junctions stay square whatever the
 * amplitude — the path meets the promenade and the bridge on axis either way.
 */
export function avenueAt(z: number): number {
  const t = clamp01((z - AVENUE.from) / (CROSSING.z - AVENUE.from));
  return Math.sin(t * Math.PI) * AVENUE.wander;
}

/** How far a point is from the avenue's paved edge, in metres. Zero when on it. */
export function offAvenue(x: number, z: number): number {
  if (z < AVENUE.from || z > CROSSING.z) return Infinity;
  return Math.max(0, Math.abs(x - avenueAt(z)) - AVENUE.halfWidth);
}

/**
 * How much of the river's section is at this point: 1 mid-channel, 0 at the top
 * of the bank, smooth across the swale between.
 *
 * Measured **perpendicular to the centreline**, not down the z axis. With a
 * near-straight river the two agree and the distinction is academic; with a
 * meander running at 50° to the axis, a z-axis measurement overstates the
 * distance to the bank by more than half, so the channel would silently swell
 * to half again its width through every bend and pinch back on the crossings —
 * exactly inverting the shape a real river has.
 *
 * The stream stops existing east of the lake's west shore, because that is
 * where it comes *from*. Without the taper the channel would carry on straight
 * through the basin as a trench in the lake bed.
 */
export function riverDepth(x: number, z: number): number {
  const { river } = LAND;
  const reach = riverReach(x);
  if (reach <= 0) return 0;
  const across = riverAcross(x, z);
  return (1 - smoothstep(river.halfWidth, river.halfWidth + river.swale, across)) * reach;
}

/** Distance from the centreline measured square to it, which is what a section is. */
export function riverAcross(x: number, z: number): number {
  return Math.abs(z - riverAt(x)) / Math.hypot(1, riverSlope(x));
}

/** How much stream there is here: 1 west of the outlet, tapering to 0 inside the lake. */
export function riverReach(x: number): number {
  return 1 - smoothstep(LAND.lake.west - 8, LAND.lake.west + 16, x);
}

/**
 * The top of the bank, which is the level the park stands at beside the water.
 *
 * Everything about the stream is hung off this: the water is `freeboard` below
 * it, the swale falls from it, the bridge deck continues the avenue across at
 * it, and the terrain is eased to it through the floodplain. One number, asked
 * for in one place.
 */
export function bankAt(x: number): number {
  return riverSurface(x) + LAND.river.freeboard;
}

/**
 * Water level in the stream, derived from the ground it runs through.
 *
 * It used to be two absolute constants lerped along x, and that is the single
 * assumption that cost this whole corridor its legibility — see `gradeAt`. A
 * water level that does not know where the ground is will sooner or later be
 * above it.
 *
 * Three things are true of a stream and all three are enforced here rather
 * than hoped for:
 *
 * - **It is below its own banks, everywhere.** The level is taken from the
 *   grade along the centreline, less a fixed freeboard.
 * - **It never runs uphill.** A running minimum from the outlet westward, so
 *   the profile can only fall.
 * - **It has a gradient.** A guaranteed fall per metre, or the running minimum
 *   produces long dead-level plateaus that read as a canal.
 *
 * The grade is averaged over a `SMOOTH`-metre window first. A water surface
 * that tracked every swell in the relief would bob through the site, and a
 * running minimum over an unsmoothed signal latches onto the single deepest
 * hollow it passes and incises the rest of the stream to match it.
 */
export function riverSurface(x: number): number {
  const t = clamp01((PROFILE.head - x) / (PROFILE.head - PROFILE.tail)) * (PROFILE.level.length - 1);
  const index = Math.min(Math.floor(t), PROFILE.level.length - 2);
  const fraction = t - index;
  return PROFILE.level[index]! * (1 - fraction) + PROFILE.level[index + 1]! * fraction;
}

/** Metres between samples of the water profile, and how far it is averaged over. */
const PROFILE_STEP = 4;
const PROFILE_SMOOTH = 60;

/**
 * How fast the water is allowed to fall, per metre travelled.
 *
 * Bounded at both ends, and both bounds earn their place. Without the minimum
 * the running minimum produces long dead-level plateaus, which is a canal.
 * Without the maximum it chases every hollow in the relief: the first version
 * dropped 2.7 m in the thirty metres below the lake outlet, which is not a
 * stream leaving a lake, it is a stream falling out of one.
 *
 * Capping the fall means the water sometimes sits higher than the raw ground
 * around it — which is fine, because the terrain eases to the bank top either
 * side. A metre and a half of lift spread over the floodplain's eighteen is
 * under six degrees and reads as the valley floor it is.
 */
const PROFILE_FALL = { min: 0.0022, max: 0.02 };

const PROFILE = buildProfile();

function buildProfile(): { head: number; tail: number; level: Float32Array } {
  const head = LAND.lake.west;
  const tail = -320;
  const count = Math.ceil((head - tail) / PROFILE_STEP) + 1;
  const window = Math.round(PROFILE_SMOOTH / PROFILE_STEP);

  const raw = new Float32Array(count);
  for (let i = 0; i < count; i += 1) {
    const x = head - i * PROFILE_STEP;
    raw[i] = gradeAt(x, riverAt(x));
  }

  const level = new Float32Array(count);
  // Seeded at the lake, because that is where the water comes from: the stream
  // leaves the basin at the basin's level and can only go down from there.
  let running: number = LAND.lake.surface;

  for (let i = 0; i < count; i += 1) {
    let sum = 0;
    let taken = 0;
    for (let k = -window; k <= window; k += 1) {
      const j = i + k;
      if (j < 0 || j >= count) continue;
      sum += raw[j]!;
      taken += 1;
    }
    const ceiling = running - PROFILE_FALL.min * PROFILE_STEP;
    const floor = running - PROFILE_FALL.max * PROFILE_STEP;
    running = Math.min(ceiling, Math.max(floor, sum / taken - LAND.river.freeboard));
    level[i] = running;
  }

  return { head, tail, level };
}

/**
 * How much of the lake is at this point: 1 in open water, 0 past the shore.
 *
 * The basin is a rectangle, and a rectangle blended over 26 m is a rounded
 * rectangle — which is precisely what it looked like: a hard straight edge
 * running diagonally across the frame with two visible corners. No lake has
 * corners.
 *
 * So the shore distance is perturbed before it is blended, at two wavelengths.
 * The long one gives the lake bays and headlands, the short one keeps the
 * waterline from being a clean curve at close range. Both are cheap, because
 * this is a distance being bent rather than geometry being added.
 */
export function lakeDepth(x: number, z: number): number {
  return 1 - smoothstep(0, 26, lakeReach(x, z));
}

/**
 * How far past the lake's water this point is, in metres. Negative inside it.
 *
 * Exposed rather than folded into `lakeDepth` because the terrain needs a
 * *wider* field than the water's own edge: the ground around a lake has to be
 * brought above the lake's surface, and that apron reaches well past the point
 * where the water itself has faded out.
 */
export function lakeReach(x: number, z: number): number {
  const { lake } = LAND;
  const beyond = Math.max(lake.west - x, x - lake.east, lake.far - z, z - lake.near, 0);
  // Amplitude is capped by the stream, not chosen for looks. The lake's west
  // shore is 70 m from the avenue and the river runs out of it along that line;
  // a bay deep enough to reach past 44 m starts flooding the stream corridor
  // from the side, which reads as the lake having swallowed its own outlet.
  const bays = wave(x / 96 + 3.1, z / 96 - 7.4) * 22 + wave(x / 23 - 1.7, z / 23 + 5.2) * 6;
  return beyond + bays;
}

/**
 * How close to open water this point is: 1 in it, 0 well clear of any bank.
 *
 * A proxy for distance rather than a measurement of it. True distance to a
 * meandering centreline needs a search, and every caller — bankside species
 * selection, ground tone, reed massing — only ever wants "how wet is it here",
 * which the section profiles already answer.
 */
export function wetness(x: number, z: number): number {
  return Math.max(riverDepth(x, z), lakeDepth(x, z));
}

/**
 * The water level that governs this point, whichever body is nearer.
 *
 * The two surfaces are not the same height — the stream leaves the lake and
 * runs downhill from it — so anything that keys off "how far above the water
 * am I" has to ask which water.
 *
 * Chosen by **proximity, not by depth**, and the distinction is not academic.
 * Asking `riverDepth > lakeDepth` answers correctly only where there is water:
 * standing on the bank both are zero, so the test fell through to the lake's
 * level — a metre above the stream's — and the shore band that `bareness` draws
 * from it appeared as a wide belt of bare soil along the top of the slope
 * rather than as a silt line at the water's edge.
 */
export function waterLevel(x: number, z: number): number {
  const { river, lake } = LAND;
  const near =
    riverReach(x) > 0 && riverAcross(x, z) < river.halfWidth + river.swale + river.plain;
  return near ? riverSurface(x) : lake.surface;
}

/**
 * How much the playground has levelled the ground: 1 inside the fence, easing
 * out to 0 well clear of it.
 *
 * Lives here rather than in `playground.ts` because the terrain has to ask it
 * and the playground has to ask the terrain where it stands. Only one of those
 * two can own the other.
 */
export function pitch(x: number, z: number): number {
  const [cx, cz] = PLAYGROUND.centre;
  const reach = Math.hypot(x - cx, (z - cz) / PLAYGROUND.oval);
  return 1 - smoothstep(PLAYGROUND.radius, PLAYGROUND.radius + 14, reach);
}

/** How far a point is from the E–W promenade's paved edge, in metres. */
export function offPromenade(x: number, z: number): number {
  if (Math.abs(x) > REALM.run / 2) return Infinity;
  const near = REALM.forecourtFar;
  const far = REALM.promenadeFar;
  if (z >= near && z <= far) return 0;
  return z < near ? near - z : z - far;
}

/** How far a point is from the riverside walk's paved edge, in metres. */
export function offRiverside(x: number, z: number): number {
  if (x < RIVERSIDE.from || x > RIVERSIDE.to) return Infinity;
  return Math.max(0, Math.abs(z - riversideAt(x)) - RIVERSIDE.halfWidth);
}

/**
 * How far this point is from *any* paved route, in metres.
 *
 * The single question every scatter on the site actually wants to ask, and the
 * reason it exists as one function is that it kept being asked three different
 * ways. The woodland tested the promenade and the avenue; the parkland tested
 * the avenue by a hand-written box and the riverside by a z-distance that is
 * wrong on a bend; the bank vegetation tested none of them. What the audience
 * saw was trees standing in the paving.
 */
export function offPaths(x: number, z: number): number {
  return Math.min(offAvenue(x, z), offPromenade(x, z), offRiverside(x, z));
}

/**
 * Where the avenue crosses the channel, and how long the span has to be.
 *
 * Derived, not typed, and getting this wrong is what left the bridge with no
 * connection to the path either side. The deck is aligned with the *avenue*,
 * so it meets the channel at whatever angle the meander makes there — and a
 * span quoted across the channel is therefore too short by exactly the secant
 * of that angle. At the 39° skew this crossing actually has, the 13 m span in
 * use put both abutments 1.7 m *inside* the top of the bank: the deck landed on
 * the slope, the paving stopped short of it on the level ground above, and the
 * gap between them was the step the walk fell down.
 *
 * So the span is the bank-to-bank distance measured along the deck, plus a
 * bearing at each end.
 */
export const SPAN =
  2 * (LAND.river.halfWidth + LAND.river.swale) * Math.hypot(1, riverSlope(CROSSING.x)) +
  2 * BRIDGE.bearing;

export function clamp01(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}

/**
 * Deterministic value noise, and the −1..1 form every caller actually wants.
 *
 * It lives here rather than in `terrain.ts` because the shorelines need it and
 * the terrain imports *this* module, not the other way round. Water that has to
 * ask the terrain where it is would close the loop.
 *
 * Seeded arithmetic rather than `Math.random`: a defence is rehearsed, and a
 * coastline that differs between run-throughs is something the speaker has to
 * absorb mid-sentence.
 */
export function noise(x: number, z: number): number {
  const xi = Math.floor(x);
  const zi = Math.floor(z);
  const xf = x - xi;
  const zf = z - zi;

  const u = xf * xf * (3 - 2 * xf);
  const v = zf * zf * (3 - 2 * zf);

  const a = hash(xi, zi);
  const b = hash(xi + 1, zi);
  const c = hash(xi, zi + 1);
  const d = hash(xi + 1, zi + 1);

  return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
}

export function wave(x: number, z: number): number {
  return noise(x, z) * 2 - 1;
}

function hash(x: number, z: number): number {
  const value = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return value - Math.floor(value);
}

export function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = clamp01((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}
