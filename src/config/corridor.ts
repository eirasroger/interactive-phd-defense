import plan from './corridorPlan.json';

const SCALE = plan.metresPerUnit;

export const metres = (units: number): number => units * SCALE;

const stationAt = (column: number): number =>
  metres((plan.columnX[column] ?? 0) + plan.box.width / 2) + plan.lead;

const laneAt = (lane: keyof typeof plan.laneY): number =>
  metres(plan.laneY[lane] - plan.laneY.axis);

/** A gallery is the figure's box, extruded. */
export const ROOM = {
  length: metres(plan.box.width),
  width: metres(plan.box.height),
} as const;

export interface Station {
  readonly key: string;
  readonly z: number;
  readonly x: number;
  /** Which side the gallery opens to: -1 west, +1 east, 0 both or neither. */
  readonly wing: number;
  /** x of each washed wall; one light trough runs the head of each. */
  readonly wash: readonly number[];
}

const HALF_WIDTH = ROOM.width / 2;
const wingWall = (side: number): number => side * (HALF_WIDTH + plan.wing.depth);
const alcoveWall = (side: number): number => side * (HALF_WIDTH + plan.wing.alcove);

export const STATIONS: readonly Station[] = [
  { key: 'C1', z: stationAt(0), x: 0, wing: -1, wash: [wingWall(-1)] },
  { key: 'C2', z: stationAt(1), x: 0, wing: 1, wash: [wingWall(1)] },
  { key: 'C3', z: stationAt(2), x: laneAt('high'), wing: 0, wash: [laneAt('high') - HALF_WIDTH] },
  { key: 'C4', z: stationAt(2), x: laneAt('low'), wing: 0, wash: [laneAt('low') + HALF_WIDTH] },
  { key: 'C5', z: stationAt(3), x: 0, wing: 0, wash: [alcoveWall(-1), alcoveWall(1)] },
];

const terminal = STATIONS[4] as Station;

/** The back wall of the last room. There is nothing beyond it. */
export const RUN = terminal.z + ROOM.length / 2;

/** Half the widest moment: C3 and C4 face each other across the axis. */
export const CROSS = Math.abs(laneAt('low')) + ROOM.width / 2;

/** Half the low spine the camera stands in between C3 and C4. */
export const SPINE = Math.abs(laneAt('low')) - ROOM.width / 2;

export const SECTION = plan.section;
export const WING = plan.wing;
export const FLOW = plan.flow;

export const PLAN_ASPECT = RUN / (CROSS * 2);

/** A point on the plan: x across the run, z along it, both in metres. */
export type PlanPoint = readonly [number, number];

/** Solid between two voids, and the thickness every wall band is drawn at. */
export const WALL = 0.3;

export interface CellWing {
  readonly side: number;
  /** x of the gallery wall the wing opens through, and of its own far wall. */
  readonly near: number;
  readonly far: number;
  readonly y0: number;
  readonly y1: number;
}

/** One member of the enfilade: a gallery, a link, or a flank of the cross. */
export interface Cell {
  readonly key: string;
  readonly y0: number;
  readonly y1: number;
  readonly half: number;
  readonly centre: number;
  readonly top: number;
  /** Sides with no wall at all, because another member is on the far side. */
  readonly opens: readonly number[];
  readonly wings: readonly CellWing[];
}

/**
 * The enfilade, as the building is carved from it.
 *
 * **This mirrors `enfilade()` in `tools/blender/corridor_shell.py`**, and the
 * mirror is deliberate: both sides derive the same members from
 * `corridorPlan.json`, because Python cannot import this and glTF carries
 * geometry rather than the plan that produced it. Change one and change the
 * other — the shape of a member is the one thing here that is stated twice.
 *
 * The runtime needs it because the plan the corridor is read as from above is
 * drawn from the plan, not traced off the mesh: an `EdgesGeometry` of the shell
 * returns every bevel, every oak board and both faces of every wall, which is a
 * wireframe of a building and not a drawing of one.
 */
const enfilade = (): Cell[] => {
  const half = ROOM.length / 2;
  const room = ROOM.width / 2;
  const link = SECTION.linkWidth / 2;
  const linkTop = SECTION.floor + SECTION.linkHeight;
  const roomTop = SECTION.floor + SECTION.roomHeight;
  const lane = Math.abs(laneAt('low'));
  const [c1, c2, cross, c5] = [stationAt(0), stationAt(1), stationAt(2), stationAt(3)];
  const [front, back] = [cross - half, cross + half];

  const wing = (cell: Omit<Cell, 'wings'>, side: number, depth: number, inset: number): CellWing => ({
    side,
    near: cell.centre + side * cell.half,
    far: cell.centre + side * (cell.half + depth),
    y0: cell.y0 + inset,
    y1: cell.y1 - inset,
  });

  const cell = (
    key: string,
    y0: number,
    y1: number,
    halfWidth: number,
    top: number,
    centre = 0,
    opens: readonly number[] = [],
    wings: readonly [number, number, number][] = [],
  ): Cell => {
    const base = { key, y0, y1, half: halfWidth, centre, top, opens };
    return { ...base, wings: wings.map(([side, depth, inset]) => wing(base, side, depth, inset)) };
  };

  const side: [number, number, number] = [-1, WING.depth, WING.return];
  const alcove: [number, number, number] = [-1, WING.alcove, WING.inset];
  const mirror = ([, depth, inset]: [number, number, number]): [number, number, number] => [
    1,
    depth,
    inset,
  ];

  return [
    cell('mouth', 0, SECTION.nest, SECTION.mouthWidth / 2, linkTop),
    cell('entry', SECTION.nest, c1 - half, link, linkTop),
    cell('room1', c1 - half, c1 + half, room, roomTop, 0, [], [side]),
    cell('link1', c1 + half, c2 - half, link, linkTop),
    cell('room2', c2 - half, c2 + half, room, roomTop, 0, [], [mirror(side)]),
    cell('link2', c2 + half, front, link, linkTop),
    cell('spine', front, back, SPINE, roomTop, 0, [-1, 1]),
    cell('c3', front, back, room, roomTop, -lane, [1]),
    cell('c4', front, back, room, roomTop, lane, [-1]),
    cell('link3', back, c5 - half, link, linkTop),
    cell('room5', c5 - half, RUN, room, SECTION.floor + SECTION.terminalHeight, 0, [], [
      alcove,
      mirror(alcove),
    ]),
  ];
};

export const CELLS: readonly Cell[] = enfilade();

export interface FlowRoute {
  readonly key: string;
  /**
   * How far downstream this route starts, in routes rather than metres. The
   * network's arclength is accumulated from it, so one pulse released at the
   * mouth reaches C5 through both branches at the same moment.
   */
  readonly stage: number;
  readonly points: readonly PlanPoint[];
}

const CROSS_Z = stationAt(2);
const FAN = (ROOM.length / 2) * plan.flow.fan;
const BRANCH = Math.abs(laneAt('low'));

/**
 * The figure, as routes through the built volume.
 *
 * Every turn happens where the building is open. The fan is inside the cross
 * and not in the link before it, because a link is 3.2 m wide and a branch
 * turning there would leave through a wall. The axis carries nothing between
 * the fan and the merge: there is no C2 → C5 edge at inference time, so
 * everything detours through C3 and C4, and the audience standing on the axis
 * watches the flow divide around them and come back together.
 *
 * **A branch is a chevron, not an elbow.** Routed orthogonally — out to the
 * lane, along it, and back — the two branches close into a rounded rectangle
 * sitting in the middle of the cross, and a rectangle reads as a loop rather
 * than as a division: the cross-overs came to 13 m against a 6 m run through
 * the room, so the detour was longer than the thing it was detouring to. The
 * room is too short against the lane offset for an orthogonal route to read.
 * Two diagonals turning at the lane say *divide* and *rejoin* in one shape, and
 * they put the turn exactly where C3 and C4 are labelled.
 */
export const FLOW_ROUTES: readonly FlowRoute[] = [
  {
    key: 'spine',
    stage: 0,
    points: [
      [0, 0],
      [0, CROSS_Z - FAN],
    ],
  },
  {
    key: 'c3',
    stage: 1,
    points: [
      [0, CROSS_Z - FAN],
      [-BRANCH, CROSS_Z],
      [0, CROSS_Z + FAN],
    ],
  },
  {
    key: 'c4',
    stage: 1,
    points: [
      [0, CROSS_Z - FAN],
      [BRANCH, CROSS_Z],
      [0, CROSS_Z + FAN],
    ],
  },
  {
    key: 'tail',
    stage: 2,
    points: [
      [0, CROSS_Z + FAN],
      [0, RUN - 1.1],
    ],
  },
];

/**
 * The ceiling opens at the end of the corridor's run, and the deck is what
 * decides where that is — `scenes/act3/index.ts` asserts the two still agree.
 */
export const RISE = {
  opens: 1,
  lift: 24,
} as const;
