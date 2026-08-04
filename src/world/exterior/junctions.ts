/**
 * Where two paved routes meet, worked out from the routes themselves.
 *
 * A junction is a *shape*, and deleting rectangles from two ribbons cannot make
 * one — which matters here because the riverside walk meets the avenue at 66°,
 * and that is the junction the camera stands on for two consecutive scenes.
 *
 * So the shape is constructed: in each of the four quadrants the two carriageway
 * edges are met with an arc tangent to both, as in
 * `another_park_pathway_idea`. The arcs then say exactly how much of each
 * route's kerb has to go, so `realm.ts` and this module cannot disagree.
 */

export interface Route {
  readonly route: string;
  readonly halfWidth: number;
  readonly from: number;
  readonly to: number;
  readonly axis: 'x' | 'z';
  readonly centre: (along: number) => number;
}

/** One station of a fillet's outer profile: a point, and which way is grass. */
export interface Frame {
  readonly x: number;
  readonly z: number;
  /** Unit normal pointing off the carriageway, which is the way the section runs. */
  readonly nx: number;
  readonly nz: number;
}

/**
 * One quadrant's worth of junction: the curve its paving is bounded by.
 *
 * Only the boundary, because the *fill* is a radial patch swept from the
 * crossing point out to it. Filling the wedge alone — from the corner the two
 * carriageway edges make, out to the arc — is the obvious construction and it
 * does not work: its inner sides are chords of two curved ribbons, so it leaves
 * a sliver of bare ground against each of them, and no amount of tuning where
 * the chords sit closes both at once. Sweeping from the middle of the junction
 * instead means the patch *contains* both carriageways and there is no inner
 * boundary left to disagree with anything.
 */
export interface Fillet {
  readonly frames: readonly Frame[];
}

/**
 * How much of one route's edge, on one side, the junction has taken over.
 *
 * Held as a projection onto the route's own direction rather than as an
 * interval of its parameter, so a caller can test any point it already has
 * without converting coordinates. The two ends are the tangent points of the
 * two fillets on that side, which is precisely where the kerb stops being
 * straight.
 */
export interface Mouth {
  readonly route: string;
  readonly side: number;
  readonly ox: number;
  readonly oz: number;
  readonly ax: number;
  readonly az: number;
  readonly from: number;
  readonly to: number;
}

export interface Junction<T extends Route> {
  readonly senior: T;
  readonly minor: T;
  readonly at: readonly [number, number];
  readonly fillets: readonly Fillet[];
  readonly mouths: readonly Mouth[];
}

/**
 * Kerb radius at a junction, in metres, before the site has its say.
 *
 * Large enough that the arc is read as a radius rather than as a chamfer, and
 * small enough that the mouth does not swallow the whole crossing. It is a
 * maximum rather than a value: `wedge` reduces it until the tangent points fit
 * on the routes that are actually there, because the riverside walk crosses the
 * avenue only sixteen metres short of the bridge and a radius that reaches past
 * the abutment would pave the bank.
 */
const RADIUS = 2.6;

/**
 * How far either side of the crossing the straight lines this is built on have
 * to agree with the curves they stand for.
 *
 * The construction is a straight-line one — two edges, an arc tangent to both —
 * and the riverside walk is not straight. Taking each route's direction from a
 * derivative at the crossing makes a tangent, which leaves the curve by a third
 * of a metre by the time it reaches the tangent point; the fan then starts
 * outside the ribbon's own edge and the gap between them is bare ground.
 *
 * A **secant** over the reach the junction actually occupies meets the curve at
 * both ends instead of at one, so what is left is the sagitta in between —
 * under a tenth of a metre, which the fill's own overlap absorbs.
 */
const SECANT = 4.0;


/**
 * How far past its tangent point a fillet runs before handing back to the
 * ribbon.
 *
 * The ribbons are swept in whole quads and can only stop on a quad boundary, so
 * the handover can miss by up to one step. Rather than cutting quads — which is
 * a mesh problem for a millimetre of benefit — the fillet overruns and the
 * ribbon gives way conservatively, so the two always overlap. The overlap costs
 * nothing because both are the same section on the same ground; it only needs
 * the fillet to win the depth test, which is what `TIER` is for.
 *
 * Generous, because the ribbon gives way by more than a step: a section cut
 * square to a skewed route reaches back along it by the offset times the skew,
 * so the outer gutter of a quad tests a metre further into the mouth than its
 * centreline does, and the whole quad goes with it.
 */
export const LEAD = 2.8;

/**
 * Metres between stations along a lead.
 *
 * The lead is where the straight construction becomes the curve again, which
 * cannot be done in one step. A station is also the width of a span in the fan
 * that fills the junction, so a lead drawn as one 2.8 m chord let the top of the
 * river bank come through the middle of its own paving.
 */
const STATION = 0.7;

/** Stations round the arc. One every ~9°, which is smooth at a metre's range. */
const ARC = 10;

/**
 * Every place two routes cross, with the junction that belongs there.
 *
 * Priority is the table's order, exactly as it is for the ribbons: the earlier
 * route carries through and the later one gives way, so the mouth is paved in
 * the senior's surface.
 */
export function crossings<T extends Route>(paths: readonly T[]): Junction<T>[] {
  const found: Junction<T>[] = [];

  for (let senior = 0; senior < paths.length; senior += 1) {
    for (let minor = senior + 1; minor < paths.length; minor += 1) {
      const a = paths[senior]!;
      const b = paths[minor]!;
      if (a.route === b.route || a.axis === b.axis) continue;
      const junction = cross(a, b);
      if (junction) found.push(junction);
    }
  }

  return found;
}

/** Whether a point lies in the stretch of kerb a junction has taken over. */
export function inMouth(mouth: Mouth, x: number, z: number): boolean {
  const t = (x - mouth.ox) * mouth.ax + (z - mouth.oz) * mouth.az;
  return t >= mouth.from && t <= mouth.to;
}

type Vec = readonly [number, number];

function cross<T extends Route>(senior: T, minor: T): Junction<T> | null {
  const at = meeting(senior, minor);
  if (!at) return null;

  const s = heading(senior, at);
  const m = heading(minor, at);
  const ns = normal(senior, s);
  const nm = normal(minor, m);

  const fillets: Fillet[] = [];
  const reach = new Map<string, [number, number]>();

  const quadrants = [-1, 1].flatMap((side) =>
    [-1, 1].map((across) => ({
      side,
      across,
      arms: corner(at, senior, s, ns, side, minor, m, nm, across),
    })),
  );

  // One radius for the whole junction, and it is the smallest any of its four
  // corners can carry. Four different radii at one crossing would read as a
  // mistake even where each of them fits — and one of them is always tight,
  // because the riverside walk meets the avenue sixteen metres short of the
  // bridge and the avenue's paving stops at the abutment.
  const radius = quadrants.reduce(
    (limit, { arms }) => (arms ? Math.min(limit, arms.limit) : limit),
    RADIUS,
  );

  for (const { side, across, arms } of quadrants) {
    if (!arms) continue;
    const quadrant = wedge(arms, radius);
    fillets.push(quadrant.fillet);

    extend(reach, `${senior.route}:${side}`, dot(sub(quadrant.tangentSenior, at), s));
    extend(reach, `${minor.route}:${across}`, dot(sub(quadrant.tangentMinor, at), m));
  }

  const mouths: Mouth[] = [];
  for (const [key, span] of reach) {
    const [route, side] = key.split(':') as [string, string];
    const axis = route === senior.route ? s : m;
    mouths.push({
      route,
      side: Number(side),
      ox: at[0],
      oz: at[1],
      ax: axis[0],
      az: axis[1],
      from: span[0],
      to: span[1],
    });
  }

  return { senior, minor, at, fillets, mouths };
}

function extend(reach: Map<string, [number, number]>, key: string, value: number): void {
  const span = reach.get(key);
  if (!span) reach.set(key, [value, value]);
  else reach.set(key, [Math.min(span[0], value), Math.max(span[1], value)]);
}

/** One quadrant's two arms, before a radius has been settled on. */
interface Arms {
  readonly at: Vec;
  readonly corner: Vec;
  readonly angle: number;
  readonly senior: Arm;
  readonly minor: Arm;
  /** The largest radius this quadrant's shorter arm can carry. */
  readonly limit: number;
}

/** One route leaving a junction corner: which way it goes, and how far it can. */
interface Arm {
  readonly path: Route;
  readonly along: Vec;
  readonly outward: Vec;
  /** Which side of the centreline this arm's edge is, as the sign of its offset. */
  readonly side: number;
  /** Ground distance from the corner to the end of the route, along `along`. */
  readonly run: number;
}

/**
 * Where one quadrant's two carriageway edges meet, and how much room each has.
 *
 * The only part worth spelling out is which way the two edges run *away* from
 * their corner: it is whichever direction increases the distance from the other
 * route, which is a sign test rather than a case analysis and so cannot be got
 * backwards for a particular skew.
 */
function corner(
  at: Vec,
  senior: Route,
  s: Vec,
  ns: Vec,
  side: number,
  minor: Route,
  m: Vec,
  nm: Vec,
  across: number,
): Arms | null {
  const offsetSenior = senior.halfWidth * side;
  const offsetMinor = minor.halfWidth * across;

  const a = add(at, scale(ns, offsetSenior));
  const b = add(at, scale(nm, offsetMinor));

  const denominator = cross2(s, m);
  if (Math.abs(denominator) < 1e-4) return null;
  const meet = add(a, scale(s, cross2(sub(b, a), m) / denominator));

  const away = (dir: Vec, other: Vec, offset: number): Vec =>
    scale(dir, Math.sign(offset * dot(dir, other)) || 1);

  const alongSenior = away(s, nm, offsetMinor);
  const alongMinor = away(m, ns, offsetSenior);

  const angle = Math.acos(Math.min(1, Math.max(-1, dot(alongSenior, alongMinor))));
  if (!(angle > 1e-3 && angle < Math.PI - 1e-3)) return null;

  const arms = {
    senior: {
      path: senior,
      along: alongSenior,
      outward: scale(ns, Math.sign(offsetSenior)),
      side: Math.sign(offsetSenior),
      run: runAhead(senior, meet, alongSenior),
    },
    minor: {
      path: minor,
      along: alongMinor,
      outward: scale(nm, Math.sign(offsetMinor)),
      side: Math.sign(offsetMinor),
      run: runAhead(minor, meet, alongMinor),
    },
  };

  return {
    at,
    corner: meet,
    angle,
    ...arms,
    limit: Math.max(0.4, Math.min(arms.senior.run, arms.minor.run) * Math.tan(angle / 2)),
  };
}

/** How far a route still runs from a point, in the direction given. */
function runAhead(path: Route, from: Vec, dir: Vec): number {
  const component = path.axis === 'z' ? dir[1] : dir[0];
  const here = path.axis === 'z' ? from[1] : from[0];
  const end = component >= 0 ? path.to : path.from;
  return Math.max(0, Math.abs(end - here) / Math.max(Math.abs(component), 1e-3));
}

/** The arc that fills one quadrant, and where it leaves each route. */
function wedge(arms: Arms, radius: number): {
  fillet: Fillet;
  tangentSenior: Vec;
  tangentMinor: Vec;
} {
  const { corner: meet, angle, senior, minor } = arms;

  const tangent = radius / Math.tan(angle / 2);
  const centre = add(meet, scale(unit(add(senior.along, minor.along)), radius / Math.sin(angle / 2)));

  const tangentSenior = add(meet, scale(senior.along, tangent));
  const tangentMinor = add(meet, scale(minor.along, tangent));

  const frames: Frame[] = [
    ...lead(senior, tangentSenior, tangent).reverse(),
  ];

  const from = Math.atan2(tangentSenior[1] - centre[1], tangentSenior[0] - centre[0]);
  const to = Math.atan2(tangentMinor[1] - centre[1], tangentMinor[0] - centre[0]);
  // The short way round, which is the one that passes the corner. The long way
  // is a hole punched through the middle of the junction.
  let sweep = to - from;
  while (sweep > Math.PI) sweep -= Math.PI * 2;
  while (sweep < -Math.PI) sweep += Math.PI * 2;

  for (let step = 0; step <= ARC; step += 1) {
    const theta = from + (sweep * step) / ARC;
    const nx = -Math.cos(theta);
    const nz = -Math.sin(theta);
    frames.push({ x: centre[0] - nx * radius, z: centre[1] - nz * radius, nx, nz });
  }

  frames.push(...lead(minor, tangentMinor, tangent));

  return { fillet: { frames }, tangentSenior, tangentMinor };
}

/**
 * The stations between a tangent point and the ribbon the fillet hands back to.
 *
 * **Sampled from the route, not projected along a straight line.** The fillet is
 * a straight-line construction and the riverside walk is a curve, so a lead run
 * on straight leaves the ribbon's own edge by a third of a metre — and the two
 * kerbs arrive at the handover as diverging bands with bare ground between them.
 *
 * The construction's offset from the curve is therefore carried at the tangent
 * point, where the arc must be met exactly, and eased out well before the
 * ribbon, which gives way generously and must be met exactly too.
 *
 * Capped by the run the arm has. Where a route ends inside the junction's reach
 * — the avenue does, at the bridge abutment — paving that ran on would land
 * under the deck.
 */
function lead(arm: Arm, tangent: Vec, spent: number): Frame[] {
  const reach = Math.max(0, Math.min(LEAD, arm.run - spent));
  if (reach <= 1e-3) return [];

  const { path, side } = arm;
  const offset = path.halfWidth * side;
  const at = path.axis === 'z' ? tangent[1] : tangent[0];
  const step = path.axis === 'z' ? arm.along[1] : arm.along[0];
  const drift = sub(tangent, edgeAt(path, at, offset));

  const frames: Frame[] = [];
  const stations = Math.max(1, Math.ceil(reach / STATION));
  for (let station = 1; station <= stations; station += 1) {
    const fraction = station / stations;
    const along = at + reach * fraction * step;
    const out = scale(normal(path, bearingAt(path, along)), side);
    const point = add(edgeAt(path, along, offset), scale(drift, Math.max(0, 1 - 2 * fraction)));
    frames.push({ x: point[0], z: point[1], nx: out[0], nz: out[1] });
  }
  return frames;
}

/**
 * Where a section offset lands on the ground, at one station along a route.
 *
 * Offset along the centreline's own normal, which stops a path widening through
 * its bends. The same construction the ribbons are swept with, and it has to be
 * — otherwise the fillet hands back to an edge the ribbon never drew.
 */
function edgeAt(path: Route, along: number, offset: number): Vec {
  const on: Vec = path.axis === 'z' ? [path.centre(along), along] : [along, path.centre(along)];
  return add(on, scale(normal(path, bearingAt(path, along)), offset));
}

/** Unit direction of a route at one station, in site coordinates. */
function bearingAt(path: Route, along: number): Vec {
  const slope = path.centre(along + 0.5) - path.centre(along - 0.5);
  return unit(path.axis === 'z' ? [slope, 1] : [1, slope]);
}

/**
 * Where two centrelines meet.
 *
 * One is a function of z and the other a function of x, so the crossing is the
 * fixed point of composing them. The avenue is straight and the riverside walk
 * slack, which makes the composition a strong contraction and the iteration a
 * formality — but it is written as an iteration rather than solved by hand
 * because the whole point of `paths.ts` is that either centreline may be
 * changed without anything downstream being retyped.
 */
function meeting(a: Route, b: Route): Vec | null {
  const [along, across] = a.axis === 'z' ? [a, b] : [b, a];

  // `along` is x as a function of z; `across` is z as a function of x. The
  // crossing is therefore the fixed point of one composed with the other.
  let x = (across.from + across.to) / 2;
  for (let step = 0; step < 60; step += 1) {
    const next = along.centre(across.centre(x));
    if (Math.abs(next - x) < 1e-6) {
      x = next;
      break;
    }
    x = next;
  }

  const z = across.centre(x);
  if (x < across.from || x > across.to) return null;
  if (z < along.from || z > along.to) return null;
  // A fixed point that is not a crossing: two near-parallel routes converge
  // happily on a point neither of them passes through.
  if (Math.abs(along.centre(z) - x) > 1e-3) return null;

  return [x, z];
}

/**
 * Unit direction of a route where it passes a point, in site coordinates.
 *
 * A secant over `SECANT` metres rather than a derivative, which matters
 * because everything downstream is built from straight lines: a derivative
 * makes a tangent that leaves a curving route by a third of a metre by the time
 * it reaches the tangent point, and the ribbon's own edge is then inside the
 * fill's boundary with bare ground showing between them.
 */
function heading(path: Route, at: Vec): Vec {
  const along = path.axis === 'z' ? at[1] : at[0];
  const slope = (path.centre(along + SECANT) - path.centre(along - SECANT)) / (2 * SECANT);
  return unit(path.axis === 'z' ? [slope, 1] : [1, slope]);
}

/**
 * The direction a *positive* section offset moves in, which is not simply "the
 * left-hand perpendicular".
 *
 * A route along +Z offsets its section in X and a route along +X offsets its
 * section in Z, and those are opposite handedness. One perpendicular for both
 * puts every mouth on the wrong side of half the network — kerbs surviving
 * inside the junction and vanishing outside it. Derived from the axis so it
 * matches the offset `realm.ts` sweeps its ribbons with.
 */
function normal(path: Route, [x, z]: Vec): Vec {
  return path.axis === 'z' ? [z, -x] : [-z, x];
}

function unit([x, z]: Vec): Vec {
  const length = Math.hypot(x, z) || 1;
  return [x / length, z / length];
}

function add(a: Vec, b: Vec): Vec {
  return [a[0] + b[0], a[1] + b[1]];
}

function sub(a: Vec, b: Vec): Vec {
  return [a[0] - b[0], a[1] - b[1]];
}

function scale(a: Vec, k: number): Vec {
  return [a[0] * k, a[1] * k];
}

function dot(a: Vec, b: Vec): number {
  return a[0] * b[0] + a[1] * b[1];
}

function cross2(a: Vec, b: Vec): number {
  return a[0] * b[1] - a[1] * b[0];
}
