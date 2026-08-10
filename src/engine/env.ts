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

/**
 * A coarse pointer that cannot hover is the one phone/tablet signal that does
 * not mean parsing a user-agent string.
 */
export const isTouchPrimary = (): boolean =>
  window.matchMedia('(pointer: coarse) and (hover: none)').matches;

/** `?quality=high` overrides the probe, for a tablet that can afford more. */
function requestedTier(): QualityTier | null {
  const value = params.get('quality');
  return value === 'safe' || value === 'standard' || value === 'high' ? value : null;
}

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
  const requested = requestedTier();
  if (requested) return requested;

  if (isSafeMode() || prefersReducedMotion() || !supportsWebGL) return 'safe';

  /*
   * Handsets take the conservative path regardless of what they report.
   *
   * The heuristic below cannot see them: `screen` is in CSS pixels, so a phone
   * measures ~400x900 and clears the pixel bound far more easily than the large
   * displays that bound exists to exclude. An 8-core Android — and Chrome caps
   * `deviceMemory` at exactly 8 — therefore satisfied all three conditions and
   * was handed 2048px shadow maps, bloom and an 80k particle budget on top of
   * 47MB of models. That is what exhausts the GPU and loses the context.
   */
  if (isTouchPrimary()) return 'safe';

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
