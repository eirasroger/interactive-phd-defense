import {
  AVENUE,
  BRIDGE,
  LAND,
  PATH_EDGE_WIDTH,
  PAVILION,
  PLAYGROUND,
  REALM,
  REVIEW,
  RIVERSIDE,
} from './site';

/**
 * The centrelines the site is laid out from.
 *
 * Every other module in the zone asks this one where things run — terrain,
 * paving, bridge, lamps, planting — so none of them carries its own copy of the
 * geometry and none of them can disagree about it.
 */

/**
 * The land form, before any water is cut into it.
 *
 * The ground is the primary and the water is derived from it: `riverSurface`,
 * the bank tops and the bridge deck are all measurements of this rather than
 * absolute levels that have to be kept in step with the relief by hand.
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
 * Rolling relief in four octaves, eased where people walk.
 *
 * The first octave is three times the wavelength of the others and twice the
 * amplitude: without a landform octave the ground has texture but no shape, and
 * even corrugation is as flat compositionally as a plane.
 */
function relief(x: number, z: number): number {
  const { swell } = LAND;
  const wide = swell.metres;

  let height = wave(x / (wide * 3.1) + 7.4, z / (wide * 3.1) - 4.1) * swell.height * 2.2;
  height += wave(x / wide, z / wide) * swell.height;
  height += wave(x / (wide * 0.42) + 31.7, z / (wide * 0.42) - 12.3) * swell.height * 0.45;
  height += wave(x / (wide * 0.17) - 8.1, z / (wide * 0.17) + 5.4) * swell.height * 0.2;

  return height * (1 - 0.72 * walked(x, z));
}

/**
 * Ground that must stay level whatever the relief says: 1 pinned, 0 free.
 *
 * The forecourt, because the building's AO was baked against level ground and
 * its paving is a flat plate; and the review row's patch, because the candidate
 * panels are exported at fixed heights in `facade-candidates.glb`.
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
 * The relief is damped along a route rather than removed — a dead-level strip
 * through undulating ground reads as a causeway. Faded in and out along its
 * length as well as across it, or the damping ends on a step.
 */
function walked(x: number, z: number): number {
  const avenue = offAvenue(x, z);
  const along =
    smoothstep(AVENUE.from - 8, AVENUE.from + 4, z) *
    (1 - smoothstep(AVENUE_RUN.to - 14, AVENUE_RUN.to + 4, z));
  const onAvenue = Number.isFinite(avenue) ? (1 - smoothstep(0, 9, avenue)) * along : 0;

  const promenade = offPromenade(x, z);
  const onPromenade = Number.isFinite(promenade) ? 1 - smoothstep(0, 14, promenade) : 0;

  return Math.max(onAvenue, onPromenade);
}

/**
 * Where the river's centre is, at a given distance across the site.
 *
 * Three terms: a fundamental setting the meander wavelength, a third harmonic
 * that runs the bends long through the crossing and tight round the bend, and
 * long-wavelength noise so the bends are not identical copies.
 *
 * Single-valued in x by construction, which forbids a meander tight enough to
 * double back. That is the right trade: every reader measures itself against
 * this function, and each would need a search rather than an evaluation.
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
 * Where the riverside walk runs: a **slackened** river rather than a parallel
 * offset of it.
 *
 * A curve offset by more than its own radius of curvature folds through a cusp
 * and crosses itself — the meander's radius drops to about 25 m and the walk
 * stands 15 m off, so a true offset is not safely constructible. The slack
 * factor is bounded below too: at 0.3 the gap closed to 4.7 m on the crossings,
 * inside the bank top, and the paving ran into the water.
 *
 * Both ends turn onto the promenade, eased with a smoothstep so the walk leaves
 * the meander tangentially rather than with a visible kink. The two turns are a
 * maximum rather than a sum: they are two hundred metres apart, so only ever one
 * of them is doing anything.
 */
export function riversideAt(x: number): number {
  const { river } = LAND;
  const along = river.z - 15 + meander(x) * river.wander * 0.7 + valley(x) * river.wander * 0.55;

  const { west, east } = RIVERSIDE.merge;
  const onto = Math.max(smoothstep(west[0], west[1], x), smoothstep(east[0], east[1], x));
  return along + (PROMENADE_Z - along) * onto;
}

/** The promenade's centreline — the mid-line of the band `REALM` describes. */
export const PROMENADE_Z = (REALM.forecourtFar + REALM.promenadeFar) / 2;

/**
 * How fast the centreline moves sideways, per metre along. Differenced rather
 * than differentiated, so the meander's terms live in one place.
 */
export function riverSlope(x: number): number {
  return (riverAt(x + 0.5) - riverAt(x - 0.5)) / 1;
}

/** Where the avenue crosses the water, and therefore where the bridge stands. */
export const CROSSING = { x: 0, z: riverAt(0) } as const;

/**
 * How long the span has to be: bank to bank **measured along the deck**, plus a
 * bearing at each end.
 *
 * The deck is aligned with the avenue, so it meets the channel at the meander's
 * angle and a span quoted across the channel is short by its secant. At this
 * crossing's 39° skew that put both abutments inside the top of the bank.
 *
 * It stands here rather than at the foot of the file because `offAvenue` needs
 * it while the water profile below is being built. **Declaration order is
 * load-bearing** — a `const` read before its own line is a `ReferenceError`.
 */
export const SPAN =
  2 * bankReach(CROSSING.x) * Math.hypot(1, riverSlope(CROSSING.x)) + 2 * BRIDGE.bearing;

/**
 * The avenue's full extent, **both sides of the crossing**. Exported so the
 * paving and the clearance rules cannot disagree about where the route runs.
 */
export const AVENUE_RUN = {
  // Through the promenade to the forecourt's edge, not up to it. A route that
  // stops on the far kerb of the one it meets has no junction — nothing
  // constructs a mouth, so the promenade's kerb ran straight across the head of
  // the avenue. Crossing it makes the meeting a crossing, which `junctions.ts`
  // already knows how to build.
  from: REALM.forecourtFar,
  to: CROSSING.z + SPAN / 2 + 24,
} as const;

/**
 * Where the avenue's centre is. A half sine of amplitude `wander`, which is
 * currently zero; both junctions stay square whatever the amplitude.
 */
export function avenueAt(z: number): number {
  const t = clamp01((z - AVENUE.from) / (CROSSING.z - AVENUE.from));
  return Math.sin(t * Math.PI) * AVENUE.wander;
}

/** How far a point is from the avenue's paved edge. Zero when on it. */
export function offAvenue(x: number, z: number): number {
  if (z < AVENUE_RUN.from || z > AVENUE_RUN.to) return Infinity;
  return Math.max(0, Math.abs(x - avenueAt(z)) - AVENUE.halfWidth);
}

/**
 * How much of the river's section is at this point: 1 mid-channel, 0 at the top
 * of the bank.
 *
 * Measured perpendicular to the centreline. Down the z axis instead, a meander
 * running at 50° overstates the distance by more than half, so the channel would
 * swell through every bend and pinch on the crossings.
 */
export function riverDepth(x: number, z: number): number {
  const reach = riverReach(x);
  if (reach <= 0) return 0;
  const half = channelHalf(x);
  const across = riverAcross(x, z);
  return (1 - smoothstep(half, half + swaleAt(x), across)) * reach;
}

/**
 * How far into the outlet this point is: 0 along the run, 1 at the lake.
 *
 * The channel widens and lays its banks back over these last metres, and both
 * are the same event so they run off one number.
 */
export function mouthProgress(x: number): number {
  const { lake, river } = LAND;
  return smoothstep(lake.west - river.mouth.reach, lake.west - 2, x);
}

/** How much wider the channel's section is here than its nominal width. */
export function mouthFlare(x: number): number {
  return 1 + LAND.river.mouth.widen * mouthProgress(x);
}

/** Half the wetted width of the channel here, mouth included. */
export function channelHalf(x: number): number {
  return LAND.river.halfWidth * mouthFlare(x);
}

/**
 * How far the bank stands above the water here: the stream's freeboard along the
 * run, easing to the lake's own shore height through the outlet.
 */
export function bankHeight(x: number): number {
  const { lake, river } = LAND;
  return river.freeboard + (lake.shore - river.freeboard) * mouthProgress(x);
}

/**
 * How far the bank takes to climb from the water back to grade.
 *
 * The mouth's value is derived from the lake's beach, not chosen: the bank there
 * falls `shore + depth` and has to do it at the slope `shore / beach`, so the
 * two shores meet at the same angle and follow each other if either is retuned.
 */
export function swaleAt(x: number): number {
  const { lake, river } = LAND;
  const shore = ((lake.shore + river.depth) * lake.beach) / lake.shore;
  return river.swale + (shore - river.swale) * mouthProgress(x);
}

/** How far from the centreline the swale reaches the top of the bank. */
export function bankReach(x: number): number {
  return channelHalf(x) + swaleAt(x);
}

/**
 * Where the bed of the channel is: `river.depth` below the water, falling away
 * by `mouth.scour` through the outlet.
 *
 * On `drownProgress` rather than `mouthProgress`, because the widening and the
 * deepening happen at different stations — the channel flares approaching the
 * shore and goes on deepening past it.
 */
export function channelBed(x: number): number {
  const { river } = LAND;
  return riverSurface(x) - river.depth * (1 + river.mouth.scour * drownProgress(x));
}

/**
 * How far into the drowning the channel is: 0 out along the run, 1 well inside
 * the basin, straddling the shoreline.
 *
 * Measured against `lakeReach` rather than x, because the bays bend the
 * waterline by tens of metres and a scour keyed on x would start under dry sand
 * on one stretch and in open water on the next.
 */
export function drownProgress(x: number): number {
  const { mouth } = LAND.river;
  return smoothstep(mouth.reach, -mouth.drown, lakeReach(x, riverAt(x)));
}

/** Distance from the centreline measured square to it, which is what a section is. */
export function riverAcross(x: number, z: number): number {
  return Math.abs(z - riverAt(x)) / Math.hypot(1, riverSlope(x));
}

/**
 * How much stream there is here: 1 up to the outlet, tapering away inside the
 * lake.
 *
 * The taper is long because fading a channel out lerps its bed back up to the
 * ground it is cut into. Run far enough into the basin the channel is simply
 * *buried* instead — `heightAt` takes the deeper of the channel and the bowl.
 */
export function riverReach(x: number): number {
  return 1 - smoothstep(LAND.lake.west, LAND.lake.west + 110, x);
}

/** The top of the bank, which is the level the park stands at beside the water. */
export function bankAt(x: number): number {
  return riverSurface(x) + bankHeight(x);
}

/**
 * Water level in the stream, derived from the ground it runs through rather than
 * given as absolute levels. Three things are enforced by `buildProfile`: the
 * water is below its own banks everywhere, it never runs uphill, and it has a
 * gradient.
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
 * How fast the water may fall, per metre travelled.
 *
 * The minimum stops the running minimum producing dead-level plateaus, which
 * read as a canal. The maximum stops it chasing every hollow in the relief.
 * Capping the fall lets the water sit above the raw ground in places, which is
 * fine — the terrain eases to the bank top either side over `river.plain`.
 */
const PROFILE_FALL = { min: 0.0022, max: 0.02 };

const PROFILE = buildProfile();

/**
 * The grade is averaged over `PROFILE_SMOOTH` metres first: a running minimum
 * over an unsmoothed signal latches onto the deepest hollow it passes and
 * incises the rest of the stream to match it.
 */
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
  // Seeded at the lake: the stream leaves the basin at the basin's level.
  let running: number = LAND.lake.surface;

  for (let i = 0; i < count; i += 1) {
    const x = head - i * PROFILE_STEP;
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
    running = Math.min(ceiling, Math.max(floor, sum / taken - bankHeight(x)));
    level[i] = running;
  }

  return { head, tail, level };
}

/**
 * How much of the lake is at this point: 1 in open water, 0 past the shore.
 *
 * Cut over seven metres. The shore *profile* is the bed's business — see
 * `heightAt` — so this only has to say where the water stops.
 */
export function lakeDepth(x: number, z: number): number {
  return 1 - smoothstep(0, 7, lakeReach(x, z));
}

/**
 * How far past the lake's water this point is. **Negative inside it** — the bed
 * is cut from how far in a point is, so this must stay signed.
 *
 * The basin is a rectangle, so the distance is perturbed at two wavelengths
 * before anything blends on it: a long one for bays and headlands, a short one
 * so the waterline is not a clean curve at close range. Bay amplitude is capped
 * by the stream — past about 44 m a bay floods the outlet corridor from the side.
 */
export function lakeReach(x: number, z: number): number {
  const { lake } = LAND;
  const beyond = Math.max(lake.west - x, x - lake.east, lake.far - z, z - lake.near);
  const bays = wave(x / 96 + 3.1, z / 96 - 7.4) * 22 + wave(x / 23 - 1.7, z / 23 + 5.2) * 6;
  return beyond + bays;
}

/**
 * How the two water surfaces divide the outlet: 1 the stream draws it, 0 the
 * lake does. **Both bodies read this**, so neither can stop on a boundary the
 * other does not know about.
 *
 * It reaches past the shore on the stream side because the lake's alpha ends on
 * what is effectively a hard cut, and the only way that cannot be seen is for
 * the stream to have full authority on both sides of it.
 */
export const HANDOVER = { lake: -24, stream: 6 } as const;

export function streamShare(x: number, z: number): number {
  return smoothstep(HANDOVER.lake, HANDOVER.stream, lakeReach(x, z));
}

/**
 * How close to open water this point is: 1 in it, 0 well clear of any bank. A
 * proxy for distance rather than a measurement — true distance to a meandering
 * centreline needs a search, and every caller only wants "how wet is it here".
 */
export function wetness(x: number, z: number): number {
  return Math.max(riverDepth(x, z), lakeDepth(x, z));
}

/** Freeboard reported where no water body governs. Larger than any real bank. */
export const DRY = 99;

/**
 * How far this point stands above the water that governs it. Negative below the
 * surface, `DRY` where there is no water to be above.
 *
 * The whole bankside read — gravel, silt line, damp tussock, grass — is a
 * function of this one number, interpolated across the ground and banded per
 * pixel in `terrain.ts`.
 *
 * Which body governs is chosen by **proximity, not depth**: on the bank both
 * depths are zero, so a depth test falls through to whichever is listed first.
 * Both are faded out rather than switched off at a radius, or the boundary draws
 * its own ring of beach across the meadow.
 */
export function freeboardAt(x: number, z: number, y: number): number {
  const { river, lake } = LAND;
  const bankTop = bankReach(x);

  const stream =
    riverReach(x) *
    (1 - smoothstep(bankTop + river.plain * 0.55, bankTop + river.plain, riverAcross(x, z)));
  // Full authority over open water: the lake is read *through* where it is
  // shallow, so the bed under it has to be shaded as bed and not as meadow.
  const basin = Math.max(
    lakeDepth(x, z),
    1 - smoothstep(lake.apron * 0.55, lake.apron, lakeReach(x, z)),
  );

  if (stream <= 0 && basin <= 0) return DRY;
  const level = stream >= basin ? riverSurface(x) : lake.surface;
  return y - level + (1 - Math.max(stream, basin)) * DRY;
}

/**
 * How much the playground has levelled the ground. Lives here because the
 * terrain has to ask it and the playground has to ask the terrain where it
 * stands; only one of the two can own the other.
 */
export function pitch(x: number, z: number): number {
  const [cx, cz] = PLAYGROUND.centre;
  const reach = Math.hypot(x - cx, (z - cz) / PLAYGROUND.oval);
  return 1 - smoothstep(PLAYGROUND.radius, PLAYGROUND.radius + 14, reach);
}

/** How far a point is from the E–W promenade's paved edge. */
export function offPromenade(x: number, z: number): number {
  if (Math.abs(x) > REALM.run / 2) return Infinity;
  const near = REALM.forecourtFar;
  const far = REALM.promenadeFar;
  if (z >= near && z <= far) return 0;
  return z < near ? near - z : z - far;
}

/**
 * How far a point is from the riverside walk's paved edge, measured square to
 * the centreline — the paving is swept on the true normal, and the walk's west
 * end runs 50° off axis.
 */
export function offRiverside(x: number, z: number): number {
  if (x < RIVERSIDE.from || x > RIVERSIDE.to) return Infinity;
  const across = Math.abs(z - riversideAt(x)) / Math.hypot(1, riversideSlope(x));
  return Math.max(0, across - RIVERSIDE.halfWidth);
}

/** How fast the walk's centreline moves sideways, per metre along. */
export function riversideSlope(x: number): number {
  return riversideAt(x + 0.5) - riversideAt(x - 0.5);
}

/** How far this point is from *any* paved route. One question, asked in one place. */
export function offPaths(x: number, z: number): number {
  return Math.min(offAvenue(x, z), offPromenade(x, z), offRiverside(x, z));
}

/**
 * How far this point is from any ground the site has already spent: paving to
 * its gutter edge, the plate the building stands on, and the playground.
 */
export function offBuilt(x: number, z: number): number {
  return Math.min(
    Math.max(0, offPaths(x, z) - PATH_EDGE_WIDTH),
    offForecourt(x, z),
    offPlayground(x, z),
    offPavilion(x, z),
  );
}

/**
 * Whether this point stands in the shot the review row's camera needs. Derived
 * from `REVIEW` so the corridor moves when the row does — every scatter on the
 * site reads this. It reaches a little past the camera, because a plant just
 * behind it is a leaf across the lens.
 */
export function inReviewShot(x: number, z: number): boolean {
  const [cx, , cz] = REVIEW.centre;
  return Math.abs(x - cx) < REVIEW.clear && z > cz - 8 && z < cz + REVIEW.standoff + 6;
}

/**
 * The pavilion and its apron, measured in the building's own frame — it is
 * turned to face the walk, and an axis-aligned box round a rotated building
 * either haloes it with bare ground or grows shrubs through its corners.
 */
export function offPavilion(x: number, z: number): number {
  const [cx, cz] = PAVILION.centre;
  const cos = Math.cos(pavilionYaw());
  const sin = Math.sin(pavilionYaw());
  const along = (x - cx) * cos + (z - cz) * sin;
  const across = -(x - cx) * sin + (z - cz) * cos;
  return Math.max(
    0,
    Math.max(
      Math.abs(along) - PAVILION.width / 2,
      Math.abs(across) - PAVILION.depth / 2 - PAVILION.clear,
    ),
  );
}

/** The pavilion's bearing, which is the walk's where it passes. */
export function pavilionYaw(): number {
  return Math.atan2(riversideSlope(PAVILION.centre[0]), 1);
}

/** The granite plate, and the building standing on it. */
function offForecourt(x: number, z: number): number {
  return Math.max(
    Math.abs(x) - REALM.halfWidth,
    LAND.core.far - z,
    z - REALM.forecourtFar,
    0,
  );
}

/** The playground, out to its fence line. */
function offPlayground(x: number, z: number): number {
  const [cx, cz] = PLAYGROUND.centre;
  const reach = Math.hypot(x - cx, (z - cz) / PLAYGROUND.oval);
  return Math.max(0, reach - (PLAYGROUND.radius + 2.4));
}

/**
 * The planting beds either side of the entrance path — the one place on the site
 * where built ground is *for* plants, so an exception to `offBuilt` rather than a
 * hole in it. They arrive in `exterior-planting.glb`.
 */
export function inBeds(x: number, z: number): boolean {
  return (
    z > REALM.bedNear &&
    z < REALM.forecourtFar &&
    Math.abs(x) > REALM.pathHalfWidth &&
    Math.abs(x) < REALM.halfWidth
  );
}

/**
 * Whether a plant may stand here, given how much clear ground it needs.
 *
 * `clearance` is the caller's business: a tree stands back by a fraction of its
 * crown so the canopy overhangs the walk, a verge shrub is planted hard against
 * the gutter on purpose.
 */
export function plantable(x: number, z: number, clearance = 0): boolean {
  if (wetness(x, z) > 0.12) return false;
  if (inBeds(x, z)) return true;
  return offBuilt(x, z) > clearance;
}

export function clamp01(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}

/**
 * Deterministic value noise, and the −1..1 form most callers want.
 *
 * It lives here rather than in `terrain.ts` because the shorelines need it and
 * the terrain imports this module. Seeded arithmetic rather than `Math.random`:
 * a defence is rehearsed, and a coastline that differs between run-throughs is
 * something the speaker has to absorb mid-sentence.
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
