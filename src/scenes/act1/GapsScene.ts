import gsap from 'gsap';
import { DURATION, EASE, STAGGER, seconds } from '@/animations/timing';
import { createGapCards, type GapCards } from '@/components/figures/GapCards';
import { GAPS } from '@/content/gaps';
import type { SceneContext, SceneInstance } from '@/engine/scene/types';
import { el } from '@/utilities/dom';

/**
 * Scene 9: the six research gaps. One beat per gap. The click after the last
 * gap moves on to the objectives.
 */
const BEATS = GAPS.cards.items.length;

export class GapsScene implements SceneInstance {
  readonly beats = BEATS;

  private cards: GapCards | null = null;
  /** Elements the entry timeline animates, reset if the entry is killed. */
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

    // Measure line breaks now that layout exists, and again once webfonts load
    // (unless the scene has already exited).
    cards.measure();
    if (document.fonts.status !== 'loaded') {
      void document.fonts.ready.then(() => {
        if (!context.signal.aborted) cards.measure();
      });
    }

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
      // 45ms stagger in reading order, so the six cards arrive together as one
      // group in about a quarter of a second.
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

    // Beat 0 runs right after `enter` and kills the entry timeline while its
    // `from` tweens are still hidden, so reset the head to visible.
    this.motion?.kill();
    gsap.set(this.head, { opacity: 1, y: 0 });

    this.motion = gsap.timeline().add(cards.show(index, settle), 0);
  }
}
