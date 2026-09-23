import type { CameraPose } from '@/engine/camera/types';

/** Global presentation constants shared by all scenes. */

/**
 * Design surface in pixels. The stage scales to fit the display, so layout
 * never reflows. Non-16:9 displays letterbox.
 */
export const STAGE = {
  width: 1920,
  height: 1080,
} as const;

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
   * Camera travel between adjacent scenes, timed by distance and turn angle.
   * Each rate gives a duration and the longer one wins, so long moves and
   * fast pans stay comfortable to watch.
   */
  camera: {
    metresPerSecond: 34,
    degreesPerSecond: 24,
    /** Clamp on the computed duration. */
    minSeconds: 1.8,
    maxSeconds: 4.5,
  },
  /**
   * Old content leaves at once and new content arrives as the camera settles.
   * `seconds` must match `--d-content` in tokens.css.
   */
  content: {
    seconds: 0.55,
    /** Seconds before the camera stops. */
    settle: 0.25,
    minLeadSeconds: 0.2,
  },
  /** Direct navigation still eases, just fast enough to feel like a cut. */
  jumpSeconds: 0.7,
} as const;

/* Background, fog and lighting are set per zone in `world/zones.ts`. */

/** Sustained FPS below this triggers an automatic quality step-down. */
export const ADAPTIVE = {
  sampleSeconds: 3,
  degradeBelowFps: 45,
  minPixelRatio: 0.75,
} as const;
