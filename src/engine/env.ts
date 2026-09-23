/**
 * Runtime environment probe. Picks a quality tier from what the machine
 * reports. `?safe=1` forces the most conservative tier.
 */

export type QualityTier = 'safe' | 'standard' | 'high';

const params = new URLSearchParams(window.location.search);

export const prefersReducedMotion = (): boolean =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const isSafeMode = (): boolean => params.get('safe') === '1';

/** Phone or tablet: coarse pointer with no hover. Avoids user-agent parsing. */
export const isTouchPrimary = (): boolean =>
  window.matchMedia('(pointer: coarse) and (hover: none)').matches;

/** `?quality=safe|standard|high` overrides the probe. */
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
   * Phones and tablets always get `safe`. An 8-core phone passes the core and
   * memory check below, and the `high` tier then exhausts its GPU.
   */
  if (isTouchPrimary()) return 'safe';

  const cores = navigator.hardwareConcurrency ?? 4;
  const memory = (navigator as { deviceMemory?: number }).deviceMemory ?? 4;

  /*
   * Display size is ignored. `QualitySettings.maxRenderPixels` caps the drawing
   * buffer, so the external display only changes scaling and never the tier.
   */
  if (cores >= 8 && memory >= 8) return 'high';
  return 'standard';
}

export const qualityTier: QualityTier = detectQualityTier();

/** Maximum renderer pixel ratio per tier. */
export const maxPixelRatio: number =
  qualityTier === 'high' ? 2 : qualityTier === 'standard' ? 1.5 : 1;
