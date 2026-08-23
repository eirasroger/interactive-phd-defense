import { STAGE } from './presentation';
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
/**
 * The corridor's scene run, and the two states the overlook is made of.
 *
 * Zone progress is derived from the deck's order, so the states the world can be
 * in are positions in this run rather than authored numbers. Act III's themes
 * stay inside the corridor zone even though there is no corridor left in them:
 * what they are argued inside is the sea, the sea belongs to this zone, and a
 * zone change would take it away and put a hard cut where the dive is.
 *
 * Adding a theme means raising `CORRIDOR_RUN` and nothing else. The thresholds
 * are indices into the run, so they move with it, and
 * `scenes/act3/index.ts` asserts the deck against them at load.
 */
const ACT2_STATIONS = 5;
const CORRIDOR_RUN = ACT2_STATIONS + 4;

export const RISE = {
  /** The ceiling comes off, the shell drains and the plan is read. */
  opens: ACT2_STATIONS / (CORRIDOR_RUN - 1),
  /** The plan clears, and the sea it clears into is what Act III stands in. */
  disperses: (ACT2_STATIONS + 1) / (CORRIDOR_RUN - 1),
  lift: 24,
} as const;

/**
 * Where station `index` stands in the corridor's run.
 *
 * The projector and its screens light a station as the camera reaches it, and
 * what they are handed is zone progress, which is a fraction of a run whose
 * length they do not control. Reading it as `index / SCREENS.length` is only
 * correct while the run is exactly the five stations plus one, and it fails
 * silently the moment Act III gains a scene: every station's progress shifts
 * down, the threshold does not, and the camera stands at C5 in front of a wall
 * that was never lit. Nothing errors and nothing looks broken except the thing
 * the whole act is read off.
 *
 * So the position comes from the run, once, here.
 */
export const stationProgress = (index: number): number => index / (CORRIDOR_RUN - 1);

/**
 * How the figure leaves, and why it leaves in a direction.
 *
 * A uniform fade to black is the one move a slide deck can already do, and it
 * says nothing. The figure clears the way the pipeline runs, from the mouth
 * through to C5, so the last thing to go is the station the camera climbed out
 * of and the direction reads as the argument finishing.
 *
 * `soft` is what makes it a dissolve rather than a wipe: the front is nineteen
 * metres deep on a run of seventy-five, so a quarter of the figure is
 * mid-departure at any moment and no edge is ever visible as a line. `grain`
 * bends that front by a low-frequency function of position, enough that rooms
 * do not empty in rank order.
 *
 * The drawing and the flow share it, because two layers of one figure leaving
 * on separately tuned curves is two things leaving.
 */
export const SWEEP = { soft: 19, grain: 0.42 } as const;

/**
 * Where the clearing front stands at `level`.
 *
 * A full soft-edge behind the mouth at 0, so nothing has started; one past C5
 * at 1, so nothing is left.
 */
export const sweepFront = (level: number): number =>
  -SWEEP.soft * 2 + level * (RUN + SWEEP.soft * 3);

export interface Screen {
  readonly key: string;
  readonly centre: PlanPoint3;
  readonly normal: PlanPoint3;
  readonly width: number;
  readonly height: number;
  readonly ceiling: number;
  readonly depth: number;
  readonly clear: { readonly across: readonly [number, number]; readonly head: number };
}

export type PlanPoint3 = readonly [number, number, number];

/** Slide size is fixed and the camera distance derived, so every station lands on the same pixels. */
export const SLIDE = {
  height: 2.9,
  y: 1.83,
} as const;

export const SHOT = { fov: 52, fill: 0.86 } as const;

const DEGREES = Math.PI / 180;
const HALF_V = Math.tan((SHOT.fov / 2) * DEGREES);
const HALF_FRAME = HALF_V * (STAGE.width / STAGE.height);

const SLIDE_WIDTH = (SLIDE.height * 16) / 9;

export const SHOT_DISTANCE = SLIDE_WIDTH / (2 * SHOT.fill * HALF_FRAME);

export const EYE = SECTION.floor + 1.58;

/** Where the projected quad lands on screen, as fractions of the stage rather than pixels. */
export const SLIDE_RECT = (() => {
  const halfHeight = SLIDE.height / 2 / SHOT_DISTANCE / HALF_V;
  const centreY = (SLIDE.y - EYE) / SHOT_DISTANCE / HALF_V;
  return {
    left: (1 - SHOT.fill) / 2,
    top: (1 - (centreY + halfHeight)) / 2,
    width: SHOT.fill,
    height: halfHeight,
  };
})();

/** Clear band on a room wall, between the bronze reveal and the lit trough. */
const CLEAR = { foot: SECTION.floor + 0.19, headroom: 0.78 } as const;

const roomHead = SECTION.floor + SECTION.roomHeight - CLEAR.headroom;

const along = (stationZ: number): number => -stationZ;

const wallScreen = (
  key: string,
  x: number,
  stationZ: number,
  inset: number,
  depth: number,
): Screen => {
  const half = ROOM.length / 2 - inset;
  return {
    key,
    centre: [x, SLIDE.y, along(stationZ)],
    normal: [x < 0 ? 1 : -1, 0, 0],
    width: SLIDE_WIDTH,
    height: SLIDE.height,
    ceiling: SECTION.floor + SECTION.roomHeight,
    depth,
    clear: { across: [along(stationZ + half), along(stationZ - half)], head: roomHead },
  };
};

const TERMINAL_DROP = 1.5;

const terminalScreen = (): Screen => ({
  key: 'C5',
  centre: [0, SLIDE.y, along(RUN)],
  normal: [0, 0, 1],
  width: SLIDE_WIDTH,
  height: SLIDE.height,
  ceiling: SECTION.floor + SECTION.terminalHeight,
  depth: ROOM.length,
  clear: {
    across: [-ROOM.width / 2, ROOM.width / 2],
    head: SECTION.floor + SECTION.terminalHeight - TERMINAL_DROP,
  },
});

export const SCREENS: readonly Screen[] = [
  wallScreen('C1', wingWall(-1), (STATIONS[0] as Station).z, WING.return, WING.depth + ROOM.width),
  wallScreen('C2', wingWall(1), (STATIONS[1] as Station).z, WING.return, WING.depth + ROOM.width),
  wallScreen('C3', laneAt('high') - HALF_WIDTH, (STATIONS[2] as Station).z, 0, ROOM.width),
  wallScreen('C4', laneAt('low') + HALF_WIDTH, (STATIONS[3] as Station).z, 0, ROOM.width),
  terminalScreen(),
];

/** Square-on and level: aiming up at the slide would keystone the wall it is thrown on. */
export const shotAt = (
  index: number,
): { position: PlanPoint3; target: PlanPoint3; via: PlanPoint3 } => {
  const screen = SCREENS[index];
  if (!screen) throw new Error(`Corridor: no screen at station ${index}.`);

  const [sx, , sz] = screen.centre;
  const [nx, , nz] = screen.normal;
  const position: PlanPoint3 = [sx + nx * SHOT_DISTANCE, EYE, sz + nz * SHOT_DISTANCE];

  const via: PlanPoint3 = nz !== 0 ? position : [0, EYE, sz];

  return { position, target: [sx, EYE, sz], via };
};

function assertOnWall(screens: readonly Screen[]): void {
  for (const screen of screens) {
    const top = screen.centre[1] + screen.height / 2;
    const foot = screen.centre[1] - screen.height / 2;
    if (foot < CLEAR.foot || top > screen.clear.head) {
      throw new Error(
        `Corridor: screen ${screen.key} spans ${foot.toFixed(2)}..${top.toFixed(2)} m high, ` +
          `outside the clear band ${CLEAR.foot.toFixed(2)}..${screen.clear.head.toFixed(2)} m.`,
      );
    }

    const axis = Math.abs(screen.normal[0]) > 0.5 ? 2 : 0;
    const [low, high] = screen.clear.across;
    const near = (screen.centre[axis] as number) - screen.width / 2;
    const far = (screen.centre[axis] as number) + screen.width / 2;
    if (near < Math.min(low, high) || far > Math.max(low, high)) {
      throw new Error(
        `Corridor: screen ${screen.key} runs ${near.toFixed(2)}..${far.toFixed(2)} along a ` +
          `wall clear only over ${Math.min(low, high).toFixed(2)}..${Math.max(low, high).toFixed(2)}.`,
      );
    }
  }
}

function assertPairedWithStations(screens: readonly Screen[]): void {
  const stations = STATIONS.map((station) => station.key).join(',');
  const keys = screens.map((screen) => screen.key).join(',');
  if (stations !== keys) {
    throw new Error(`Corridor: screens [${keys}] do not match stations [${stations}].`);
  }
}

function assertStandingRoom(screens: readonly Screen[]): void {
  const clearance = 0.4;
  for (const screen of screens) {
    if (SHOT_DISTANCE + clearance > screen.depth) {
      throw new Error(
        `Corridor: ${screen.key} is composed from ${SHOT_DISTANCE.toFixed(2)} m off its wall, ` +
          `but only ${screen.depth.toFixed(2)} m of room stands behind that point. ` +
          `Raise SHOT.fill, narrow SHOT.fov, or shrink SLIDE.height.`,
      );
    }
  }
}

assertOnWall(SCREENS);
assertPairedWithStations(SCREENS);
assertStandingRoom(SCREENS);
