import { createCaption, type CaptionContent } from '@/components/Caption';
import type { SceneContext, SceneInstance } from '@/engine/scene/types';

/**
 * A camera pose with an optional caption. Builds no 3D content; the zone
 * owns the geometry. With no caption, the scene is the world alone.
 */
export class ExteriorScene implements SceneInstance {
  constructor(private readonly content: CaptionContent | null = null) {}

  enter(context: SceneContext): void {
    // No text, so no legibility veil.
    if (!this.content) {
      context.root.dataset['veil'] = 'off';
      return;
    }

    // Selects the legibility scrim: radial for centred text, side gradient for
    // left-aligned text.
    context.root.dataset['align'] = this.content.align ?? 'start';

    const caption = createCaption(this.content);
    context.root.appendChild(caption.element);
    caption.reveal(context.entryDelay + 0.15);
  }
}
