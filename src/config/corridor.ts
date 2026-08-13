import plan from './corridorPlan.json';

const SCALE = plan.metresPerUnit;

export const metres = (units: number): number => units * SCALE;

const stationAt = (column: number): number =>
  metres((plan.columnX[column] ?? 0) + plan.box.width / 2) + plan.lead;

const laneAt = (lane: keyof typeof plan.laneY): number =>
  metres(plan.laneY[lane] - plan.laneY.axis);

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

export const RUN = terminal.z + plan.terminal.depth / 2 + plan.tail;

export const SECTION = plan.section;
export const BAY = plan.bay;
export const TERMINAL = plan.terminal;

export const PLAN_ASPECT = RUN / (laneAt('low') - laneAt('high') + BAY.depth * 2);
