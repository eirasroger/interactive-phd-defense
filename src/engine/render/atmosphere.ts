import type { Vec3 } from '@/engine/camera/types';

/**
 * The world's light and air, expressed as data.
 *
 * Atmosphere is to lighting what `CameraPose` is to the camera: a zone declares
 * a target and a director works out how to reach it. That is what lets one
 * persistent scene graph hold a dusk exterior and a lit interior without
 * rebuilding anything, and it is the mechanism `recessed` mode is built from.
 */
export interface Atmosphere {
  readonly fogColor: number;
  readonly fogNear: number;
  readonly fogFar: number;
  /** Hemisphere light, upper half. */
  readonly skyColor: number;
  /** Hemisphere light, lower half — bounce off the ground. */
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
 * The `recessed` variant of an atmosphere.
 *
 * Fog closes, the key drops and exposure falls, so the world becomes a dim
 * depth field behind the text without a blur pass. Derived rather than authored
 * twice: a recessed scene is never a separately tuned lighting rig that can
 * drift away from the zone it belongs to.
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
