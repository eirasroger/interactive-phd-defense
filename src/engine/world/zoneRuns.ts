import type { SceneDefinition } from '@/engine/scene/types';

/**
 * How far through its zone each scene sits, 0 to 1.
 *
 * Zone progress is derived from the deck's own order rather than declared per
 * scene, so inserting or reordering scenes redistributes the world state it
 * drives — a building's specification, a corridor's fold — without any scene
 * carrying a hand-tuned number that would silently go stale.
 *
 * Runs are contiguous: a zone revisited later in the deck is a separate run,
 * which is what makes returning to a zone start it over rather than resume it.
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
 * Every zone the deck names, with the union of the assets its scenes declare.
 *
 * Insertion-ordered, so preparation happens in the order the talk will need
 * them and a deck interrupted mid-preparation is still ready for its opening.
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
