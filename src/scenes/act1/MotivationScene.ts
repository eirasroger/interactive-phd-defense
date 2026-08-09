import { DURATION, seconds } from '@/animations/timing';
import { createRateTrack } from '@/components/figures/RateTrack';
import { createStatLedger } from '@/components/figures/StatLedger';
import { createSlide, type Slide } from '@/components/Slide';
import { MOTIVATION } from '@/content/motivation';
import type { SceneContext, SceneInstance } from '@/engine/scene/types';

/** A panel in the evidence column, paired with the build it plays on arrival. */
interface Panel {
  readonly slot: number;
  play(settle: boolean): gsap.core.Timeline;
}

const BEAT = { claim: 0, burden: 1, target: 2 } as const;

/**
 * Scene 2 — motivation and research context.
 *
 * The claim is stated, the sector is measured, and the measurement is set
 * against what policy requires. The evidence column swaps rather than
 * accumulates: both panels at once would halve the figures to fit them.
 */
export class MotivationScene implements SceneInstance {
  readonly beats = 3;

  private slide: Slide | null = null;
  private burden: Panel | null = null;
  private target: Panel | null = null;
  private build: gsap.core.Timeline | null = null;

  /** Which builds have run, so returning to a beat restores rather than replays. */
  private readonly built = new Set<number>();

  enter(context: SceneContext): void {
    context.root.dataset['align'] = 'wide';

    const slide = createSlide({
      eyebrow: MOTIVATION.eyebrow,
      heading: MOTIVATION.heading,
      accent: 'emphasis',
    });

    const ledger = createStatLedger(MOTIVATION.burden);
    const track = createRateTrack(MOTIVATION.target);

    this.burden = { slot: slide.evidence.add(ledger.element), play: ledger.play };
    this.target = { slot: slide.evidence.add(track.element), play: track.play };
    this.slide = slide;

    context.root.appendChild(slide.element);
    slide.revealHead().delay(context.entryDelay + 0.15);
  }

  // Each case describes the state the beat *is*, not the change into it: beats
  // are reached backwards and out of order as often as forwards.
  beat(index: number, settle: boolean): void {
    const slide = this.slide;
    if (!slide || !this.burden || !this.target) return;

    switch (index) {
      case BEAT.claim:
        slide.revealHead(true);
        break;
      case BEAT.burden:
        this.show(slide, this.burden, settle);
        break;
      case BEAT.target:
        this.show(slide, this.target, settle);
        break;
      default:
        break;
    }
  }

  /** Brings a panel forward. Its build runs the first time only. */
  private show(slide: Slide, panel: Panel, settle: boolean): void {
    const replay = settle || this.built.has(panel.slot);
    this.built.add(panel.slot);

    // A build still counting when its panel is swapped away finishes out of
    // order, and clicking twice quickly is normal. Run it to its end before
    // killing it: a `from` tween killed part-way leaves its target stranded at
    // the value it was animating *out of*, which here is invisible.
    this.build?.progress(1).kill();

    const timeline = slide.evidence.show(panel.slot, settle);
    this.build = panel.play(replay);
    timeline.add(this.build, replay ? 0 : seconds(DURATION.quick));
  }
}
