export type Vec3 = readonly [number, number, number];

/**
 * Where the camera should be. The director decides how to get there: an
 * animated move for sequential navigation or an instant snap for direct jumps.
 */
export interface CameraPose {
  readonly position: Vec3;
  readonly target: Vec3;
  readonly fov?: number;
  /** Height of the arc the camera travels on to reach this pose. 0 is a straight line. */
  readonly arc?: number;
  /** Roll in radians. Use sparingly. */
  readonly roll?: number;
  /** `lead` looks along the direction of travel, turning onto the target on arrival. */
  readonly approach?: 'direct' | 'lead';
  /** A point the move routes through, so a walk can follow the corridor. */
  readonly via?: Vec3;
}

export interface CameraMoveOptions {
  /**
   * Fixed duration in seconds. When omitted, `paceOf` derives it from the
   * distance and turn. Used for moves that must hit a fixed timing, such as
   * the jump cut.
   */
  readonly seconds?: number;
  /**
   * A named GSAP ease, or a function of normalised time. The function form
   * supports moves authored as speed profiles (see `animations/entry.ts`).
   * Ordinary moves use one symmetric curve.
   */
  readonly ease?: string | ((t: number) => number);
}
