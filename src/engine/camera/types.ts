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
  /**
   * Overrides the paced duration.
   *
   * Left out for ordinary navigation, where the director works the length out
   * from how far the move travels and how far it turns — see `paceOf`. A fixed
   * number here is for moves that have to hit a mark regardless of their size,
   * which in practice means the jump cut.
   */
  readonly seconds?: number;
  readonly ease?: string;
}
