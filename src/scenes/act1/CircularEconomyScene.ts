import gsap from 'gsap';
import { createBrief, createClaims, type Card, type Claims } from '@/components/Brief';
import { createLoop, type Loop } from '@/components/figures/Loop';
import { CIRCULAR_ECONOMY } from '@/content/circularEconomy';
import type { SceneContext, SceneInstance } from '@/engine/scene/types';
import { el } from '@/utilities/dom';

const BEAT = { hierarchy: 0, practice: 1 } as const;

/** Claim indices shown on each beat. */
const CLAIM = [[0], [1, 2]] as const;

/**
 * Scene 4: circular economy in construction. Two beats; the first is the entry.
 * The loop figure is wide and short, so it spans the full card width with the
 * claims in a row beneath it.
 */
export class CircularEconomyScene implements SceneInstance {
  readonly beats = 2;

  private loop: Loop | null = null;
  private claims: Claims | null = null;
  private card: Card | null = null;
  private head: HTMLElement[] = [];

  private motion: gsap.core.Timeline | null = null;

  enter(context: SceneContext): void {
    context.root.dataset['align'] = 'brief';

    const brief = createBrief({
      eyebrow: CIRCULAR_ECONOMY.eyebrow,
      heading: CIRCULAR_ECONOMY.heading,
      accent: 'circular',
    });
    this.head = [...brief.head];

    const card = brief.addCard({ accent: 'circular' });
    this.card = card;

    const loop = createLoop(CIRCULAR_ECONOMY.loop);
    this.loop = loop;

    const claims = createClaims([...CIRCULAR_ECONOMY.claims], {
      accent: 'circular',
      flow: 'row',
    });
    this.claims = claims;

    card.body.appendChild(
      el('div', {
        className: 'brief-stack',
        children: [
          loop.element,
          el('div', { className: 'brief-section', children: [claims.element] }),
        ],
      }),
    );

    context.root.appendChild(brief.element);

    // First beat: heading, card, loop and first claim, overlapped so they finish together.
    const entry = gsap.timeline({ delay: context.entryDelay + 0.15 });
    entry
      .add(brief.revealHead(), 0)
      .add(card.reveal(), 0.3)
      .add(loop.close(), 0.5)
      .add(claims.show(CLAIM[BEAT.hierarchy]), 0.45);
    this.motion = entry;
  }

  /**
   * Sets the full state of the beat, since beats can be reached in any order.
   * The previous timeline is completed before killing it: `Loop.close` uses
   * `from` tweens, which leave targets invisible if killed part-way.
   */
  beat(index: number, settle: boolean): void {
    const loop = this.loop;
    const claims = this.claims;
    const card = this.card;
    if (!loop || !claims || !card) return;

    this.motion?.progress(1).kill();
    gsap.set(this.head, { opacity: 1, y: 0 });
    card.reveal(true);

    // Both beats need the closed loop, including when jumping straight to this beat.
    loop.close(true);

    const timeline = gsap.timeline();
    timeline.add(claims.show(CLAIM[Math.min(index, 1)] ?? CLAIM[0], settle), 0);
    if (index >= BEAT.practice) timeline.add(loop.recede(settle), settle ? 0 : 0.1);

    this.motion = timeline;
  }

  exit(): void {
    this.motion?.progress(1).kill();
    this.motion = null;
    this.loop = null;
    this.claims = null;
    this.card = null;
  }
}
