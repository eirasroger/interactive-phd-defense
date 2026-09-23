import type { Vec3 } from '@/engine/camera/types';

/**
 * Lighting and fog as data. A zone declares a target atmosphere and a director
 * blends to it, like `CameraPose` for the camera.
 */
export interface Atmosphere {
  readonly fogColor: number;
  readonly fogNear: number;
  readonly fogFar: number;
  /** Hemisphere light, upper half. */
  readonly skyColor: number;
  /** Hemisphere light, lower half (ground bounce). */
  readonly groundColor: number;
  readonly ambientIntensity: number;
  readonly keyColor: number;
  readonly keyIntensity: number;
  /** Key light position relative to the zone origin, so shadows follow the zone. */
  readonly keyOffset: Vec3;
  readonly environmentIntensity: number;
  readonly backgroundIntensity: number;
  readonly exposure: number;
}

/**
 * Dimmed variant of a zone's atmosphere for text slides: closer fog, weaker
 * key light, lower exposure. Derived from the base so the two stay in sync.
 */
export const recessed = (base: Atmosphere): Atmosphere => ({
  ...base,
  fogNear: base.fogNear * 0.25,
  fogFar: base.fogNear + (base.fogFar - base.fogNear) * 0.4,
  ambientIntensity: base.ambientIntensity * 0.7,
  keyIntensity: base.keyIntensity * 0.45,
  environmentIntensity: base.environmentIntensity * 0.55,
  backgroundIntensity: base.backgroundIntensity * 0.5,
  exposure: base.exposure * 0.7,
});

/**
 * Variant for the opening, inside the cloud. Derived from the zone's
 * atmosphere like `recessed`. Exposure changes little because `CloudShell` is
 * drawn outside the tone curve.
 *
 * `fogColor` must match the panorama's eye-level colour in `CloudShell`, or a
 * seam shows across the frame.
 */
export const clouded = (base: Atmosphere): Atmosphere => ({
  ...base,
  fogColor: 0xdbe6f2,
  // Long fog range. The cloud deck hides the world; fog only adds distance haze.
  fogNear: 55,
  fogFar: 620,
  ambientIntensity: base.ambientIntensity * 1.35,
  keyIntensity: base.keyIntensity * 0.25,
  environmentIntensity: base.environmentIntensity * 1.2,
  backgroundIntensity: base.backgroundIntensity,
  exposure: base.exposure * 1.08,
});
