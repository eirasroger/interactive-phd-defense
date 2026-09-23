import type { RenderPipeline } from './RenderPipeline';
import type { Renderer } from './Renderer';

/**
 * Quality levels, highest first. Each rung is a complete state. Order is cost
 * against visible damage at 1080p: bloom goes first (2.7 ms), resolution last
 * (only the 3D image softens, text is DOM). Samples stay at 2x, the default in
 * `RenderPipeline.SAMPLES`, because dropping to none is visible.
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
 * Steps quality down only, never back up, so the image cannot visibly change
 * mid-talk because of frame-rate swings.
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
    // Last: `setPixelRatioScale` triggers the engine to resize the pipeline.
    this.renderer.setPixelRatioScale(rung.resolution);
    console.info(`[quality] stepped down to "${rung.name}".`);
  }
}
