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
  /**
   * The gentlest ease-in-out there is, and the camera's for that reason alone.
   *
   * An ease is a velocity profile, and `inOut` curves buy their soft ends by
   * spending the difference in the middle: `power3.inOut` peaks at **four
   * times** the average speed halfway through the move. On a UI element that
   * reads as crisp. On a camera it is a lurch — the world barely moves, then
   * whips, then stops — and it was most of why Act I's transitions were making
   * viewers dizzy.
   *
   * `sine.inOut` peaks at 1.57×, still stops dead at both ends, and has no
   * discontinuity in acceleration anywhere. It is the profile a camera
   * operator's hand actually produces.
   */
  camera: 'sine.inOut',
} as const;

export const STAGGER = 0.07;

/** Collapses motion to near-instant when the viewer asks for reduced motion. */
export const motionScale = (): number => (prefersReducedMotion() ? 0.001 : 1);

export const seconds = (value: number): number => value * motionScale();
