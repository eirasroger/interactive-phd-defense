import { ADAPTIVE } from '@/config/presentation';

/**
 * A frame longer than this is an event rather than a frame rate: a zone
 * mounting, a shader compiling, a tab returning to the foreground. Averaging
 * one into the window is what turns a single hitch into a permanent step down.
 */
const STALL_SECONDS = 0.5;

/**
 * Seconds of running deck to discard after loading ends.
 *
 * The frames immediately after a load are the most expensive the talk will ever
 * draw and the least representative: the zone mounts, every material compiles
 * its program against the scene's light count, and tens of megabytes of texture
 * upload. Measured, that is over two seconds of blocked main thread — see
 * `learnings.md` §39 — which is three sample windows of "under fifteen fps" and
 * enough to walk the ladder to its floor before the first word is spoken.
 */
const SETTLE_SECONDS = 2.5;

/**
 * Watches frame rate and gives up quality when the machine cannot keep up.
 *
 * What it gives up, and in what order, belongs to `QualityLadder`. This decides
 * only *when*, which is one sustained sample under the threshold: a single slow
 * frame is a shader compiling or a texture uploading, and stepping down for one
 * of those would cost the talk its resolution over an event that has already
 * finished.
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
   * Driven by the deck's own loading state rather than by a clock of ours.
   *
   * Watching is off while anything is loading, because a load is not a frame
   * rate, and it restarts the settle each time so a mid-talk zone build is
   * covered by the same rule as the first one.
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
     * A hidden tab is not a slow machine.
     *
     * Chrome throttles `requestAnimationFrame` to about one frame a second in a
     * backgrounded tab, and the first frame after coming back carries the whole
     * gap as one `dt`. Both read as a sag. A presenter who alt-tabs to their
     * notes during setup, or whose laptop lid is closed while the projector is
     * found, would return to a deck that had quietly walked to the bottom of
     * the ladder and stays there, because degradation is one-way.
     *
     * The sample is discarded rather than paused, so the window after a return
     * is measured from scratch instead of averaging the stall into it.
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
