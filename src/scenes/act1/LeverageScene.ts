import gsap from 'gsap';
import { createBrief, type Card, type Claims } from '@/components/Brief';
import { createLeverage, MACLEAMY, type Leverage } from '@/components/figures/Leverage';
import { LEVERAGE } from '@/content/leverage';
import type { SceneContext, SceneInstance } from '@/engine/scene/types';

/**
 * The figure state each beat rests on, and the claim that is live on it.
 *
 * **The price and the window land together.** They were separate clicks, on the
 * reasoning that the window is a claim about this work rather than about the
 * published curve and deserved its own beat. In front of the drawing that reads
 * as a pause: the bracket sits under the two phases where the rising curve has
 * only just left the floor, so it is legible as part of the same statement the
 * cost curve makes and a click spent arriving at it is a click the audience
 * watches nothing happen in.
 */
const STATES = [MACLEAMY.ability, MACLEAMY.window] as const;
const CLAIM = [[0], [1, 2]] as const;

/**
 * Scene 3 — why the early design stage.
 *
 * **The curve is the slide, and it now has the width it was drawn for.** It
 * used to stand in a seven-column slot beside a six-line heading and a
 * forty-five word paragraph, at roughly half the size, over open park. It is
 * the one published figure in the act and the only thing on this beat the
 * audience has to read, so it takes the frame and the claims take a column.
 *
 * Two beats, one per half of the argument: what a decision can still shape, and
 * what it costs to revise once it cannot. The specification window arrives with
 * the second, because it is where the two curves cross in the project's favour
 * and it says nothing on its own.
 */
export class LeverageScene implements SceneInstance {
  readonly beats = STATES.length;

  private band: Leverage | null = null;
  private claims: Claims | null = null;
  private figureCard: Card | null = null;
  private head: HTMLElement[] = [];

  private motion: gsap.core.Timeline | null = null;

  enter(context: SceneContext): void {
    context.root.dataset['align'] = 'brief';

    const brief = createBrief({
      eyebrow: LEVERAGE.eyebrow,
      heading: LEVERAGE.heading,
      accent: 'emphasis',
      split: 'claims',
      source: LEVERAGE.source,
    });
    this.head = [...brief.head];

    // No head. The axis is labelled along the bottom, both curves are named at
    // the end where each one is highest, and the bracket names itself; a strip
    // above the drawing repeating any of that is the slide reading itself out.
    const card = brief.addCard({ accent: 'neutral' });
    const band = createLeverage(LEVERAGE.band);
    card.body.appendChild(band.element);
    this.band = band;
    this.figureCard = card;

    this.claims = brief.addClaims([...LEVERAGE.claims], { accent: 'emphasis' });

    context.root.appendChild(brief.element);
    band.show(MACLEAMY.void, true);

    const entry = gsap.timeline({ delay: context.entryDelay + 0.15 });
    entry
      .add(brief.revealHead(), 0)
      .add(card.reveal(), 0.3)
      .add(band.show(MACLEAMY.ability), 0.55)
      .add(this.claims.show(CLAIM[0]), 0.45);
    this.motion = entry;
  }

  beat(index: number, settle: boolean): void {
    const band = this.band;
    const claims = this.claims;
    const card = this.figureCard;
    if (!band || !claims || !card) return;

    // Every tween in this scene targets an absolute value, so the outgoing
    // timeline is killed rather than completed and nothing is left stranded.
    this.motion?.kill();
    gsap.set(this.head, { opacity: 1, y: 0 });
    card.reveal(true);

    const step = Math.min(index, STATES.length - 1);

    this.motion = gsap
      .timeline()
      .add(band.show(STATES[step] ?? MACLEAMY.ability, settle), 0)
      .add(claims.show(CLAIM[step] ?? CLAIM[0], settle), 0);
  }

  exit(): void {
    this.motion?.kill();
    this.motion = null;
    this.band = null;
    this.claims = null;
    this.figureCard = null;
  }
}
