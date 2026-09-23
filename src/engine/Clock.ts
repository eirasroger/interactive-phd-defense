import gsap from 'gsap';
import type { FrameHandler } from './types';

/**
 * Single time source for the presentation. Runs on GSAP's ticker as the only
 * requestAnimationFrame loop, so rendering and scene updates share one frame.
 */

/** Caps the frame delta after a tab switch or stall, so nothing jumps. */
const MAX_FRAME_SECONDS = 1 / 15;

export class Clock {
  private readonly handlers = new Set<FrameHandler>();
  private running = false;
  private elapsed = 0;

  start(): void {
    if (this.running) return;
    this.running = true;
    gsap.ticker.lagSmoothing(0);
    gsap.ticker.add(this.tick);
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;
    gsap.ticker.remove(this.tick);
  }

  /** Returns an unsubscribe function. */
  add(handler: FrameHandler): () => void {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }

  private readonly tick = (_time: number, deltaMs: number): void => {
    const dt = Math.min(deltaMs / 1000, MAX_FRAME_SECONDS);
    this.elapsed += dt;
    for (const handler of this.handlers) {
      handler(dt, this.elapsed);
    }
  };
}
