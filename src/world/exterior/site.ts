import type { Vec3 } from '@/engine/camera/types';

/**
 * The site, in world units.
 *
 * The building's *form* is owned by `tools/blender/exterior_building.py` and
 * arrives as baked GLBs. What lives here is only what the runtime also needs:
 * the dimensions camera poses and the shadow frustum are derived from.
 *
 * **These must agree with the Blender script.** Blender is Z-up and builds the
 * building facing -Y; glTF y-up export maps Blender (x, y, z) to (x, z, -y), so
 * the building faces +Z here — the direction the camera approaches from.
 */

export const SITE = {
  groundSize: 900,
} as const;

/** Overall height of the massing, parapet cap included. */
export const BUILDING_HEIGHT = 16.95;

/** Width across the elevation, and the bay module it is composed from. */
export const BUILDING_WIDTH = 33.6;
export const BAY = 4.2;

/**
 * The main entrance, on the +Z face.
 *
 * This is the hinge between Act I and Act II: the last shot of the exterior is
 * square to this opening, and the corridor begins behind it. Keeping it as a
 * named constant means the Act I camera and the Act II threshold are derived
 * from one position rather than two that can drift.
 *
 * It sits in the recessed ground floor, so `position.z` is the set-back wall
 * line and not the face of the mass above it.
 */
export const ENTRANCE = {
  width: 6.4,
  height: 3.2,
  /** Centre of the opening, on the set-back ground-floor wall. */
  position: [0, 1.6, 6.4] as Vec3,
  /** How far the mass above oversails the entrance wall. */
  oversail: 1.6,
  /** How far the canopy projects past the column line, toward the camera. */
  canopyProud: 1.4,
} as const;

/**
 * The specification slot — one bay of brick cladding never placed.
 *
 * Act I's device, and the only part of the building that differs between Act I
 * and Act IV. The bay is permanently unclad in `exterior-building.glb`; the
 * cladding that fills it in Act IV is `facadeSlotFill`, a separate asset.
 *
 * Three Act I scenes are framed on it and Act IV returns to it, so it is a
 * named position rather than a number repeated in four camera poses.
 */
export const SLOT = {
  width: BAY,
  height: 12.4,
  /** Centre of the vacant bay, on the brick face. */
  position: [-10.5, 10.2, 8] as Vec3,
} as const;

/**
 * The public realm, as bands running parallel to the elevation.
 *
 * No carriageway and no kerbs: the building stands in a pedestrian park, so the
 * approach is a promenade wide enough to read as public space rather than as a
 * pavement. Values are the +Z distances of each band's far edge from the origin,
 * and must agree with `build_paving()` in the Blender script — the same ground
 * is lit there and rebuilt here.
 *
 * It is rebuilt in Three.js rather than exported because it is six boxes whose
 * materials tile in world metres, which glTF has no way to carry.
 */
export const REALM = {
  /** Paved forecourt, from the building face out. */
  forecourtFar: 22.6,
  /** Planting beds, inset from the entrance path. */
  bedNear: 17.0,
  pathHalfWidth: 3.6,
  halfWidth: 25.0,
  /** Pedestrian promenade. Nothing may be planted inside this band. */
  promenadeFar: 31.1,
  vergeFar: 34.1,
  run: 600.0,
} as const;

/**
 * The review row — where the four options stand, far west of the building.
 *
 * They used to hang in the air overlapping the vacant bay, which asked one
 * shot to carry the building, the slot and four alternatives at once. They then
 * stood close enough that Act I's westward poses kept catching them at a frame
 * edge, and keeping the building's corner in their own shot forced a 43 m
 * standoff that left them small.
 *
 * Out here neither constraint applies. No other pose can reach them, so the
 * travel on and off is genuinely unobserved, and their own camera comes in to
 * 30 m. Nothing of the building is in that frame; the link back to the vacant
 * bay is carried by the scenes either side, which are both on it.
 *
 * Positions are baked into `facade-candidates.glb`; what lives here is the
 * travel. They enter from off the west edge of frame and leave the same way,
 * so nothing is ever seen appearing or vanishing on the spot. Must agree with
 * `REVIEW` in the Blender script.
 */
export const REVIEW = {
  count: 4,
  /** Centre of the row, on the ground plane. */
  centre: [-95.0, 3.7, 27.0] as Vec3,
  /** How far south of the row its own camera stands, and how far west it aims. */
  standoff: 30,
  lead: 4,
  spacing: 5.6,
  /** How far west of their resting place the panels park, in metres. */
  offstage: 52,
  /**
   * Extra travel per panel, so the row assembles and disperses in sequence
   * rather than sliding as one rigid object. Applied east to west, so the
   * panel nearest the building arrives first and the row builds away from it —
   * the reverse would have the far panels crossing through the near ones.
   */
  stagger: 9,
  /**
   * The span of zone progress over which the row stands on site.
   *
   * It opens a scene *before* the options are looked at and closes a scene
   * after, and that is the whole point. The panels travel at the moment the
   * span opens and closes, which is a moment the camera is settled on the
   * building with the review row well outside the frustum — so they are only
   * ever seen standing, never seen arriving.
   *
   * Act I's scene order decides these numbers, so `act1/index.ts` asserts the
   * deck still agrees with them. Insert a scene anywhere before `practice` and
   * the row would otherwise stay parked off frame for the whole act, with the
   * scene that argues about it playing to an empty promenade.
   */
  from: 0.4,
  to: 0.7,
} as const;
