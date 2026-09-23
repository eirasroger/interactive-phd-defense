import { ADAPTIVE } from '@/config/presentation';

/**
 * Frames longer than this (seconds) are one-off stalls such as a zone mount or
 * shader compile. They are dropped so one hitch cannot trigger a step down.
 */
const STALL_SECONDS = 0.5;

/**
 * Seconds to ignore after loading ends. Shader compiles and texture uploads
 * block the main thread for over two seconds (`learnings.md` §39).
 */
const SETTLE_SECONDS = 2.5;

/**
 * Calls `onSag` when a full sample window averages below the fps threshold.
 * `QualityLadder` decides what to reduce.
 */
export class PerformanceMonitor {
  private accumulated = 0;
  private frames = 0;
  private currentFps = 0;
  private settling = SETTLE_SECONDS;
  private active = false;

  constructor(private readonly onSag: () => void) {}

  get fps(): number {
    return this.currentFps;
  }

  /**
   * Set from the deck's loading state: inactive while loading. Each change
   * restarts the settle period.
   */
  setActive(active: boolean): void {
    if (active === this.active) return;
    this.active = active;
    this.settling = SETTLE_SECONDS;
    this.accumulated = 0;
    this.frames = 0;
  }

  update(dt: number): void {
    /*
     * Reset the sample while hidden or after a stall. Browsers throttle rAF in
     * background tabs, and degradation is one-way, so those frames must not count.
     */
    if (!this.active || document.hidden || dt > STALL_SECONDS) {
      this.accumulated = 0;
      this.frames = 0;
      return;
    }

    if (this.settling > 0) {
      this.settling -= dt;
      return;
    }

    this.accumulated += dt;
    this.frames += 1;

    if (this.accumulated < ADAPTIVE.sampleSeconds) return;

    this.currentFps = this.frames / this.accumulated;
    this.accumulated = 0;
    this.frames = 0;

    if (this.currentFps < ADAPTIVE.degradeBelowFps) this.onSag();
  }
}
