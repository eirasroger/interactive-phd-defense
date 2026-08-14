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
