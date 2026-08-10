import gsap from 'gsap';
import {
  createDeclaration,
  DECLARATION,
  type Declaration,
} from '@/components/figures/Declaration';
import { createSlide, type Slide, type Statement } from '@/components/Slide';
import { EPD } from '@/content/epd';
import type { SceneContext, SceneInstance } from '@/engine/scene/types';

const BEAT = { carrier: 0, basis: 1 } as const;

/**
 * Scene 5 — EPDs as decision-support data.
 *
 * The declaration is whole and on screen from arrival, because that is how it
 * arrives in practice. The one click asks where its numbers came from.
 */
export class EpdScene implements SceneInstance {
  readonly beats = 2;

  private slide: Slide | null = null;
  private carrier: Statement | null = null;
  private basis: Statement[] = [];
  private figure: Declaration | null = null;
  private figureSlot = -1;

  private motion: gsap.core.Timeline | null = null;

  enter(context: SceneContext): void {
    context.root.dataset['align'] = 'wide';

    const slide = createSlide({
      eyebrow: EPD.eyebrow,
      heading: EPD.heading,
      accent: 'circular',
    });

    this.carrier = slide.addStatement(EPD.carrier);
    // Amber, and the only amber in the column: the declaration is the argument,
    // these two lines are what is inside it.
    this.basis = EPD.basis.map((line) => slide.addStatement(line, 'emphasis'));

    const figure = createDeclaration(EPD.declaration);
    figure.show(DECLARATION.void, true);
    this.figureSlot = slide.evidence.add(figure.element);
    this.figure = figure;
    this.slide = slide;

    context.root.appendChild(slide.element);

    const entry = gsap.timeline({ delay: context.entryDelay + 0.15 });
    entry
      .add(slide.revealHead(), 0)
      .add(slide.evidence.show(this.figureSlot), 0.35)
      .add(this.carrier.play(), 0.5)
      .add(figure.show(DECLARATION.declared), 0.5);
    this.motion = entry;
  }

  // Each case describes the state the beat *is*, not the change into it: beats
  // are reached backwards and out of order as often as forwards.
  beat(index: number, settle: boolean): void {
    const slide = this.slide;
    const figure = this.figure;
    if (!slide || !figure || !this.carrier) return;

    // Killed rather than completed: every tween targets an absolute value, so
    // nothing is stranded when a click outruns the motion.
    this.motion?.kill();
    this.motion = null;

    slide.revealHead(true);
    slide.evidence.show(this.figureSlot, true);
    this.carrier.play(true);

    switch (index) {
      case BEAT.carrier:
        for (const line of this.basis) line.hide();
        this.motion = figure.show(DECLARATION.declared, settle);
        break;

      case BEAT.basis: {
        const timeline = gsap.timeline();
        this.basis.forEach((line, order) => {
          timeline.add(line.play(settle), settle ? 0 : order * 0.16);
        });
        timeline.add(figure.show(DECLARATION.basis, settle), 0);
        this.motion = timeline;
        break;
      }

      default:
        break;
    }
  }
}
