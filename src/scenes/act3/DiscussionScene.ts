import gsap from 'gsap';
import { createCaption } from '@/components/Caption';
import { createStanding, type Standing } from '@/components/figures/Standing';
import { STANDING } from '@/content/act3';
import type { SceneContext, SceneInstance } from '@/engine/scene/types';
import { el } from '@/utilities/dom';

/**
 * Scene 31 — the closing frame.
 *
 * What the work establishes, what it is good for, and where it stops. Three
 * bands on one surface, and the three are read against each other: a
 * contribution with no stated limit is a claim, and a limit with no stated
 * contribution is an apology.
 *
 * **Three beats, and the title does not move between them.** The heading is the
 * chapter title behind this frame and it is true of all three bands, so it is
 * set once and left alone. What advances is the light: each click brings a band
 * up out of the surface it has been standing on since the scene was entered.
 * Retitling on a beat would say three slides, which is the one thing this frame
 * is not.
 *
 * **The frame is composed whole before the first beat.** The bands and their
 * names are on the surface from the moment the camera settles, so nothing
 * reflows, nothing is assembled in front of the committee, and the presenter is
 * filling a shape the audience can already see the whole of.
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
   * `SceneDirector` calls this for beat 0 as well, on the way back.
   *
   * The figure writes its whole state on every beat rather than the difference
   * from the beat before it, so stepping backwards, jumping in from the deck and
   * walking forwards all land on the same frame.
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
   * The outgoing timeline is finished, never abandoned.
   *
   * `kill()` drops every tween where it stands and leaves its target at that
   * value, so a `from` that had not run yet strands its element at the start
   * value it was never meant to rest on. `progress(1)` writes the end state
   * first and the kill is then only releasing the tween.
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
