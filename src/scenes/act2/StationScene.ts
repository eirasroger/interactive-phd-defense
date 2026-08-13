import { createCaption, type CaptionContent } from '@/components/Caption';
import type { SceneContext, SceneInstance } from '@/engine/scene/types';

export class StationScene implements SceneInstance {
  constructor(private readonly content: CaptionContent) {}

  enter(context: SceneContext): void {
    context.root.dataset['align'] = 'start';

    const caption = createCaption(this.content);
    context.root.appendChild(caption.element);
    caption.reveal(context.entryDelay + 0.15);
  }
}
