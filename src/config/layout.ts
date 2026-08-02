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
  demo: [0, 0, 0] as Vec3,
} as const;
