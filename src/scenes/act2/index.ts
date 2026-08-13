import { ZONE_ORIGIN } from '@/config/layout';
import { AT_THRESHOLD, DOORS_AT } from '@/animations/entry';
import { act2Captions } from '@/content/act2';
import type { Vec3 } from '@/engine/camera/types';
import type { SceneDefinition } from '@/engine/scene/types';
import { corridorZone } from '@/world/corridor/CorridorZone';
import { ENTRANCE_LEAF_STAGGER, ENTRANCE_TRAVEL_SECONDS } from '@/world/exterior/entrance';
import { THRESHOLD_Z } from '@/world/exterior/site';
import { StationScene } from './StationScene';

const CHAPTER = 'Act II — The Corridor';

const ENTRY_SECONDS = 9.0;

const at = ([x, y, z]: Vec3): Vec3 => [
  x + ZONE_ORIGIN.corridor[0],
  y + ZONE_ORIGIN.corridor[1],
  z + ZONE_ORIGIN.corridor[2],
];

export const act2Scenes: readonly SceneDefinition[] = [
  {
    id: 'c1-problem',
    title: 'Decision framework',
    chapter: CHAPTER,
    zone: corridorZone.id,
    world: 'foreground',
    pose: {
      position: at([-1.2, 1.72, -13]),
      target: at([-1.2, 1.58, -37]),
      fov: 50,
    },
    crossing: {
      seconds: ENTRY_SECONDS,
      releaseAtZ: THRESHOLD_Z + ZONE_ORIGIN.exterior[2],
    },
    create: () => new StationScene(act2Captions.c1Problem),
  },
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

assertDoorsClear(ENTRY_SECONDS);
