/**
 * Runtime environment probe.
 *
 * A defense runs once, on hardware that has not been tested. Quality is
 * chosen from what the machine reports rather than assumed, and `?safe=1`
 * forces the most conservative path if anything looks wrong on the day.
 */

export type QualityTier = 'safe' | 'standard' | 'high';

const params = new URLSearchParams(window.location.search);

export const prefersReducedMotion = (): boolean =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const isSafeMode = (): boolean => params.get('safe') === '1';

function detectWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2'));
  } catch {
    return false;
  }
}

export const supportsWebGL = detectWebGL();

export function detectQualityTier(): QualityTier {
  if (isSafeMode() || prefersReducedMotion() || !supportsWebGL) return 'safe';

  const cores = navigator.hardwareConcurrency ?? 4;
  const memory = (navigator as { deviceMemory?: number }).deviceMemory ?? 4;
  const pixels = window.screen.width * window.screen.height * window.devicePixelRatio;

  if (cores >= 8 && memory >= 8 && pixels <= 1920 * 1080 * 2) return 'high';
  return 'standard';
}

export const qualityTier: QualityTier = detectQualityTier();

/** Renderer pixel ratio is capped: it is the cheapest large performance lever. */
export const maxPixelRatio: number =
  qualityTier === 'high' ? 2 : qualityTier === 'standard' ? 1.5 : 1;
