import gsap from 'gsap';
import { createBrief, type Card, type Claims } from '@/components/Brief';
import { createLeverage, MACLEAMY, type Leverage } from '@/components/figures/Leverage';
import { LEVERAGE } from '@/content/leverage';
import type { SceneContext, SceneInstance } from '@/engine/scene/types';

/**
 * Figure state and active claims per beat. The cost claim and the
 * specification window share the second beat.
 */
const STATES = [MACLEAMY.ability, MACLEAMY.window] as const;
const CLAIM = [[0], [1, 2]] as const;

/**
 * Scene 3: why the early design stage. The MacLeamy curve fills the card and
 * the claims sit in a column. Beat 1 shows the ability to shape the design,
 * beat 2 adds the cost of change and the specification window.
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

    // No card head: the axis, curves and bracket are labelled in the figure.
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

    // All tweens target absolute values, so killing the old timeline is safe.
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
