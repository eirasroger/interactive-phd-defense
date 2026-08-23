import gsap from 'gsap';
import { createCaption } from '@/components/Caption';
import { createStanding } from '@/components/figures/Standing';
import { STANDING } from '@/content/act3';
import type { SceneContext, SceneInstance } from '@/engine/scene/types';
import { el } from '@/utilities/dom';

/**
 * Scene 31 — the closing frame.
 *
 * What the work contributes, what it is for, and where it stops. Three zones on
 * one slide because the three are read against each other, and one beat because
 * they only argue together: a contribution held up on its own invites the
 * limitation as an interruption rather than as the next thing said.
 *
 * **Skeleton.** The zones carry placeholder lines. Nothing on this slide is a
 * finding yet, and none of it should be defended until it is written: a line on
 * this frame is a claim about the work, and an invented one reads as a result.
 */
export class StandingScene implements SceneInstance {
  private motion: gsap.core.Timeline | null = null;

  enter(context: SceneContext): void {
    context.root.dataset['align'] = 'theme';

    const caption = createCaption({
      eyebrow: STANDING.eyebrow,
      heading: STANDING.heading,
      body: [STANDING.line],
      accent: 'ai',
    });

    const figure = createStanding();

    context.root.appendChild(
      el('div', { className: 'theme', children: [caption.element, figure.element] }),
    );

    const entry = gsap.timeline({ delay: context.entryDelay + 0.15 });
    entry.add(caption.reveal(), 0);
    entry.add(figure.open(false), 0.35);
    this.motion = entry;
  }

  exit(): void {
    this.settle();
  }

  /**
   * The outgoing timeline is finished, never abandoned.
   *
   * `kill()` drops every tween where it stands and leaves its target at that
   * value, so a `from` that had not run yet strands its element on the start
   * value it was never meant to rest on.
   */
  private settle(): void {
    this.motion?.progress(1).kill();
    this.motion = null;
  }
}
