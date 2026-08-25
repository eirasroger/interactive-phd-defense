import { STAGE } from '@/config/presentation';
import { qualityTier, type QualityTier } from '@/engine/env';

/**
 * Tier definitions.
 *
 * `env.ts` probes the machine; this file decides what that means. Keeping the
 * two apart means the probe can be overridden or faked without touching the
 * rendering settings themselves.
 */
export interface QualitySettings {
  readonly maxPixelRatio: number;
  readonly shadows: boolean;
  readonly shadowMapSize: number;
  readonly postProcessing: boolean;
  readonly bloomStrength: number;
  readonly anisotropy: number;
  readonly environmentResolution: number;
  /** Upper bound on instanced particles per scene. */
  readonly particleBudget: number;
  /**
   * Ceiling on the drawing buffer, in pixels.
   *
   * The display is not a measure of the machine. `StageFit` scales one fixed
   * 1920x1080 surface to whatever is plugged in, and `Renderer.measure` reads
   * the post-transform rect, so without this the render resolution is decided
   * by the projector: the same laptop measured 22.9 ms at 1280x800, 30.8 ms at
   * 1080p and 76.7 ms at 4K. A defence runs once on a display nobody has seen.
   *
   * Capping costs less here than it would anywhere else, because every caption,
   * figure and label is DOM in `#overlay-layer` rather than canvas. Typography
   * stays native-sharp at any resolution and only the 3D image is resampled.
   */
  readonly maxRenderPixels: number;
}

const TIERS: Record<QualityTier, QualitySettings> = {
  safe: {
    maxPixelRatio: 1,
    shadows: false,
    shadowMapSize: 512,
    postProcessing: false,
    bloomStrength: 0,
    anisotropy: 1,
    environmentResolution: 128,
    particleBudget: 1_000,
    maxRenderPixels: 1280 * 720,
  },
  standard: {
    maxPixelRatio: 1.5,
    shadows: true,
    shadowMapSize: 1024,
    postProcessing: false,
    bloomStrength: 0,
    anisotropy: 8,
    environmentResolution: 256,
    particleBudget: 20_000,
    maxRenderPixels: 1600 * 900,
  },
  high: {
    maxPixelRatio: 2,
    shadows: true,
    shadowMapSize: 2048,
    postProcessing: true,
    bloomStrength: 0.22,
    // Ground and paving are read at grazing angles from every Act I pose, which
    // is precisely where anisotropy is the only filter that helps.
    anisotropy: 16,
    environmentResolution: 256,
    particleBudget: 80_000,
    // The deck's own surface. Rendering above the resolution it is composed at
    // resamples a 1080p composition at 2-6x the fill cost.
    maxRenderPixels: STAGE.width * STAGE.height,
  },
};

export const qualityFor = (tier: QualityTier): QualitySettings => TIERS[tier];

export const quality: QualitySettings = qualityFor(qualityTier);
