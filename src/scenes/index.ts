import { CONTENTS } from '@/content/contents';
import type { SceneDefinition } from '@/engine/scene/types';
import { act1Scenes } from './act1';
import { act2Scenes } from './act2';
import { act3Scenes } from './act3';

/**
 * Ordered scene registry — the order here is the order of the talk.
 *
 * `id` is the scene's permanent URL and should not change once shared. `pose`
 * is where the camera comes to rest; the director decides how to travel there.
 * `zone` names the built world the scene is looking at, and consecutive scenes
 * sharing a zone form the run that its world state is distributed across.
 *
 * **Three acts and nothing after them.** The engine demos that used to sit past
 * Act III are gone: every zone they were scaffolding for is built, and their
 * corridor stations carried the ids `c1` through `c5`, so stepping forward from
 * the closing title card walked into a second corridor that looked like the
 * talk starting again. The deck ends where the talk ends, and navigation clamps
 * at both ends rather than wrapping.
 */
export const scenes: readonly SceneDefinition[] = [
  ...act1Scenes,
  // The act boundary is a designed crossing rather than a cut: the first Act II
  // scene declares it, and entering it opens the building's doors and carries
  // the camera through them in one move. See `scenes/act2/index.ts`.
  ...act2Scenes,
  // Act III opens where Act II ends and in the same zone: the camera climbs out
  // of C5 and reads the corridor from above as the figure it has been all along.
  // Contiguous with Act II by necessity — the two share the corridor's scene run,
  // and the ceiling opens on the last of it.
  ...act3Scenes,
];

/**
 * The index slide names six parts of the talk and the scene each one opens on,
 * and this is what keeps it honest.
 *
 * An agenda is the one composition in the deck that makes a claim about every
 * other composition, so it is also the one that goes stale silently: reorder the
 * acts, rename a scene, drop a section, and the index keeps reading perfectly
 * while describing a talk that no longer exists. Asserted here rather than in
 * the scene, because this module is where the whole deck is known and the scene
 * importing it would close a cycle.
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
