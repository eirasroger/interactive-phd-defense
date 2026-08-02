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
  /** Camera travel between adjacent scenes. */
  cameraSeconds: 1.9,
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
