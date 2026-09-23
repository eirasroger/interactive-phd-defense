import gsap from 'gsap';
import { createCaption } from '@/components/Caption';
import { createStanding, type Standing } from '@/components/figures/Standing';
import { STANDING } from '@/content/act3';
import type { SceneContext, SceneInstance } from '@/engine/scene/types';
import { el } from '@/utilities/dom';

/**
 * Scene 31, the closing frame: what the work establishes, what it is useful
 * for, and its limits, as three bands on one surface.
 *
 * The heading stays fixed. All three bands are laid out on entry, and each
 * beat highlights the next one, so nothing reflows.
 */
export class DiscussionScene implements SceneInstance {
  readonly beats = 3;

  private figure: Standing | null = null;
  private motion: gsap.core.Timeline | null = null;

  enter(context: SceneContext): void {
    context.root.dataset['align'] = 'theme';

    const caption = createCaption({
      eyebrow: STANDING.eyebrow,
      heading: STANDING.heading,
      accent: 'ai',
    });

    const figure = createStanding();
    this.figure = figure;

    context.root.appendChild(
      el('div', { className: 'theme', children: [caption.element, figure.element] }),
    );

    const entry = gsap.timeline({ delay: context.entryDelay + 0.15 });
    entry.add(caption.reveal(), 0);
    entry.add(figure.reveal(0, false), 0.35);
    this.motion = entry;
  }

  /**
   * Also called for beat 0 when stepping back. The figure writes its full
   * state each beat, so every navigation path ends in the same frame.
   */
  beat(index: number, settle: boolean): void {
    const figure = this.figure;
    if (!figure) return;
    this.swap(figure.reveal(index, settle));
  }

  exit(): void {
    this.settle();
    this.figure = null;
  }

  /**
   * Jumps the current timeline to its end, then kills it. A bare `kill()`
   * would leave unstarted `from` tweens stuck at their start values.
   */
  private settle(): void {
    this.motion?.progress(1).kill();
    this.motion = null;
  }

  private swap(next: gsap.core.Timeline): void {
    this.settle();
    this.motion = next;
  }
}
