import type { Vec3 } from '@/engine/camera/types';

/**
 * The site, in world units.
 *
 * The building's *form* is owned by `tools/blender/exterior_building.py` and
 * arrives as a baked GLB. What lives here is only what the runtime also needs:
 * the dimensions camera poses and the shadow frustum are derived from.
 *
 * **These must agree with the Blender script.** Blender is Z-up and builds the
 * building facing -Y; glTF y-up export maps Blender (x, y, z) to (x, z, -y), so
 * the building faces +Z here — the direction the camera approaches from.
 */

export const SITE = {
  groundSize: 900,
  gridSize: 640,
  gridDivisions: 128,
} as const;

/** Overall height of the massing. Sizes the shadow frustum and the framing. */
export const BUILDING_HEIGHT = 20.4;

/**
 * The main entrance, on the podium's +Z face.
 *
 * This is the hinge between Act I and Act II: the last shot of the exterior is
 * square to this opening, and the corridor begins behind it. Keeping it as a
 * named constant means the Act I camera and the Act II threshold are derived
 * from one position rather than two that can drift.
 */
export const ENTRANCE = {
  width: 6.4,
  height: 3.6,
  /** Centre of the opening. */
  position: [0, 1.8, 10] as Vec3,
  /** How far the canopy projects past the facade. */
  canopyDepth: 2.6,
} as const;
