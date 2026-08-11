import type { Vec3 } from '@/engine/camera/types';

/**
 * Where each zone sits in the shared world.
 *
 * Zones are separated by far more than the fog can see through, so one is never
 * visible from another and each can be composed for itself rather than for
 * continuity with its neighbour. Continuity is the camera's job, not the
 * layout's.
 *
 * The engine-demo content keeps the span it was scaffolded into (0 to -130);
 * thesis zones are placed beyond it so the two can coexist until the demos are
 * retired.
 */
export const ZONE_ORIGIN = {
  exterior: [0, 0, 200] as Vec3,
  /**
   * Inside the exterior, and that is the one exception to the rule above.
   *
   * Every other zone is placed beyond the fog so it cannot be seen from its
   * neighbour. The corridor is entered by walking through a door in the
   * building, so for the length of that move the two are the same place and
   * their geometry has to line up to the centimetre.
   *
   * The origin is the **mouth** of the vestibule's recess — site z −2.6, lifted
   * by the exterior's own origin — so the corridor's first three metres are
   * nested inside the recess rather than starting where the recess ends. That
   * overlap is what removes the gap: the two worlds are continuous the whole way
   * through the handover, and the exterior can be released anywhere inside it
   * without a metre of nothing appearing. The corridor's section is 200 mm
   * under the recess's so the two sets of surfaces never contend.
   *
   * Nothing else in the deck may rely on the two being separable. `ZoneDirector`
   * mounts both only for the crossing and releases the exterior as the camera
   * passes the threshold.
   */
  corridor: [0, 0, 197.4] as Vec3,
  demo: [0, 0, 0] as Vec3,
} as const;
