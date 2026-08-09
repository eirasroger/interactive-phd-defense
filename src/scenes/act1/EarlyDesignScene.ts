import gsap from 'gsap';
import { createInfluenceCurve, CURVE, type InfluenceCurve } from '@/components/figures/InfluenceCurve';
import { createSlide, type Slide, type Statement } from '@/components/Slide';
import { EARLY_DESIGN } from '@/content/earlyDesign';
import type { SceneContext, SceneInstance } from '@/engine/scene/types';

const BEAT = { influence: 0, crossing: 1 } as const;

/**
 * Scene 6 — early design.
 *
 * The falling curve arrives with the scene; the click brings the rising one up
 * to meet it. Two lines, and the argument is where they cross.
 */
export class EarlyDesignScene implements SceneInstance {
  readonly beats = 2;

  private slide: Slide | null = null;
  private influence: Statement | null = null;
  private crossing: Statement | null = null;
  private curve: InfluenceCurve | null = null;
  private curveSlot = -1;

  private motion: gsap.core.Timeline | null = null;

  enter(context: SceneContext): void {
    context.root.dataset['align'] = 'wide';

    const slide = createSlide({
      eyebrow: EARLY_DESIGN.eyebrow,
      heading: EARLY_DESIGN.heading,
      accent: 'circular',
    });

    this.influence = slide.addStatement(EARLY_DESIGN.influence);
    this.crossing = slide.addStatement(EARLY_DESIGN.crossing, 'emphasis');

    const curve = createInfluenceCurve(EARLY_DESIGN.curve);
    this.curveSlot = slide.evidence.add(curve.element);
    this.curve = curve;
    this.slide = slide;

    context.root.appendChild(slide.element);
    curve.show(CURVE.void, true);

    const entry = gsap.timeline({ delay: context.entryDelay + 0.15 });
    entry
      .add(slide.revealHead(), 0)
      .add(slide.evidence.show(this.curveSlot), 0.35)
      .add(this.influence.play(), 0.5)
      .add(curve.show(CURVE.influence), 0.5);
    this.motion = entry;
  }

  beat(index: number, settle: boolean): void {
    const slide = this.slide;
    const curve = this.curve;
    if (!slide || !curve || !this.influence || !this.crossing) return;

    this.motion?.kill();
    this.motion = null;

    slide.revealHead(true);
    slide.evidence.show(this.curveSlot, true);
    this.influence.play(true);

    switch (index) {
      case BEAT.influence:
        this.crossing.hide();
        this.motion = curve.show(CURVE.influence, settle);
        break;

      case BEAT.crossing: {
        const timeline = gsap.timeline();
        timeline.add(this.crossing.play(settle), 0).add(curve.show(CURVE.crossing, settle), 0);
        this.motion = timeline;
        break;
      }

      default:
        break;
    }
  }
}
