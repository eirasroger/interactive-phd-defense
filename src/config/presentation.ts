import type { CameraPose } from '@/engine/camera/types';

/**
 * Global presentation constants. Values that scenes are expected to share
 * live here rather than being restated per scene.
 */

export const CAMERA_DEFAULTS = {
  fov: 42,
  near: 0.1,
  far: 400,
} as const;

/** Where the camera sits before any scene has declared a pose. */
export const ORIGIN_POSE: CameraPose = {
  position: [0, 2.5, 12],
  target: [0, 0, 0],
  fov: CAMERA_DEFAULTS.fov,
};

export const TRANSITION = {
  /**
   * Camera travel between adjacent scenes, **paced by the move** rather than
   * fixed.
   *
   * One duration for every transition is the reason the act made people
   * queasy. Act I's moves range from a five-metre step down the avenue to a
   * ninety-metre glide over the lake and a hundred-degree turn out of the
   * park, so one fixed duration runs the long moves four times faster than the
   * short ones. The eye tracks *angular* rate, so a fast pan is more
   * disorienting than a fast dolly: the two are budgeted separately and
   * whichever needs longer wins.
   *
   * Both rates are deliberately unhurried. 34 m/s is a low pass rather than a
   * flight, and 24°/s is about as fast as a camera can turn before the scene
   * smears rather than sweeps.
   */
  camera: {
    metresPerSecond: 34,
    degreesPerSecond: 24,
    /** Nothing snaps and nothing outstays the presenter. */
    minSeconds: 1.8,
    maxSeconds: 4.5,
  },
  /** Content dissolve, shorter so the world reads as continuous. */
  contentSeconds: 0.55,
  /** Direct navigation still eases, just fast enough to feel like a cut. */
  jumpSeconds: 0.7,
} as const;

/*
 * Background, fog and lighting are no longer global constants. They belong to
 * whichever zone is mounted — see `world/zones.ts` — because a dusk exterior
 * and a lit interior cannot share one set of values.
 */

/** Sustained FPS below this triggers an automatic quality step-down. */
export const ADAPTIVE = {
  sampleSeconds: 3,
  degradeBelowFps: 45,
  minPixelRatio: 0.75,
} as const;
