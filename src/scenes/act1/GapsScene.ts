import gsap from 'gsap';
import { DURATION, EASE, STAGGER, seconds } from '@/animations/timing';
import { createGapCards, type GapCards } from '@/components/figures/GapCards';
import { GAPS } from '@/content/gaps';
import type { SceneContext, SceneInstance } from '@/engine/scene/types';
import { el } from '@/utilities/dom';

/**
 * Scene 9 — the six research gaps.
 *
 * One beat per gap, and a seventh that releases the accent.
 *
 * **The seventh is not padding.** Without it the scene rests on card 06 lit and
 * the other five neutral, which is the frame that stays up longest — through the
 * pause, and through anything the room reacts to — and it says the sixth gap
 * matters most. On the last beat the accent lets go and the six stand equal,
 * which is also the state the objectives scene regroups from.
 */
const BEATS = GAPS.cards.items.length + 1;

export class GapsScene implements SceneInstance {
  readonly beats = BEATS;

  private cards: GapCards | null = null;
  /** Everything the entry timeline animates, so a killed entry can be settled. */
  private head: HTMLElement[] = [];

  private motion: gsap.core.Timeline | null = null;

  enter(context: SceneContext): void {
    context.root.dataset['align'] = 'wide';

    const eyebrow = el('p', { className: 'gaps-eyebrow', text: GAPS.eyebrow });
    const heading = el('h2', { className: 'gaps-heading', text: GAPS.heading });
    const headBlock = el('div', { className: 'gaps-head', children: [eyebrow, heading] });

    const cards = createGapCards(GAPS.cards);
    this.cards = cards;
    this.head = [eyebrow, heading, ...cards.frames];

    context.root.appendChild(
      el('div', { className: 'gaps-composition', children: [headBlock, cards.element] }),
    );

    cards.show(-1, true);

    const entry = gsap.timeline({ delay: context.entryDelay + 0.15 });
    entry
      .from([eyebrow, heading], {
        y: 26,
        opacity: 0,
        duration: seconds(DURATION.slow),
        ease: EASE.enter,
        stagger: seconds(STAGGER),
      })
      // Staggered in reading order, but at 45ms — fast enough that the six
      // still land as one field rather than as six arrivals the audience counts
      // through, and slow enough that the field is built rather than switched
      // on. The whole sweep takes a quarter of a second.
      .from(
        cards.frames,
        {
          y: 26,
          opacity: 0,
          duration: seconds(DURATION.slow),
          ease: EASE.enter,
          stagger: seconds(0.045),
        },
        0.25,
      )
      .add(cards.show(0), 0.6);
    this.motion = entry;
  }

  beat(index: number, settle: boolean): void {
    const cards = this.cards;
    if (!cards) return;

    // The deck calls this for beat 0 immediately after `enter`, which kills the
    // entry timeline while its `from` tweens are still at their start values —
    // an invisible composition. Settling the head is what puts them back.
    this.motion?.kill();
    gsap.set(this.head, { opacity: 1, y: 0 });

    this.motion = gsap.timeline().add(cards.show(index, settle), 0);
  }
}
