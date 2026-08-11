import { ZONE_ORIGIN } from '@/config/layout';
import { AT_THRESHOLD, DOORS_AT } from '@/animations/entry';
import type { Vec3 } from '@/engine/camera/types';
import type { SceneDefinition } from '@/engine/scene/types';
import { corridorZone } from '@/world/corridor/CorridorZone';
import { ENTRANCE_LEAF_STAGGER, ENTRANCE_TRAVEL_SECONDS } from '@/world/exterior/entrance';
import { THRESHOLD_Z } from '@/world/exterior/site';
import { ThresholdScene } from './ThresholdScene';

const CHAPTER = 'Act II — The Corridor';

/**
 * How long the entry takes.
 *
 * Long, and it has to be. The camera leaves `contributions` about fifty metres
 * short of the door and comes to rest ten metres inside the corridor, which is
 * seventy-five metres of travel through two worlds — and
 * `TRANSITION.camera.maxSeconds` caps every ordinary move at 4.5 s. At that
 * length this is a flight at a wall.
 *
 * Nine seconds is not nine seconds of the same thing: `animations/entry.ts`
 * spends the first third covering the avenue and the remaining two thirds
 * decelerating through the doors, the vestibule and into the corridor. What the
 * audience watches is a fast approach and a long arrival.
 */
const ENTRY_SECONDS = 9.0;

/** Site coordinates, lifted into the world — the corridor's own origin. */
const at = ([x, y, z]: Vec3): Vec3 => [
  x + ZONE_ORIGIN.corridor[0],
  y + ZONE_ORIGIN.corridor[1],
  z + ZONE_ORIGIN.corridor[2],
];

/**
 * Act II, standing in.
 *
 * One scene, whose only job is to be somewhere for the transition to land. The
 * sixteen real ones are blocked on the pipeline plan drawing and nothing here
 * anticipates them: the pose is on the corridor's axis because a corridor has
 * one, and that is the whole of the commitment.
 */
export const act2Scenes: readonly SceneDefinition[] = [
  {
    id: 'threshold',
    title: 'Inside',
    chapter: CHAPTER,
    zone: corridorZone.id,
    world: 'foreground',
    // Ten metres in, at eye height, looking down the run. Slightly off the
    // axis, so the receding ceiling slots sit right of centre and the text
    // column has the left — the composition rule the whole deck is built on.
    pose: {
      position: at([-1.2, 1.72, -13]),
      target: at([-1.2, 1.58, -37]),
      fov: 50,
    },
    crossing: {
      seconds: ENTRY_SECONDS,
      // The exterior stops being drawn two metres inside the opening, where the
      // vestibule's own walls fill the frame. In world coordinates, because
      // that is what the camera's position is in.
      releaseAtZ: THRESHOLD_Z + ZONE_ORIGIN.exterior[2],
    },
    create: () => new ThresholdScene(),
  },
];

/**
 * The leaves must finish before the camera arrives at them.
 *
 * Asserted rather than trusted, because the three numbers involved live in
 * three files for good reasons and none of them is obviously about the others:
 * the door's travel is a property of a door, the fraction it starts at is a
 * property of the speed profile, and the length of the move is a property of
 * this deck's geography. Change any one and the failure is a camera flying
 * through a half-open door — which is visible for about four frames and looks
 * like a rendering glitch rather than a timing bug.
 */
function assertDoorsClear(seconds: number): void {
  const clear = DOORS_AT * seconds + ENTRANCE_TRAVEL_SECONDS + ENTRANCE_LEAF_STAGGER;
  const arrival = AT_THRESHOLD * seconds;
  if (clear >= arrival) {
    throw new Error(
      `Act II: the doors finish at ${clear.toFixed(2)}s but the camera reaches them at ` +
        `${arrival.toFixed(2)}s. Lengthen the crossing, shorten ENTRANCE_TRAVEL_SECONDS, ` +
        `or lower DOORS_AT.`,
    );
  }
}

assertDoorsClear(ENTRY_SECONDS);
