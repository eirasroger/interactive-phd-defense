import { createCaption } from '@/components/Caption';
import { act2Captions } from '@/content/act2';
import type { SceneContext, SceneInstance } from '@/engine/scene/types';

/**
 * Where the entry lands.
 *
 * A caption and a pose, like every Act I scene: the zone holds the geometry and
 * the scene contributes the words and the place to stand. It builds nothing,
 * which is the correct cost for a beat whose composition has not been designed.
 *
 * The reveal is offset by `entryDelay`, which the director derives from the
 * length of the move — nine seconds of crossing puts it near five. That is not
 * a delay to be tuned down: text appearing while the camera is still on the
 * avenue is a caption for a room the audience has not reached.
 */
export class ThresholdScene implements SceneInstance {
  enter(context: SceneContext): void {
    context.root.dataset['align'] = 'start';

    const caption = createCaption(act2Captions.threshold);
    context.root.appendChild(caption.element);
    caption.reveal(context.entryDelay + 0.15);
  }
}
