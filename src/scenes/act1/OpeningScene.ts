import { createCaption, type CaptionContent } from '@/components/Caption';
import type { SceneContext, SceneInstance } from '@/engine/scene/types';

/**
 * Title card inside the cloud. Same layout as `ExteriorScene`, styled for a
 * light background (dark ink, no scrim, no halo).
 *
 * The cloud itself belongs to `ExteriorZone`, so it is restored when the
 * presenter navigates back here.
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
