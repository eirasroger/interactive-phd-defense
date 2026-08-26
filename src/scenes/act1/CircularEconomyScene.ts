import gsap from 'gsap';
import { createBrief, createClaims, type Card, type Claims } from '@/components/Brief';
import { createLoop, type Loop } from '@/components/figures/Loop';
import { CIRCULAR_ECONOMY } from '@/content/circularEconomy';
import type { SceneContext, SceneInstance } from '@/engine/scene/types';
import { el } from '@/utilities/dom';

const BEAT = { hierarchy: 0, practice: 1 } as const;

/** Which claims are live on each beat. The turn carries two of them. */
const CLAIM = [[0], [1, 2]] as const;

/**
 * Scene 4 - circular economy in construction.
 *
 * Two beats, and the first of them is the scene's arrival: the hierarchy is
 * already on screen when the camera settles, so the one click available is
 * spent on the turn rather than on assembling a picture the audience could
 * have been reading the whole time.
 *
 * **One card, and the claims read across underneath the drawing.** Every other
 * composition in this act stands a wide figure beside a 30rem column of
 * numbered claims, which is right where the drawing is tall enough to leave a
 * column free. This one is a chain of four stages with three returns nested
 * under it: the widest figure in the act and the least tall. A sidecar would
 * squeeze it into two thirds of the frame to fill a column that is mostly
 * floor. Given the whole width it reads as one continuous loop, and the three
 * claims sit as three columns beneath it, divided by rules that turn with the
 * reading direction.
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

    // The whole first beat, as one arrival: heading, the card it stands on, the
    // chain closing, and the line that reads it. Overlapped rather than queued,
    // because four things that finish together is an arrival and four in a row
    // is a wait.
    const entry = gsap.timeline({ delay: context.entryDelay + 0.15 });
    entry
      .add(brief.revealHead(), 0)
      .add(card.reveal(), 0.3)
      .add(loop.close(), 0.5)
      .add(claims.show(CLAIM[BEAT.hierarchy]), 0.45);
    this.motion = entry;
  }

  /**
   * Each branch describes the state the beat *is*, not the change into it:
   * beats are reached backwards and out of order as often as forwards.
   *
   * The outgoing timeline is finished rather than dropped. `Loop.close` is
   * built from `from` tweens, and a `from` killed part-way leaves its target at
   * the value it was animating out of, which across this figure is invisible.
   */
  beat(index: number, settle: boolean): void {
    const loop = this.loop;
    const claims = this.claims;
    const card = this.card;
    if (!loop || !claims || !card) return;

    this.motion?.progress(1).kill();
    gsap.set(this.head, { opacity: 1, y: 0 });
    card.reveal(true);

    // Both beats share the closed chain, so it is asserted rather than assumed:
    // this beat may be the one the scene was jumped into.
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
