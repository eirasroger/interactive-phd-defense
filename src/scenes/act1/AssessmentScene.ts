import gsap from 'gsap';
import { createBrief, type Card, type Claims } from '@/components/Brief';
import { createImpactMethod, METHOD, type ImpactMethod } from '@/components/figures/ImpactMethod';
import { ASSESSMENT } from '@/content/assessment';
import type { SceneContext, SceneInstance } from '@/engine/scene/types';

const BEAT = { method: 0, gap: 1 } as const;

/** Claims shown on each beat. */
const CLAIM = [[0], [1, 2]] as const;

/**
 * Scene 5: how impact is evaluated. The method shows on arrival; the one beat
 * empties the inventory it depends on.
 *
 * The figure sits on a translucent card so it stays legible over the lit park
 * without dimming the world.
 */
export class AssessmentScene implements SceneInstance {
  readonly beats = 2;

  private figure: ImpactMethod | null = null;
  private claims: Claims | null = null;
  private figureCard: Card | null = null;
  private head: HTMLElement[] = [];

  private motion: gsap.core.Timeline | null = null;

  enter(context: SceneContext): void {
    context.root.dataset['align'] = 'brief';

    const brief = createBrief({
      eyebrow: ASSESSMENT.eyebrow,
      heading: ASSESSMENT.heading,
      accent: 'circular',
      split: 'claims',
    });
    this.head = [...brief.head];

    const card = brief.addCard({
      label: 'What the assessment needs',
      note: 'Inventory into method',
      accent: 'circular',
    });
    const figure = createImpactMethod(ASSESSMENT.method_figure);
    card.body.appendChild(figure.element);
    figure.show(METHOD.void, true);
    this.figure = figure;
    this.figureCard = card;

    this.claims = brief.addClaims([...ASSESSMENT.claims], {
      label: 'Method, and what it needs',
      accent: 'circular',
    });

    context.root.appendChild(brief.element);

    const entry = gsap.timeline({ delay: context.entryDelay + 0.15 });
    entry
      .add(brief.revealHead(), 0)
      .add(card.reveal(), 0.3)
      .add(figure.show(METHOD.method), 0.5)
      .add(this.claims.show(CLAIM[BEAT.method]), 0.45);
    this.motion = entry;
  }

  beat(index: number, settle: boolean): void {
    const figure = this.figure;
    const claims = this.claims;
    const card = this.figureCard;
    if (!figure || !claims || !card) return;

    // Safe to kill: every figure tween targets an absolute value.
    this.motion?.kill();
    gsap.set(this.head, { opacity: 1, y: 0 });
    card.reveal(true);

    const state = index >= BEAT.gap ? METHOD.missing : METHOD.method;

    this.motion = gsap
      .timeline()
      .add(figure.show(state, settle), 0)
      .add(claims.show(CLAIM[Math.min(index, 1)] ?? CLAIM[0], settle), 0);
  }

  exit(): void {
    this.motion?.kill();
    this.motion = null;
    this.figure = null;
    this.claims = null;
    this.figureCard = null;
  }
}
