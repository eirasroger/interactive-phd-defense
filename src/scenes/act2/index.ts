import { ROOM, SECTION, SPINE, STATIONS, WING } from '@/config/corridor';
import { ZONE_ORIGIN } from '@/config/layout';
import { AT_THRESHOLD, DOORS_AT } from '@/animations/entry';
import { act2Captions } from '@/content/act2';
import type { CameraPose, Vec3 } from '@/engine/camera/types';
import type { SceneDefinition } from '@/engine/scene/types';
import { CORRIDOR_ASSETS, corridorZone } from '@/world/corridor/CorridorZone';
import { ENTRANCE_LEAF_STAGGER, ENTRANCE_TRAVEL_SECONDS } from '@/world/exterior/entrance';
import { THRESHOLD_Z } from '@/world/exterior/site';
import { StationScene } from './StationScene';

const CHAPTER = 'Act II — The Corridor';

const ENTRY_SECONDS = 9.0;

const EYE = SECTION.floor + 1.58;
const HALF = ROOM.length / 2;

const at = ([x, y, z]: Vec3): Vec3 => [
  x + ZONE_ORIGIN.corridor[0],
  y + ZONE_ORIGIN.corridor[1],
  z + ZONE_ORIGIN.corridor[2],
];

/**
 * One pose per contribution, authored in corridor coordinates: the mouth is
 * z 0 and a station `z` metres in sits at `-z`.
 *
 * Poses stand on the axis and only the aim varies, so travel between stations
 * cannot clip a link wall.
 */
const station = (index: number): CameraPose => {
  const entry = STATIONS[index];
  const z = -(entry?.z ?? 0);
  const x = entry?.x ?? 0;
  const wing = entry?.wing ?? 0;

  if (x !== 0) {
    return {
      position: at([0, EYE, z + HALF - 2.0]),
      target: at([x * 1.02, EYE - 0.12, z - 0.6]),
      fov: 60,
    };
  }

  if (wing !== 0) {
    return {
      position: at([0, EYE, z + HALF - 1.0]),
      target: at([wing * 2.2, EYE - 0.14, z - HALF * 0.5]),
      fov: 54,
    };
  }

  return {
    position: at([0, EYE, z + HALF - 1.2]),
    target: at([0, EYE + 0.35, z - HALF - 2]),
    fov: 54,
  };
};

const slide = (
  id: string,
  title: string,
  index: number,
  caption: (typeof act2Captions)[keyof typeof act2Captions],
): SceneDefinition => ({
  id,
  title,
  chapter: CHAPTER,
  zone: corridorZone.id,
  world: 'foreground',
  pose: station(index),
  assets: [...CORRIDOR_ASSETS],
  create: () => new StationScene(caption),
});

export const act2Scenes: readonly SceneDefinition[] = [
  {
    ...slide('c1', 'Decision framework', 0, act2Captions.c1),
    crossing: {
      seconds: ENTRY_SECONDS,
      releaseAtZ: THRESHOLD_Z + ZONE_ORIGIN.exterior[2],
    },
  },
  slide('c2', 'Empirical characterisation', 1, act2Captions.c2),
  slide('c3', 'Screening agent', 2, act2Captions.c3),
  slide('c4', 'Inference', 3, act2Captions.c4),
  slide('c5', 'Context-adaptive recommender', 4, act2Captions.c5),
];

function assertDoorsClear(seconds: number): void {
  const clear = DOORS_AT * seconds + ENTRANCE_TRAVEL_SECONDS + ENTRANCE_LEAF_STAGGER;
  const arrival = AT_THRESHOLD * seconds;
  if (clear >= arrival) {
    throw new Error(
      `Act II: the doors finish at ${clear.toFixed(2)}s but the camera reaches them at ` +
        `${arrival.toFixed(2)}s. Lengthen the crossing, shorten ENTRANCE_TRAVEL_SECONDS, ` +
        `or lower DOORS_AT.`,
    );
  }
}

/** Every pose has to stand inside the shell, not in the wall behind it. */
function assertInside(scenes: readonly SceneDefinition[]): void {
  const back = (STATIONS[4]?.z ?? 0) + HALF;
  for (const [index, entry] of scenes.entries()) {
    const home = STATIONS[index];
    const z = entry.pose.position[2] - ZONE_ORIGIN.corridor[2];
    const x = entry.pose.position[0] - ZONE_ORIGIN.corridor[0];
    if (z > 0 || -z > back) {
      throw new Error(`Act II: ${entry.id} stands at z ${z.toFixed(2)}, outside 0..-${back}.`);
    }
    const reach = home && home.x !== 0 ? SPINE : ROOM.width / 2 + WING.depth;
    if (Math.abs(x) > reach) {
      throw new Error(`Act II: ${entry.id} stands at x ${x.toFixed(2)}, outside ±${reach}.`);
    }
  }
}

assertDoorsClear(ENTRY_SECONDS);
assertInside(act2Scenes);
