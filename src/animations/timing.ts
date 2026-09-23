import { prefersReducedMotion } from '@/engine/env';

/**
 * Durations (seconds) and eases for GSAP. Must match the motion tokens in
 * `styles/tokens.css`.
 */

export const DURATION = {
  instant: 0.12,
  quick: 0.24,
  normal: 0.48,
  slow: 0.9,
  cinematic: 1.6,
} as const;

export const EASE = {
  standard: 'power2.inOut',
  enter: 'expo.out',
  exit: 'expo.in',
  /**
   * Peak speed is 1.57x the average (`power3.inOut` peaks at 4x), with smooth
   * acceleration. Stronger eases make camera moves whip and cause dizziness.
   */
  camera: 'sine.inOut',
} as const;

export const STAGGER = 0.07;

/** Collapses motion to near-instant when the viewer asks for reduced motion. */
export const motionScale = (): number => (prefersReducedMotion() ? 0.001 : 1);

export const seconds = (value: number): number => value * motionScale();
