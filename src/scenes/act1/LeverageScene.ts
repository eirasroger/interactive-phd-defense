import gsap from 'gsap';
import { createLeverage, MACLEAMY, type Leverage } from '@/components/figures/Leverage';
import { createSlide, type Slide, type Statement } from '@/components/Slide';
import { LEVERAGE } from '@/content/leverage';
import type { SceneContext, SceneInstance } from '@/engine/scene/types';

const BEAT = { ability: 0, cost: 1 } as const;

/**
 * Scene 3 — why the early design stage.
 *
 * The ability arrives with the scene; the click raises its price against it and
 * brackets the window over the first two phases. Two beats, because the claim
 * has two halves and the beat this act cannot spare is a third one spent
 * agreeing with itself.
 */
export class LeverageScene implements SceneInstance {
  readonly beats = 2;

  private slide: Slide | null = null;
  private ability: Statement | null = null;
  private cost: Statement | null = null;
  private band: Leverage | null = null;
  private bandSlot = -1;

  private motion: gsap.core.Timeline | null = null;

  enter(context: SceneContext): void {
    context.root.dataset['align'] = 'wide';

    const slide = createSlide({
      eyebrow: LEVERAGE.eyebrow,
      heading: LEVERAGE.heading,
      accent: 'emphasis',
    });

    // Each rule takes the colour of the curve its statement introduces, so the
    // claim on the left and the shape on the right are read as one thing.
    this.ability = slide.addStatement(LEVERAGE.ability, 'circular');
    this.cost = slide.addStatement(LEVERAGE.cost, 'ai');

    const band = createLeverage(LEVERAGE.band);
    this.bandSlot = slide.evidence.add(band.element);
    this.band = band;
    this.slide = slide;

    context.root.appendChild(slide.element);
    band.show(MACLEAMY.void, true);

    const entry = gsap.timeline({ delay: context.entryDelay + 0.15 });
    entry
      .add(slide.revealHead(), 0)
      .add(slide.evidence.show(this.bandSlot), 0.35)
      .add(this.ability.play(), 0.5)
      .add(band.show(MACLEAMY.ability), 0.5);
    this.motion = entry;
  }

  beat(index: number, settle: boolean): void {
    const slide = this.slide;
    const band = this.band;
    if (!slide || !band || !this.ability || !this.cost) return;

    this.motion?.kill();
    this.motion = null;

    slide.revealHead(true);
    slide.evidence.show(this.bandSlot, true);
    this.ability.play(true);

    switch (index) {
      case BEAT.ability:
        this.cost.hide();
        this.motion = band.show(MACLEAMY.ability, settle);
        break;

      case BEAT.cost: {
        const timeline = gsap.timeline();
        timeline.add(this.cost.play(settle), 0).add(band.show(MACLEAMY.cost, settle), 0);
        this.motion = timeline;
        break;
      }

      default:
        break;
    }
  }
}
