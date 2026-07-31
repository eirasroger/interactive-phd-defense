import gsap from 'gsap';
import type { FrameHandler } from './types';

/**
 * The single time authority for the presentation.
 *
 * GSAP's ticker is used as the one requestAnimationFrame loop rather than
 * running a competing loop beside it; Three.js rendering and scene updates
 * are driven from here so every subsystem sees the same frame boundary.
 */

/** Clamp after a tab switch or a stall, so nothing jumps when focus returns. */
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
