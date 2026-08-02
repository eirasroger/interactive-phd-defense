import { createCaption, type CaptionContent } from '@/components/Caption';
import type { SceneContext, SceneInstance } from '@/engine/scene/types';

/**
 * An Act I scene is a text composition and a camera pose.
 *
 * It builds no 3D content at all, because the exterior's argument is carried by
 * the building itself: the zone holds the geometry, world state resolves how
 * specified it is, and the scene contributes the words and the place to stand.
 * That is what nine scenes looking at one building should cost.
 */
export class ExteriorScene implements SceneInstance {
  constructor(private readonly content: CaptionContent) {}

  enter(context: SceneContext): void {
    // Drives the legibility scrim: a centred composition needs a radial scrim,
    // not the side gradient a left-aligned column is anchored against.
    context.root.dataset['align'] = this.content.align ?? 'start';

    const caption = createCaption(this.content);
    context.root.appendChild(caption.element);
    caption.reveal(0.15);
  }
}
