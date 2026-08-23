import gsap from 'gsap';
import { createCaption, type CaptionContent } from '@/components/Caption';
import type { SceneContext, SceneInstance } from '@/engine/scene/types';
import { el } from '@/utilities/dom';

/**
 * A cross-cutting theme with nothing built for it yet.
 *
 * Placeholder, and deliberately only a caption: what it exists for is the
 * crossing into it, which is a camera move through the sea and belongs to the
 * deck rather than to whatever composition eventually lands here. When the theme
 * is designed this class is replaced, and the move it arrives on is unaffected.
 */
export class ThemeScene implements SceneInstance {
  private motion: gsap.core.Timeline | null = null;

  constructor(private readonly content: CaptionContent) {}

  enter(context: SceneContext): void {
    context.root.dataset['align'] = 'theme';

    const caption = createCaption(this.content);
    context.root.appendChild(el('div', { className: 'theme', children: [caption.element] }));

    this.motion = gsap.timeline().add(caption.reveal(context.entryDelay + 0.15));
  }

  exit(): void {
    this.motion?.kill();
    this.motion = null;
  }
}
