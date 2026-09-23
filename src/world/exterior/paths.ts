import {
  AVENUE,
  BRIDGE,
  HILLS,
  LAND,
  PATH_EDGE_WIDTH,
  PAVILION,
  PLAYGROUND,
  REALM,
  REVIEW,
  RIVERSIDE,
} from './site';

/**
 * Site centrelines and ground queries. Terrain, paving, bridge, lamps and
 * planting all read their layout from here so they always agree.
 */

/**
 * Ground height before water is cut in. The river level, bank tops and bridge
 * deck are all derived from this.
 */
export function gradeAt(x: number, z: number): number {
  const { lake, ridge } = LAND;

  const lifted = Math.max(
    Math.max(
      smoothstep(ridge.side, ridge.side - 90, x),
      smoothstep(ridge.far, ridge.far - 90, z),
      smoothstep(ridge.beyond, ridge.beyond + 80, z),
      smoothstep(lake.east, lake.east + 90, x),
    ) * ridge.height,
    hillAt(x, z),
  );

  return (1 - pinned(x, z)) * (relief(x, z) + lifted);
}

/**
 * Hills with their trig and bounds precomputed, since `dome` runs millions of
 * times. `area` is the plan ellipse area used for scatter density. `reach` is
 * the furthest distance from the centre the hill affects.
 */
export const HILL_PLOTS = HILLS.masses.map((mass) => ({
  ...mass,
  cos: Math.cos(mass.yaw),
  sin: Math.sin(mass.yaw),
  reach: mass.radius + HILLS.ragged.broad + HILLS.ragged.fine,
  area: Math.PI * mass.radius * mass.radius * mass.aspect,
}));

type Plot = (typeof HILL_PLOTS)[number];

/**
 * Fails at load if any hill sits over the stream. The water level is derived
 * from the ground along the channel, so a hill there would silently raise the
 * river.
 */
for (let x = LAND.lake.west; x > -320; x -= 2) {
  const z = riverAt(x);
  for (const [index, plot] of HILL_PLOTS.entries()) {
    // Small tolerance: the hill's edge falloff never reaches exactly zero.
    const over = dome(x, z, plot) * plot.height;
    if (over > 0.05) {
      throw new Error(
        `HILLS: mass ${index} at [${plot.centre}] stands ${over.toFixed(2)} m over the channel ` +
          `at x = ${x}, z = ${z.toFixed(0)}. Move it clear of the centreline — the water profile ` +
          'is derived from the ground it runs through.',
      );
    }
  }
}

/** Hill height here in metres. Takes the max of all hills so overlaps do not bulge. */
export function hillAt(x: number, z: number): number {
  let height = 0;
  for (const plot of HILL_PLOTS) height = Math.max(height, dome(x, z, plot) * plot.height);
  return height;
}

/** 0 off all hills, 1 at a summit. */
export function hillShare(x: number, z: number): number {
  let share = 0;
  for (const plot of HILL_PLOTS) share = Math.max(share, dome(x, z, plot));
  return share;
}

/**
 * Bare rock on the hills: 0 grass, 1 rock. Based on soil thinness, which is
 * higher near summits, on steep slopes, and varies with noise.
 *
 * Ground shading, rock slabs and woodland placement all use this, so they share
 * one edge. Steepness comes from `hillAt` only, so river banks never show rock.
 */
export function outcropAt(x: number, z: number): number {
  const share = hillShare(x, z);
  if (share <= 0.02) return 0;

  const step = 3;
  const grade =
    Math.hypot(hillAt(x + step, z) - hillAt(x - step, z), hillAt(x, z + step) - hillAt(x, z - step)) /
    (2 * step);

  const thin = share * 1.15 + grade * 0.7 + wave(x / 11 - 3.4, z / 11 + 8.1) * 0.45;
  return smoothstep(HILLS.outcrop.from, HILLS.outcrop.to, thin);
}

/**
 * One hill's profile: 0 off it, 1 at the summit. A rotated ellipse with a noisy
 * outline and a smootherstep falloff, so the edge blends into flat ground.
 * The bounding-box check up front keeps this cheap across millions of calls.
 */
function dome(x: number, z: number, plot: Plot): number {
  const [cx, cz] = plot.centre;
  const dx = x - cx;
  const dz = z - cz;
  if (Math.abs(dx) > plot.reach || Math.abs(dz) > plot.reach) return 0;

  const along = dx * plot.cos - dz * plot.sin;
  const across = (dx * plot.sin + dz * plot.cos) / plot.aspect;

  const distance =
    Math.hypot(along, across) +
    wave(x / 31 + 4.7, z / 31 - 2.9) * HILLS.ragged.broad +
    wave(x / 9.5 - 6.2, z / 9.5 + 1.4) * HILLS.ragged.fine;

  const t = 1 - clamp01(distance / plot.radius);
  return t * t * t * (t * (t * 6 - 15) + 10);
}

/**
 * Rolling ground from four noise octaves, flattened along paths. The first
 * octave is large and strong so the ground has overall shape.
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
 * Ground that must stay flat: 1 flat, 0 free. Covers the forecourt (AO was
 * baked on flat ground) and the review row (panels are exported at fixed
 * heights).
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
 * 1 on a path, fading to 0 away from it. Used to soften the relief along paths.
 * Also fades at the path ends to avoid a step.
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
 * River centreline z at a given x: a base sine, a third harmonic to vary bend
 * shape, and slow noise so the bends differ. One z per x keeps lookups cheap.
 */
export function riverAt(x: number): number {
  const { river } = LAND;
  return river.z + meander(x) * river.wander + valley(x) * river.wander * 0.55;
}

/** Bend offset, in units of `wander`. */
function meander(x: number): number {
  const u = x / LAND.river.wave;
  return Math.sin(u) + 0.22 * Math.sin(3 * u + 1.9);
}

/** Slow drift of the whole valley. */
function valley(x: number): number {
  return wave(x / 190 + 5.3, 2.6);
}

/**
 * Riverside walk centreline: the river curve with reduced amplitude. A true
 * parallel offset would fold on itself at tight bends. Going below 0.7 pushes
 * the walk into the water.
 *
 * Both ends ease onto the promenade with a smoothstep.
 */
export function riversideAt(x: number): number {
  const { river } = LAND;
  const along = river.z - 15 + meander(x) * river.wander * 0.7 + valley(x) * river.wander * 0.55;

  const { west, east } = RIVERSIDE.merge;
  const onto = Math.max(smoothstep(west[0], west[1], x), smoothstep(east[0], east[1], x));
  return along + (PROMENADE_Z - along) * onto;
}

export const PROMENADE_Z = (REALM.forecourtFar + REALM.promenadeFar) / 2;

/** River centreline slope (dz/dx), by finite difference. */
export function riverSlope(x: number): number {
  return (riverAt(x + 0.5) - riverAt(x - 0.5)) / 1;
}

/** Where the avenue crosses the river, which is where the bridge stands. */
export const CROSSING = { x: 0, z: riverAt(0) } as const;

/**
 * Bridge length: bank to bank measured along the skewed deck, plus a bearing
 * at each end. Must be declared before the water profile is built, since
 * `offAvenue` reads it.
 */
export const SPAN =
  2 * bankReach(CROSSING.x) * Math.hypot(1, riverSlope(CROSSING.x)) + 2 * BRIDGE.bearing;

/** The avenue's full length, both sides of the bridge. */
export const AVENUE_RUN = {
  // Runs through the promenade so `junctions.ts` builds a proper crossing there.
  from: REALM.forecourtFar,
  to: CROSSING.z + SPAN / 2 + 24,
} as const;

/** Avenue centreline x: a half sine of amplitude `wander` (currently zero). */
export function avenueAt(z: number): number {
  const t = clamp01((z - AVENUE.from) / (CROSSING.z - AVENUE.from));
  return Math.sin(t * Math.PI) * AVENUE.wander;
}

/** Distance to the avenue's paved edge. Zero on it. */
export function offAvenue(x: number, z: number): number {
  if (z < AVENUE_RUN.from || z > AVENUE_RUN.to) return Infinity;
  return Math.max(0, Math.abs(x - avenueAt(z)) - AVENUE.halfWidth);
}

/**
 * 1 mid-channel, 0 at the bank top. Measured perpendicular to the centreline
 * so the channel keeps its width through bends.
 */
export function riverDepth(x: number, z: number): number {
  const reach = riverReach(x);
  if (reach <= 0) return 0;
  const half = channelHalf(x);
  const across = riverAcross(x, z);
  return (1 - smoothstep(half, half + swaleAt(x), across)) * reach;
}

/** 0 along the stream, 1 at the lake. Drives both the widening and the bank slope at the outlet. */
export function mouthProgress(x: number): number {
  const { lake, river } = LAND;
  return smoothstep(lake.west - river.mouth.reach, lake.west - 2, x);
}

/** Channel width multiplier at the outlet. */
export function mouthFlare(x: number): number {
  return 1 + LAND.river.mouth.widen * mouthProgress(x);
}

/** Half the water width here, including the outlet flare. */
export function channelHalf(x: number): number {
  return LAND.river.halfWidth * mouthFlare(x);
}

/** Bank height above the water. Eases from the stream's value to the lake's at the outlet. */
export function bankHeight(x: number): number {
  const { lake, river } = LAND;
  return river.freeboard + (lake.shore - river.freeboard) * mouthProgress(x);
}

/**
 * Distance from the water's edge to the bank top. At the outlet it is derived
 * from the lake beach slope so both shores meet at the same angle.
 */
export function swaleAt(x: number): number {
  const { lake, river } = LAND;
  const shore = ((lake.shore + river.depth) * lake.beach) / lake.shore;
  return river.swale + (shore - river.swale) * mouthProgress(x);
}

/** Distance from the centreline to the bank top. */
export function bankReach(x: number): number {
  return channelHalf(x) + swaleAt(x);
}

/**
 * Channel bed height: `river.depth` below the water, deepening by `mouth.scour`
 * at the outlet. Uses `drownProgress` because the deepening continues past the
 * shore.
 */
export function channelBed(x: number): number {
  const { river } = LAND;
  return riverSurface(x) - river.depth * (1 + river.mouth.scour * drownProgress(x));
}

/**
 * 0 along the stream, 1 well inside the lake. Uses `lakeReach` so it follows
 * the uneven shoreline.
 */
export function drownProgress(x: number): number {
  const { mouth } = LAND.river;
  return smoothstep(mouth.reach, -mouth.drown, lakeReach(x, riverAt(x)));
}

/** Perpendicular distance from the river centreline. */
export function riverAcross(x: number, z: number): number {
  return Math.abs(z - riverAt(x)) / Math.hypot(1, riverSlope(x));
}

/**
 * 1 up to the outlet, fading out inside the lake. The fade is long so the
 * channel ends buried under the lake bed (`heightAt` takes the deeper of the two).
 */
export function riverReach(x: number): number {
  return 1 - smoothstep(LAND.lake.west, LAND.lake.west + 110, x);
}

/** Bank top height. */
export function bankAt(x: number): number {
  return riverSurface(x) + bankHeight(x);
}

/**
 * Stream water level, derived from the ground. `buildProfile` keeps it below
 * the banks and always flowing downhill.
 */
export function riverSurface(x: number): number {
  const t = clamp01((PROFILE.head - x) / (PROFILE.head - PROFILE.tail)) * (PROFILE.level.length - 1);
  const index = Math.min(Math.floor(t), PROFILE.level.length - 2);
  const fraction = t - index;
  return PROFILE.level[index]! * (1 - fraction) + PROFILE.level[index + 1]! * fraction;
}

/** Sample spacing and smoothing window of the water profile, in metres. */
const PROFILE_STEP = 4;
const PROFILE_SMOOTH = 60;

/**
 * Allowed water drop per metre. The minimum avoids flat canal-like stretches.
 * The maximum stops the water following every dip in the ground.
 */
const PROFILE_FALL = { min: 0.0022, max: 0.02 };

const PROFILE = buildProfile();

/** Smooths the ground first so one deep hollow does not drag the whole stream down. */
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
  // Starts at the lake level.
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

/** 1 in open water, 0 past the shore. The shore shape itself is in `heightAt`. */
export function lakeDepth(x: number, z: number): number {
  return 1 - smoothstep(0, 7, lakeReach(x, z));
}

/**
 * Signed distance past the lake edge, negative inside. The rectangular basin
 * is warped by noise to form bays. Bays deeper than about 44 m would flood the
 * river outlet.
 */
export function lakeReach(x: number, z: number): number {
  const { lake } = LAND;
  const beyond = Math.max(lake.west - x, x - lake.east, lake.far - z, z - lake.near);
  const bays = wave(x / 96 + 3.1, z / 96 - 7.4) * 22 + wave(x / 23 - 1.7, z / 23 + 5.2) * 6;
  return beyond + bays;
}

/**
 * Split of the outlet between the two water meshes: 1 stream, 0 lake. Both
 * read it so they meet cleanly. The stream extends past the shore to cover the
 * lake's hard alpha edge.
 */
export const HANDOVER = { lake: -24, stream: 6 } as const;

export function streamShare(x: number, z: number): number {
  return smoothstep(HANDOVER.lake, HANDOVER.stream, lakeReach(x, z));
}

/** 1 in water, 0 well clear of any bank. A cheap approximation of distance to water. */
export function wetness(x: number, z: number): number {
  return Math.max(riverDepth(x, z), lakeDepth(x, z));
}

/** Height above water reported where there is no water nearby. */
export const DRY = 99;

/**
 * Height above the nearest water body. Negative below the surface, `DRY` far
 * from water. `terrain.ts` uses this for the bank shading bands (gravel, silt,
 * damp grass, grass).
 *
 * The nearer body wins. Both fade out gradually to avoid a visible ring.
 */
export function freeboardAt(x: number, z: number, y: number): number {
  const { river, lake } = LAND;
  const bankTop = bankReach(x);

  const stream =
    riverReach(x) *
    (1 - smoothstep(bankTop + river.plain * 0.55, bankTop + river.plain, riverAcross(x, z)));
  // Covers open water too, since the bed is visible through shallow water.
  const basin = Math.max(
    lakeDepth(x, z),
    1 - smoothstep(lake.apron * 0.55, lake.apron, lakeReach(x, z)),
  );

  if (stream <= 0 && basin <= 0) return DRY;
  const level = stream >= basin ? riverSurface(x) : lake.surface;
  return y - level + (1 - Math.max(stream, basin)) * DRY;
}

/** How much the playground flattens the ground. Here to avoid a circular import with the terrain. */
export function pitch(x: number, z: number): number {
  const [cx, cz] = PLAYGROUND.centre;
  const reach = Math.hypot(x - cx, (z - cz) / PLAYGROUND.oval);
  return 1 - smoothstep(PLAYGROUND.radius, PLAYGROUND.radius + 14, reach);
}

/** Distance to the east-west promenade's paved edge. */
export function offPromenade(x: number, z: number): number {
  if (Math.abs(x) > REALM.run / 2) return Infinity;
  const near = REALM.forecourtFar;
  const far = REALM.promenadeFar;
  if (z >= near && z <= far) return 0;
  return z < near ? near - z : z - far;
}

/** Distance to the riverside walk's paved edge, perpendicular to its centreline. */
export function offRiverside(x: number, z: number): number {
  if (x < RIVERSIDE.from || x > RIVERSIDE.to) return Infinity;
  const across = Math.abs(z - riversideAt(x)) / Math.hypot(1, riversideSlope(x));
  return Math.max(0, across - RIVERSIDE.halfWidth);
}

/** Riverside walk slope (dz/dx). */
export function riversideSlope(x: number): number {
  return riversideAt(x + 0.5) - riversideAt(x - 0.5);
}

/** Distance to the nearest paved path. */
export function offPaths(x: number, z: number): number {
  return Math.min(offAvenue(x, z), offPromenade(x, z), offRiverside(x, z));
}

/** Distance to any built ground: paths with their gutters, forecourt, playground, pavilion. */
export function offBuilt(x: number, z: number): number {
  return Math.min(
    Math.max(0, offPaths(x, z) - PATH_EDGE_WIDTH),
    offForecourt(x, z),
    offPlayground(x, z),
    offPavilion(x, z),
  );
}

/**
 * Whether a point is inside the review row camera's view, which must stay free
 * of planting. Extends slightly behind the camera.
 */
export function inReviewShot(x: number, z: number): boolean {
  const [cx, , cz] = REVIEW.centre;
  return Math.abs(x - cx) < REVIEW.clear && z > cz - 8 && z < cz + REVIEW.standoff + 6;
}

/** Distance to the pavilion and its clear zone, in the pavilion's rotated frame. */
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

/** Pavilion rotation, matching the walk beside it. */
export function pavilionYaw(): number {
  return Math.atan2(riversideSlope(PAVILION.centre[0]), 1);
}

/** Distance to the forecourt and building. */
function offForecourt(x: number, z: number): number {
  return Math.max(
    Math.abs(x) - REALM.halfWidth,
    LAND.core.far - z,
    z - REALM.forecourtFar,
    0,
  );
}

/** Distance to the playground fence. */
function offPlayground(x: number, z: number): number {
  const [cx, cz] = PLAYGROUND.centre;
  const reach = Math.hypot(x - cx, (z - cz) / PLAYGROUND.oval);
  return Math.max(0, reach - (PLAYGROUND.radius + 2.4));
}

/**
 * The planting beds beside the entrance path. Plants are allowed here even
 * though it is built ground. Their plants come from `exterior-planting.glb`.
 */
export function inBeds(x: number, z: number): boolean {
  return (
    z > REALM.bedNear &&
    z < REALM.forecourtFar &&
    Math.abs(x) > REALM.pathHalfWidth &&
    Math.abs(x) < REALM.halfWidth
  );
}

/** Whether a plant can go here with `clearance` metres of free ground around it. */
export function plantable(x: number, z: number, clearance = 0): boolean {
  if (wetness(x, z) > 0.12) return false;
  if (inBeds(x, z)) return true;
  return offBuilt(x, z) > clearance;
}

export function clamp01(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}

/**
 * Deterministic value noise in 0..1 (`wave` gives -1..1). Deterministic so the
 * scene looks the same on every run.
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
