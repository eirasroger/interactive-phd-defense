import gsap from 'gsap';
import { createLoop, type Loop } from '@/components/figures/Loop';
import { createSlide, type Slide, type Statement } from '@/components/Slide';
import { CIRCULAR_ECONOMY } from '@/content/circularEconomy';
import type { SceneContext, SceneInstance } from '@/engine/scene/types';

const BEAT = { hierarchy: 0, practice: 1 } as const;

/**
 * Scene 3 — circular economy in construction.
 *
 * Two beats, and the first of them is the scene's arrival: the hierarchy is
 * already on screen when the camera settles, so the one click available is
 * spent on the turn rather than on assembling a picture the audience could
 * have been reading the whole time.
 */
export class CircularEconomyScene implements SceneInstance {
  readonly beats = 2;

  private slide: Slide | null = null;
  private principle: Statement | null = null;
  private practice: Statement[] = [];
  private loop: Loop | null = null;
  private loopSlot = -1;

  /** Whatever is currently animating, so the next beat can finish it first. */
  private motion: gsap.core.Timeline | null = null;

  enter(context: SceneContext): void {
    context.root.dataset['align'] = 'wide';

    const slide = createSlide({
      eyebrow: CIRCULAR_ECONOMY.eyebrow,
      heading: CIRCULAR_ECONOMY.heading,
      accent: 'circular',
    });

    this.principle = slide.addStatement(CIRCULAR_ECONOMY.principle);
    // Amber, and the only amber in the column: the hierarchy is the argument,
    // these two lines are what is wrong with it.
    this.practice = CIRCULAR_ECONOMY.practice.map((line) => slide.addStatement(line, 'emphasis'));

    const loop = createLoop(CIRCULAR_ECONOMY.loop);
    this.loopSlot = slide.evidence.add(loop.element);
    this.loop = loop;
    this.slide = slide;

    context.root.appendChild(slide.element);

    // The whole first beat, as one arrival: heading, the line that reads the
    // figure, and the figure drawing itself. Overlapped rather than queued —
    // three things that finish together is an arrival, three things in a row
    // is a wait.
    const entry = gsap.timeline({ delay: context.entryDelay + 0.15 });
    entry
      .add(slide.revealHead(), 0)
      .add(slide.evidence.show(this.loopSlot), 0.35)
      .add(this.principle.play(), 0.5)
      .add(loop.close(), 0.55);
    this.motion = entry;
  }

  // Each case describes the state the beat *is*, not the change into it: beats
  // are reached backwards and out of order as often as forwards.
  beat(index: number, settle: boolean): void {
    const slide = this.slide;
    if (!slide || !this.principle || !this.loop) return;

    // Anything still counting is finished rather than dropped. A `from` tween
    // killed part-way leaves its target stranded at the value it was animating
    // *out of*, which across this figure is invisible.
    this.motion?.progress(1).kill();
    this.motion = null;

    // Both beats share the arrival state, so it is asserted rather than
    // assumed: this beat may be the one the scene was jumped into.
    slide.revealHead(true);
    slide.evidence.show(this.loopSlot, true);
    this.principle.play(true);
    this.loop.close(true);

    switch (index) {
      case BEAT.hierarchy:
        for (const line of this.practice) line.hide();
        break;

      case BEAT.practice: {
        const timeline = gsap.timeline();
        this.practice.forEach((line, order) => {
          timeline.add(line.play(settle), settle ? 0 : order * 0.16);
        });
        timeline.add(this.loop.recede(settle), settle ? 0 : 0.1);
        this.motion = timeline;
        break;
      }

      default:
        break;
    }
  }
}
