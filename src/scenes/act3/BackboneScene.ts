import gsap from 'gsap';
import { createBackbone } from '@/components/figures/Backbone';
import { createCaption } from '@/components/Caption';
import { BACKBONE } from '@/content/act3';
import type { SceneContext, SceneInstance } from '@/engine/scene/types';
import { el } from '@/utilities/dom';

/**
 * Scene 29 — artificial intelligence as the methodological backbone.
 *
 * The first of Act III's cross-cutting themes, and the first scene of the talk
 * with no building in it. The corridor is clearing underneath this composition
 * as it arrives: the zone owns that, driven by the same progress that opened the
 * ceiling one scene ago, so the presenter's click starts one motion rather than
 * two that have to be kept in step.
 *
 * **One beat, and nothing measured on it.** This is discussion: what the
 * connection between the stations adds, rather than a sixth telling of what each
 * one did. It is worth about half a minute, the argument is a single shape, and
 * that shape only argues while all four vertebrae are on screen together.
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
