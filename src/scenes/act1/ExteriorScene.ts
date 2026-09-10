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
 * **Used with a caption and without one.** The card that closes Act III is a
 * composition; the establishing shot that opens Act I is the world alone, and a
 * scene that contributes only a pose is exactly what this class already was.
 */
export class ExteriorScene implements SceneInstance {
  constructor(private readonly content: CaptionContent | null = null) {}

  enter(context: SceneContext): void {
    // A beat with nothing laid over it: the world is the whole composition, so
    // the veil that exists to hold text off an unpredictable background is
    // dimming the only thing being looked at.
    if (!this.content) {
      context.root.dataset['veil'] = 'off';
      return;
    }

    // Drives the legibility scrim: a centred composition needs a radial scrim,
    // not the side gradient a left-aligned column is anchored against.
    context.root.dataset['align'] = this.content.align ?? 'start';

    const caption = createCaption(this.content);
    context.root.appendChild(caption.element);
    caption.reveal(context.entryDelay + 0.15);
  }
}
