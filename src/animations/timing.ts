import { prefersReducedMotion } from '@/engine/env';

/**
 * Motion vocabulary for script-driven animation.
 *
 * These mirror the duration and easing tokens in `styles/tokens.css`; the two
 * must be kept in step so CSS transitions and GSAP tweens share one language.
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
  camera: 'power3.inOut',
} as const;

export const STAGGER = 0.07;

/** Collapses motion to near-instant when the viewer asks for reduced motion. */
export const motionScale = (): number => (prefersReducedMotion() ? 0.001 : 1);

export const seconds = (value: number): number => value * motionScale();
