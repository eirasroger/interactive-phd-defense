import { createCaption, type CaptionContent } from '@/components/Caption';
import type { SceneContext, SceneInstance } from '@/engine/scene/types';

/**
 * A text composition and a camera pose, and nothing else.
 *
 * It builds no 3D content at all, because the argument is carried by the world
 * it is placed in: the zone holds the geometry, world state resolves how
 * specified it is, and the scene contributes the words and the place to stand.
 * That is what nine scenes looking at one building should cost.
 *
 * **Used at both ends of the deck.** The title card that opens Act I and the one
 * that closes Act III are the same composition in two places, which is the whole
 * point of the closing card, so it is the same class with a different pose
 * rather than a second implementation of a caption.
 */
export class ExteriorScene implements SceneInstance {
  constructor(private readonly content: CaptionContent) {}

  enter(context: SceneContext): void {
    // Drives the legibility scrim: a centred composition needs a radial scrim,
    // not the side gradient a left-aligned column is anchored against.
    context.root.dataset['align'] = this.content.align ?? 'start';

    const caption = createCaption(this.content);
    context.root.appendChild(caption.element);
    caption.reveal(context.entryDelay + 0.15);
  }
}
