import type { Vec3 } from '@/engine/camera/types';
import { DEMO_LAYOUT } from './layout';

/**
 * Corridor geometry, derived from the Blender study in
 * `tools/blender/corridor_blockout.py`.
 *
 * The blockout settled the proportions; SCALE brings them into the web world's
 * existing scale and fog range without altering them. Geometry and camera poses
 * both read these constants, so the two cannot drift apart — which is the whole
 * reason the shell is generated here rather than imported as a GLB.
 *
 * Blender is Z-up and runs the corridor along -Y; here it runs along -Z.
 */
const SCALE = 0.5;

export const CORRIDOR = {
  width: 14 * SCALE,
  height: 9 * SCALE,
  post: 0.55 * SCALE,
  /** Distance between stations. */
  gap: 26 * SCALE,
  /** Distance from the corridor origin to the first station. */
  approach: 40 * SCALE,
  eyeHeight: 2.5 * SCALE,
  runUp: 30 * SCALE,
  runOff: 45 * SCALE,
  stationCount: 5,
} as const;

export const STATION_IDS = ['C1', 'C2', 'C3', 'C4', 'C5'] as const;

/** Station position in corridor-local space. */
export const stationZ = (index: number): number =>
  -(CORRIDOR.approach + CORRIDOR.gap * index);

/** Station position in world space, for camera poses. */
export const worldStationZ = (index: number): number =>
  DEMO_LAYOUT.corridor[2] + stationZ(index);

const lastStation = stationZ(CORRIDOR.stationCount - 1);

export const FLOOR = {
  // Wide enough that its edges leave the frame: a narrow slab reads as a
  // runway floating in black rather than as ground.
  width: CORRIDOR.width + 44 * SCALE,
  near: CORRIDOR.runUp,
  far: lastStation - CORRIDOR.runOff,
} as const;

/** Camera offset left of the corridor axis, so the text column stays clear. */
const OFF_AXIS = -1.4;

/**
 * The camera stands inside the corridor, one bay short of its station, looking
 * down the run.
 *
 * Poses are generated from the same constants as the geometry, so the walk is
 * a consequence of the layout rather than five hand-tuned positions that drift
 * the moment a station moves. Station 0 sits back in the approach, outside the
 * first portal: the talk arrives at the corridor before entering it.
 */
export const stationPose = (index: number) => ({
  position: [
    OFF_AXIS,
    CORRIDOR.eyeHeight,
    worldStationZ(index) + (index === 0 ? 9 : CORRIDOR.gap * 0.42),
  ] as Vec3,
  target: [OFF_AXIS, CORRIDOR.eyeHeight * 0.94, worldStationZ(index) - CORRIDOR.gap * 2.4] as Vec3,
  fov: 52,
  arc: index === 0 ? 2 : 0.4,
});
