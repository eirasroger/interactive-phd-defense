import gsap from 'gsap';
import { createImpactMethod, METHOD, type ImpactMethod } from '@/components/figures/ImpactMethod';
import { createSlide, type Slide, type Statement } from '@/components/Slide';
import { ASSESSMENT } from '@/content/assessment';
import type { SceneContext, SceneInstance } from '@/engine/scene/types';

const BEAT = { method: 0, gap: 1 } as const;

/**
 * Scene 4 — how impact is evaluated.
 *
 * The method is on screen from arrival; the one click empties the inventory it
 * depends on.
 */
export class AssessmentScene implements SceneInstance {
  readonly beats = 2;

  private slide: Slide | null = null;
  private method: Statement | null = null;
  private gap: Statement | null = null;
  private figure: ImpactMethod | null = null;
  private figureSlot = -1;

  private motion: gsap.core.Timeline | null = null;

  enter(context: SceneContext): void {
    context.root.dataset['align'] = 'wide';

    const slide = createSlide({
      eyebrow: ASSESSMENT.eyebrow,
      heading: ASSESSMENT.heading,
      accent: 'circular',
    });

    this.method = slide.addStatement(ASSESSMENT.method);
    this.gap = slide.addStatement(ASSESSMENT.gap, 'emphasis');

    const figure = createImpactMethod(ASSESSMENT.method_figure);
    figure.show(METHOD.void, true);
    this.figureSlot = slide.evidence.add(figure.element);
    this.figure = figure;
    this.slide = slide;

    context.root.appendChild(slide.element);

    const entry = gsap.timeline({ delay: context.entryDelay + 0.15 });
    entry
      .add(slide.revealHead(), 0)
      .add(slide.evidence.show(this.figureSlot), 0.35)
      .add(this.method.play(), 0.5)
      .add(figure.show(METHOD.method), 0.5);
    this.motion = entry;
  }

  beat(index: number, settle: boolean): void {
    const slide = this.slide;
    const figure = this.figure;
    if (!slide || !figure || !this.method || !this.gap) return;

    // Killed rather than completed: every tween targets an absolute value, so
    // nothing is stranded when a click outruns the motion.
    this.motion?.kill();
    this.motion = null;

    slide.revealHead(true);
    slide.evidence.show(this.figureSlot, true);
    this.method.play(true);

    switch (index) {
      case BEAT.method:
        this.gap.hide();
        this.motion = figure.show(METHOD.method, settle);
        break;

      case BEAT.gap: {
        const timeline = gsap.timeline();
        timeline.add(this.gap.play(settle), 0).add(figure.show(METHOD.missing, settle), 0);
        this.motion = timeline;
        break;
      }

      default:
        break;
    }
  }
}
