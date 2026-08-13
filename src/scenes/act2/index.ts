import { ROOM, SECTION, STATIONS } from '@/config/corridor';
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
 * One slide per contribution, one pose per contribution.
 *
 * The camera moves when the *subject* changes and at no other time. Re-framing
 * between beats of one claim reads as the room being toured rather than the
 * argument being made, and a presenter mid-sentence has no use for a camera
 * that has decided to look somewhere else.
 *
 * Poses are authored in corridor coordinates: the mouth is z 0 and a station
 * `z` metres in sits at `-z`.
 */
const station = (index: number): CameraPose => {
  const entry = STATIONS[index];
  const z = -(entry?.z ?? 0);
  const x = entry?.x ?? 0;

  // The two rooms of the cross are entered sideways from the low spine between
  // them, so they are framed across the axis rather than along it.
  if (x !== 0) {
    return {
      position: at([-Math.sign(x) * 1.1, EYE, z + 2.2]),
      target: at([x * 1.4, EYE - 0.16, z - 1.4]),
      fov: 58,
    };
  }

  return {
    position: at([0, EYE, z + HALF - 0.6]),
    target: at([0, EYE - 0.12, z - HALF - 2]),
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
  for (const entry of scenes) {
    const z = entry.pose.position[2] - ZONE_ORIGIN.corridor[2];
    if (z > 0 || -z > back) {
      throw new Error(`Act II: ${entry.id} stands at z ${z.toFixed(2)}, outside 0..-${back}.`);
    }
  }
}

assertDoorsClear(ENTRY_SECONDS);
assertInside(act2Scenes);
