import type { RenderPipeline } from './RenderPipeline';
import type { Renderer } from './Renderer';

/**
 * What the engine gives up, in the order it should give it up.
 *
 * A defence runs once, on a display nobody has measured, and the only thing
 * worse than a soft image is a stuttering one. This is the ladder down from
 * that: each rung is a **whole state** rather than a delta, so what the frame
 * is currently paying for can be read off one line instead of reconstructed
 * from a history of adjustments.
 *
 * The order is cost over visible damage, both measured at 1080p on the machine
 * the deck was authored on:
 *
 * - bloom costs 2.7 ms and is a look rather than a legibility
 * - resolution is last, because it is the one the audience can actually see,
 *   and the deck's text is DOM so only the 3D image softens
 *
 * Multisampling is **not** a rung. It used to be the first one, until 4x and 2x
 * were rendered side by side and could not be told apart; 2x is now the default
 * in `RenderPipeline.SAMPLES` and that saving is banked rather than held in
 * reserve. Dropping to none is the step that shows, so it is not offered: it
 * would return the deck to the state that constant exists to fix, where the
 * highest tier is the only one with no antialiasing at all.
 */
interface Rung {
  readonly name: string;
  readonly samples: number;
  readonly bloom: boolean;
  readonly resolution: number;
}

const RUNGS: readonly Rung[] = [
  { name: 'full', samples: 2, bloom: true, resolution: 1 },
  { name: 'no bloom', samples: 2, bloom: false, resolution: 1 },
  { name: '85% resolution', samples: 2, bloom: false, resolution: 0.85 },
  { name: '75% resolution', samples: 2, bloom: false, resolution: 0.75 },
];

/**
 * Degradation is **one-way for the length of the talk**.
 *
 * Recovering quality mid-sentence would mean a visible resize, or bloom
 * returning, on a beat chosen by whatever the frame rate happened to do. A
 * presentation that quietly settles one rung low is better than one that
 * oscillates, and the presenter has no attention to spare for either.
 */
export class QualityLadder {
  private index = 0;

  constructor(
    private readonly renderer: Renderer,
    private readonly pipeline: RenderPipeline,
  ) {}

  get level(): string {
    return RUNGS[this.index]!.name;
  }

  get atFloor(): boolean {
    return this.index >= RUNGS.length - 1;
  }

  /** Returns whether there was anywhere left to go. */
  stepDown(): boolean {
    if (this.atFloor) return false;
    this.index += 1;
    this.apply();
    return true;
  }

  private apply(): void {
    const rung = RUNGS[this.index]!;
    this.pipeline.setSamples(rung.samples);
    this.pipeline.setBloomEnabled(rung.bloom);
    // Last, and it is the one that resizes: `setPixelRatioScale` notifies the
    // engine, which re-sizes the pipeline against the new drawing buffer.
    this.renderer.setPixelRatioScale(rung.resolution);
    console.info(`[quality] stepped down to "${rung.name}".`);
  }
}
