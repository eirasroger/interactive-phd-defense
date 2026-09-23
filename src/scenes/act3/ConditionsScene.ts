import gsap from 'gsap';
import { createCaption } from '@/components/Caption';
import { createConditions, type Conditions } from '@/components/figures/Conditions';
import { CONDITIONS } from '@/content/act3';
import type { SceneContext, SceneInstance } from '@/engine/scene/types';
import { el } from '@/utilities/dom';

/**
 * Scene 30: the two conditions the architecture is designed around (missing
 * evidence and context sensitivity). Act III's second cross-cutting theme.
 * Two beats; only the second card changes between them.
 */
export class ConditionsScene implements SceneInstance {
  readonly beats = 2;

  private figure: Conditions | null = null;
  private motion: gsap.core.Timeline | null = null;

  enter(context: SceneContext): void {
    context.root.dataset['align'] = 'theme';

    const caption = createCaption({
      eyebrow: CONDITIONS.eyebrow,
      heading: CONDITIONS.heading,
      body: [CONDITIONS.line],
      accent: 'ai',
    });

    const figure = createConditions();
    this.figure = figure;

    context.root.appendChild(
      el('div', { className: 'theme', children: [caption.element, figure.element] }),
    );

    const entry = gsap.timeline({ delay: context.entryDelay + 0.15 });
    entry.add(caption.reveal(), 0);
    entry.add(figure.open(false), 0.35);
    this.motion = entry;
  }

  /**
   * Also called for beat 0 when stepping back, so each branch sets its full
   * state.
   */
  beat(index: number, settle: boolean): void {
    const figure = this.figure;
    if (!figure) return;
    this.swap(index >= 1 ? figure.apply(settle) : figure.open(settle));
  }

  exit(): void {
    this.settle();
    this.figure = null;
  }

  /**
   * Jumps the current timeline to its end before killing it. A bare `kill()`
   * would leave unplayed `from` tweens stuck at their start values.
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
