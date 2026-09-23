import type { SceneDefinition } from '@/engine/scene/types';

/**
 * Each scene's progress through its zone, 0 to 1, derived from deck order so
 * reordering scenes needs no manual values. A zone revisited later is a new
 * run and starts again from 0.
 */
export function zoneProgressByIndex(scenes: readonly SceneDefinition[]): readonly number[] {
  const progress = new Array<number>(scenes.length).fill(0);

  let start = 0;
  while (start < scenes.length) {
    const zone = scenes[start]?.zone;
    let end = start + 1;
    while (end < scenes.length && scenes[end]?.zone === zone) end += 1;

    const span = end - start - 1;
    for (let i = start; i < end; i += 1) {
      progress[i] = span === 0 ? 1 : (i - start) / span;
    }

    start = end;
  }

  return progress;
}

/**
 * Each zone mapped to the union of its scenes' assets. Keeps deck order, so
 * assets are prepared in the order the talk needs them.
 */
export function assetsByZone(
  scenes: readonly SceneDefinition[],
): ReadonlyMap<string, ReadonlySet<string>> {
  const zones = new Map<string, Set<string>>();

  for (const scene of scenes) {
    const assets = zones.get(scene.zone) ?? new Set<string>();
    for (const id of scene.assets ?? []) assets.add(id);
    zones.set(scene.zone, assets);
  }

  return zones;
}
