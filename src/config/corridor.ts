import plan from './corridorPlan.json';

const SCALE = plan.metresPerUnit;

export const metres = (units: number): number => units * SCALE;

const stationAt = (column: number): number =>
  metres((plan.columnX[column] ?? 0) + plan.box.width / 2) + plan.lead;

const laneAt = (lane: keyof typeof plan.laneY): number =>
  metres(plan.laneY[lane] - plan.laneY.axis);

/**
 * A station is the figure's box, extruded.
 *
 * `box` is 300 x 140 plan units, which at this scale is 11.1 m along the axis
 * by 5.18 m across it, and the column pitch of 400 units leaves exactly 3.7 m
 * between one box and the next. The corridor is therefore an enfilade the
 * figure already drew: rooms on the columns, links in the gaps.
 */
export const ROOM = {
  length: metres(plan.box.width),
  width: metres(plan.box.height),
} as const;

export interface Station {
  readonly key: string;
  readonly z: number;
  readonly x: number;
}

export const STATIONS: readonly Station[] = [
  { key: 'C1', z: stationAt(0), x: 0 },
  { key: 'C2', z: stationAt(1), x: 0 },
  { key: 'C3', z: stationAt(2), x: laneAt('high') },
  { key: 'C4', z: stationAt(2), x: laneAt('low') },
  { key: 'C5', z: stationAt(3), x: 0 },
];

const terminal = STATIONS[4] as Station;

/** The back wall of the last room. There is nothing beyond it. */
export const RUN = terminal.z + ROOM.length / 2;

/** Half the widest moment: C3 and C4 face each other across the axis. */
export const CROSS = Math.abs(laneAt('low')) + ROOM.width / 2;

export const SECTION = plan.section;
export const GARDEN = plan.garden;
export const FLOW = plan.flow;

export const PLAN_ASPECT = RUN / (CROSS * 2);
