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
