import type { Vec3 } from '@/engine/camera/types';

/**
 * World origin of each zone. Zones sit farther apart than the fog distance, so
 * none is visible from another. Do not move an origin: every camera pose in a
 * zone is authored relative to it.
 */
export const ZONE_ORIGIN = {
  exterior: [0, 0, 200] as Vec3,
  /**
   * Exception: the corridor sits inside the exterior, since the camera walks in
   * through the building door. The origin is the mouth of the vestibule recess
   * (site z -2.6), so the corridor's first 3 m overlap the recess with no gap.
   * Its section is 200 mm smaller, so its walls and ceiling show over the
   * overlap; the floor hands over at the recess end (see `SECTION.nest`).
   * `ZoneDirector` mounts both zones only during the crossing.
   */
  corridor: [0, 0, 197.4] as Vec3,
} as const;
