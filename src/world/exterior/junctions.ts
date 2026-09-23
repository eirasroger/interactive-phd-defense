/**
 * Path junction geometry. In each of the four corners where two paths cross,
 * the two path edges are joined by an arc tangent to both (see
 * `another_park_pathway_idea`). The arcs also define how much kerb `realm.ts`
 * removes.
 */

export interface Route {
  readonly route: string;
  readonly halfWidth: number;
  readonly from: number;
  readonly to: number;
  readonly axis: 'x' | 'z';
  readonly centre: (along: number) => number;
}

/** One point on a fillet's outer edge, with its outward normal. */
export interface Frame {
  readonly x: number;
  readonly z: number;
  /** Unit normal pointing away from the paving. */
  readonly nx: number;
  readonly nz: number;
}

/**
 * The outer edge of one junction corner. The paving is filled from the
 * crossing point out to this edge, so it covers both paths with no gaps.
 */
export interface Fillet {
  readonly frames: readonly Frame[];
}

/**
 * The stretch of one path edge that the junction replaces, stored as a range
 * along the path's direction. The ends are the arc tangent points.
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

/** Max kerb radius at a junction in metres. Reduced where a path ends too close to fit it. */
const RADIUS = 2.6;

/**
 * Half-length of the secant used for path direction at a crossing. A secant
 * fits a curved path better than a tangent over the junction's size.
 */
const SECANT = 4.0;

/**
 * How far a fillet continues past its tangent point. Paths can only stop on
 * whole quads, so the fillet overlaps them to avoid gaps. `TIER` makes the
 * fillet win the depth test.
 */
export const LEAD = 2.8;

/** Spacing between points along a lead. Small enough that the paving follows the ground. */
const STATION = 0.7;

/** Points along the arc, about one every 9°. */
const ARC = 10;

/**
 * All path crossings with their junction geometry. The earlier path in the
 * list has priority, and its surface paves the junction.
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

/** Whether a point is in the stretch of kerb a junction replaces. */
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

  // Same radius on all four corners: the smallest that every corner can fit.
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

/** The two path edges at one junction corner, before the radius is chosen. */
interface Arms {
  readonly at: Vec;
  readonly corner: Vec;
  readonly angle: number;
  readonly senior: Arm;
  readonly minor: Arm;
  /** The largest radius this corner can fit. */
  readonly limit: number;
}

/** One path edge leaving a junction corner: its direction and how far it runs. */
interface Arm {
  readonly path: Route;
  readonly along: Vec;
  readonly outward: Vec;
  /** Side of the centreline, as the sign of the offset. */
  readonly side: number;
  /** Distance from the corner to the end of the path, along `along`. */
  readonly run: number;
}

/**
 * Where two path edges meet at one corner, and how much room each has. Each
 * edge runs away from the corner in the direction that moves away from the
 * other path.
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

/** Remaining path length from a point in the given direction. */
function runAhead(path: Route, from: Vec, dir: Vec): number {
  const component = path.axis === 'z' ? dir[1] : dir[0];
  const here = path.axis === 'z' ? from[1] : from[0];
  const end = component >= 0 ? path.to : path.from;
  return Math.max(0, Math.abs(end - here) / Math.max(Math.abs(component), 1e-3));
}

/** The arc for one corner, and its tangent points on each path. */
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
  // Take the short way round the arc.
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
 * Points from a tangent point back to the path edge. Sampled along the real
 * curved path, with the offset at the tangent point eased out so both ends
 * line up. Stops early if the path ends first.
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

/** A point offset from the path centreline along its normal, same as `realm.ts`. */
function edgeAt(path: Route, along: number, offset: number): Vec {
  const on: Vec = path.axis === 'z' ? [path.centre(along), along] : [along, path.centre(along)];
  return add(on, scale(normal(path, bearingAt(path, along)), offset));
}

/** Unit direction of a path at a position along it. */
function bearingAt(path: Route, along: number): Vec {
  const slope = path.centre(along + 0.5) - path.centre(along - 0.5);
  return unit(path.axis === 'z' ? [slope, 1] : [1, slope]);
}

/**
 * Where two centrelines cross. One gives x from z and the other z from x, so
 * the crossing is found by fixed-point iteration. Works for any centreline shape.
 */
function meeting(a: Route, b: Route): Vec | null {
  const [along, across] = a.axis === 'z' ? [a, b] : [b, a];

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
  // Near-parallel paths can converge on a point neither passes through.
  if (Math.abs(along.centre(z) - x) > 1e-3) return null;

  return [x, z];
}

/** Path direction at a point, from a secant over `SECANT` metres. */
function heading(path: Route, at: Vec): Vec {
  const along = path.axis === 'z' ? at[1] : at[0];
  const slope = (path.centre(along + SECANT) - path.centre(along - SECANT)) / (2 * SECANT);
  return unit(path.axis === 'z' ? [slope, 1] : [1, slope]);
}

/**
 * Direction of a positive section offset. Paths along Z and X use opposite
 * perpendiculars, matching how `realm.ts` builds them.
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
