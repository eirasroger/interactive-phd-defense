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
  },
  standard: {
    maxPixelRatio: 1.5,
    shadows: true,
    shadowMapSize: 1024,
    postProcessing: false,
    bloomStrength: 0,
    anisotropy: 4,
    environmentResolution: 256,
    particleBudget: 20_000,
  },
  high: {
    maxPixelRatio: 2,
    shadows: true,
    shadowMapSize: 2048,
    postProcessing: true,
    bloomStrength: 0.22,
    anisotropy: 8,
    environmentResolution: 256,
    particleBudget: 80_000,
  },
};

export const qualityFor = (tier: QualityTier): QualitySettings => TIERS[tier];

export const quality: QualitySettings = qualityFor(qualityTier);
