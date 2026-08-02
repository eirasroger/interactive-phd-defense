import { ADAPTIVE } from '@/config/presentation';

/**
 * Watches frame rate and asks for resolution to be reduced when the machine
 * cannot keep up.
 *
 * Degradation is one-way during a talk: recovering resolution mid-sentence
 * would cause a visible resize, which is worse than staying slightly soft.
 */
export class PerformanceMonitor {
  private accumulated = 0;
  private frames = 0;
  private currentFps = 0;
  private scale = 1;

  constructor(private readonly onScaleChange: (scale: number) => void) {}

  get fps(): number {
    return this.currentFps;
  }

  get pixelRatioScale(): number {
    return this.scale;
  }

  update(dt: number): void {
    this.accumulated += dt;
    this.frames += 1;

    if (this.accumulated < ADAPTIVE.sampleSeconds) return;

    this.currentFps = this.frames / this.accumulated;
    this.accumulated = 0;
    this.frames = 0;

    if (this.currentFps < ADAPTIVE.degradeBelowFps && this.scale > ADAPTIVE.minPixelRatio) {
      this.scale = Math.max(ADAPTIVE.minPixelRatio, this.scale - 0.15);
      this.onScaleChange(this.scale);
    }
  }
}
