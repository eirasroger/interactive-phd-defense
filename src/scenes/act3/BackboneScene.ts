import gsap from 'gsap';
import { createBackbone } from '@/components/figures/Backbone';
import { createCaption } from '@/components/Caption';
import { BACKBONE } from '@/content/act3';
import type { SceneContext, SceneInstance } from '@/engine/scene/types';
import { el } from '@/utilities/dom';

/**
 * Scene 29: AI as the methodological backbone. First Act III theme, single beat.
 * The zone clears the corridor behind it, driven by the same scene progress.
 */
export class BackboneScene implements SceneInstance {
  private motion: gsap.core.Timeline | null = null;

  enter(context: SceneContext): void {
    context.root.dataset['align'] = 'theme';

    const caption = createCaption({
      eyebrow: BACKBONE.eyebrow,
      heading: BACKBONE.heading,
      body: [BACKBONE.line],
      accent: 'ai',
    });

    const board = createBackbone();

    context.root.appendChild(
      el('div', { className: 'theme', children: [caption.element, board.element] }),
    );

    const entry = gsap.timeline({ delay: context.entryDelay + 0.15 });
    entry.add(caption.reveal(), 0);
    entry.add(board.play(false), 0.35);
    this.motion = entry;
  }

  exit(): void {
    this.motion?.kill();
    this.motion = null;
  }
}
