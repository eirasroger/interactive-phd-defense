export type Vec3 = readonly [number, number, number];

/**
 * A camera pose is data, not an animation.
 *
 * Scenes declare where the camera should be; the director works out how to get
 * there. This is what allows the same scene to be reached by a cinematic move
 * (sequential navigation) or an instant snap (direct navigation) without the
 * scene knowing or caring which happened.
 */
export interface CameraPose {
  readonly position: Vec3;
  readonly target: Vec3;
  readonly fov?: number;
  /**
   * Height of the arc the camera travels along when moving to this pose.
   * Straight lines between poses read as mechanical; a slight lift reads as
   * a crane move. 0 keeps the move perfectly linear.
   */
  readonly arc?: number;
  /** Roll in radians. Used sparingly — it is disorienting in large doses. */
  readonly roll?: number;
}

export interface CameraMoveOptions {
  readonly seconds: number;
  readonly ease?: string;
}
