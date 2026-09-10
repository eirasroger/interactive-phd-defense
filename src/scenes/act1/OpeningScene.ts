import { createCaption, type CaptionContent } from '@/components/Caption';
import type { SceneContext, SceneInstance } from '@/engine/scene/types';

/**
 * The title card, seen from inside the cloud.
 *
 * The same composition `ExteriorScene` carries and deliberately not the same
 * class: everything that differs between the two is a consequence of the ground
 * being light rather than dark, and that is a whole register — dark ink, no
 * scrim, no halo — rather than a variant of one.
 *
 * It builds nothing. The cloud belongs to `ExteriorZone`, because a presenter
 * jumping back here during questions has to find it closed again, and world
 * state that survives being navigated away from is zone state by definition.
 */
export class OpeningScene implements SceneInstance {
  constructor(private readonly content: CaptionContent) {}

  enter(context: SceneContext): void {
    context.root.dataset['align'] = 'opening';

    const caption = createCaption(this.content);
    context.root.appendChild(caption.element);
    caption.reveal(context.entryDelay + 0.15);
  }
}
