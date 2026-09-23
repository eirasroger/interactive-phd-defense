import { STAGE } from '@/config/presentation';
import { qualityTier, type QualityTier } from '@/engine/env';

/** Render settings per quality tier. `env.ts` picks the tier. */
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
   * Maximum drawing buffer size, in pixels. Without it the projector decides
   * the render resolution (the same laptop took 22.9 ms at 1280x800 and 76.7 ms
   * at 4K). Text is DOM, so only the 3D image is resampled.
   */
  readonly maxRenderPixels: number;
  /**
   * Ray-march steps through the opening cloud, and light samples toward the sun
   * per step. Compile-time constants in the shader. Aliasing is handled by the
   * mipmapped density field, so more steps add little.
   */
  readonly cloudSteps: number;
  readonly cloudLightSteps: number;
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
    cloudSteps: 18,
    cloudLightSteps: 2,
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
    cloudSteps: 26,
    cloudLightSteps: 2,
  },
  high: {
    maxPixelRatio: 2,
    shadows: true,
    shadowMapSize: 2048,
    postProcessing: true,
    bloomStrength: 0.22,
    // Act I views the ground at grazing angles, where anisotropic filtering helps most.
    anisotropy: 16,
    environmentResolution: 256,
    particleBudget: 80_000,
    cloudSteps: 34,
    cloudLightSteps: 3,
    // The 1920x1080 stage size. Rendering above it only adds fill cost.
    maxRenderPixels: STAGE.width * STAGE.height,
  },
};

export const qualityFor = (tier: QualityTier): QualitySettings => TIERS[tier];

export const quality: QualitySettings = qualityFor(qualityTier);
