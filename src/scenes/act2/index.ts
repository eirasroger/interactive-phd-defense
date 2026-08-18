import { CROSS, ROOM, SHOT, STATIONS, shotAt } from '@/config/corridor';
import { ZONE_ORIGIN } from '@/config/layout';
import { AT_THRESHOLD, DOORS_AT } from '@/animations/entry';
import { act2Beats, act2Captions, act2Figures } from '@/content/act2';
import type { CameraPose, Vec3 } from '@/engine/camera/types';
import type { SceneDefinition } from '@/engine/scene/types';
import { CORRIDOR_ASSETS, corridorZone } from '@/world/corridor/CorridorZone';
import { ENTRANCE_LEAF_STAGGER, ENTRANCE_TRAVEL_SECONDS } from '@/world/exterior/entrance';
import { THRESHOLD_Z } from '@/world/exterior/site';
import { panelsFor } from './panels';
import { StationScene } from './StationScene';

const CHAPTER = 'Act II — The Corridor';

const ENTRY_SECONDS = 9.0;

const HALF = ROOM.length / 2;

const at = ([x, y, z]: Vec3): Vec3 => [
  x + ZONE_ORIGIN.corridor[0],
  y + ZONE_ORIGIN.corridor[1],
  z + ZONE_ORIGIN.corridor[2],
];

const station = (index: number): CameraPose => {
  const shot = shotAt(index);
  return {
    position: at(shot.position as Vec3),
    target: at(shot.target as Vec3),
    fov: SHOT.fov,
    approach: 'lead',
    via: at(shot.via as Vec3),
  };
};

const slide = (
  id: keyof typeof act2Captions,
  title: string,
  index: number,
): SceneDefinition => ({
  id,
  title,
  chapter: CHAPTER,
  zone: corridorZone.id,
  world: 'foreground',
  pose: station(index),
  assets: [...CORRIDOR_ASSETS],
  create: () => {
    const panels = panelsFor(id);
    const captions = act2Beats[id];
    return new StationScene({
      caption: act2Captions[id],
      ...(captions ? { captions } : {}),
      ...(panels ? { panels } : {}),
      figures: act2Figures[id],
    });
  },
});

export const act2Scenes: readonly SceneDefinition[] = [
  {
    ...slide('c1', 'Decision framework', 0),
    crossing: {
      seconds: ENTRY_SECONDS,
      releaseAtZ: THRESHOLD_Z + ZONE_ORIGIN.exterior[2],
    },
  },
  slide('c2', 'Empirical characterisation', 1),
  slide('c3', 'Screening agent', 2),
  slide('c4', 'Inference', 3),
  slide('c5', 'Context-adaptive recommender', 4),
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

function assertInside(scenes: readonly SceneDefinition[]): void {
  const back = (STATIONS[4]?.z ?? 0) + HALF;
  for (const entry of scenes) {
    const z = entry.pose.position[2] - ZONE_ORIGIN.corridor[2];
    const x = entry.pose.position[0] - ZONE_ORIGIN.corridor[0];
    if (z > 0 || -z > back) {
      throw new Error(`Act II: ${entry.id} stands at z ${z.toFixed(2)}, outside 0..-${back}.`);
    }
    if (Math.abs(x) > CROSS) {
      throw new Error(`Act II: ${entry.id} stands at x ${x.toFixed(2)}, outside ±${CROSS}.`);
    }
  }
}

assertDoorsClear(ENTRY_SECONDS);
assertInside(act2Scenes);
