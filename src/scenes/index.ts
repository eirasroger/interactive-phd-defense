import { CONTENTS } from '@/content/contents';
import type { SceneDefinition } from '@/engine/scene/types';
import { act1Scenes } from './act1';
import { act2Scenes } from './act2';
import { act3Scenes } from './act3';

/**
 * Ordered scene registry, in talk order. Navigation clamps at both ends.
 *
 * `id` is the scene's permanent URL. `pose` is the camera's rest pose; the
 * director picks the path. Consecutive scenes with the same `zone` share that
 * zone's world state.
 */
export const scenes: readonly SceneDefinition[] = [
  ...act1Scenes,
  // The first Act II scene opens the building's doors and moves the camera
  // through them. See `scenes/act2/index.ts`.
  ...act2Scenes,
  // Act III must follow Act II directly: both use the corridor zone, and the
  // camera rises out of C5 to view the corridor from above.
  ...act3Scenes,
];

/**
 * Checks that every Contents part opens on an existing scene, in deck order.
 * Lives here because the contents scene importing `scenes` would be a cycle.
 */
const sceneOrder = new Map(scenes.map((scene, index) => [scene.id, index]));

let previous = -1;
for (const part of CONTENTS.parts) {
  const index = sceneOrder.get(part.from);

  if (index === undefined) {
    throw new Error(
      `Contents: part '${part.title}' opens on scene '${part.from}', which the deck does not have.`,
    );
  }

  if (index <= previous) {
    throw new Error(
      `Contents: part '${part.title}' opens on '${part.from}' at position ${index}, ` +
        `which is not after the part before it. The index must run in the deck's own order.`,
    );
  }

  previous = index;
}
