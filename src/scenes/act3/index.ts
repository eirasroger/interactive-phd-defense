import { EASE } from '@/animations/timing';
import { RISE, RUN, SECTION } from '@/config/corridor';
import { ZONE_ORIGIN } from '@/config/layout';
import { STAGE } from '@/config/presentation';
import type { CameraPose, Vec3 } from '@/engine/camera/types';
import type { SceneDefinition } from '@/engine/scene/types';
import { zoneProgressByIndex } from '@/engine/world/zoneRuns';
import { act2Scenes } from '@/scenes/act2';
import { CORRIDOR_ASSETS, corridorZone, opened } from '@/world/corridor/CorridorZone';
import { RiseScene } from './RiseScene';

const CHAPTER = 'Act III — The Overlook';

/**
 * The climb, and why it is this long.
 *
 * Eighty metres of travel and a ninety-degree change of heading, and the deck's
 * pacing would give it four and a half seconds. It is one of three spectacle
 * beats in the talk and the only one that is pure camera, so it is timed to be
 * watched rather than paced — but only just. Everything the move contains is
 * over by six seconds, and a move that outlasts its own content is a presenter
 * standing in silence waiting for a camera.
 */
const RISE_SECONDS = 7.5;

/**
 * Where the plan is read from.
 *
 * Derived from the run rather than authored, so moving a column in
 * `corridorPlan.json` reframes the shot with the building.
 *
 * **Off the axis, not above it.** Standing over the middle and rolling ninety
 * degrees puts the camera's look direction along its own up vector, which is
 * the one orientation `lookAt` cannot resolve. Coming at the plan from the east
 * gets the same reading for free — the run projects horizontally across the
 * frame, C1 at the left and C5 at the right exactly as `ContributionMap` drew
 * it one click before the audience walked in, and the near side of the frame is
 * the low lane, so C3 sits above C4 as it does in the drawing.
 *
 * **Steep, and on a long lens.** The oblique version of this shot was authored
 * while the building was still a building, where perspective was doing useful
 * work — walls with thickness, rooms with depth. Against a drawing it does the
 * opposite: divergence shears every rectangle into a parallelogram, and a plan
 * that leans is a plan nobody can read a topology off. 76° and a 34° lens is as
 * near orthographic as a perspective camera gets before the distance stops
 * being worth it.
 *
 * `aim` lifts the look point off the floor so the figure sits below the middle
 * of the frame, under the claim rather than through it.
 */
const OVERLOOK = {
  fill: 0.8,
  elevation: 76,
  fov: 34,
  aim: 16,
  /** A crane move, not a diagonal: the lift clears the roof before the retreat. */
  arc: 9,
} as const;

const DEGREES = Math.PI / 180;

const at = ([x, y, z]: Vec3): Vec3 => [
  x + ZONE_ORIGIN.corridor[0],
  y + ZONE_ORIGIN.corridor[1],
  z + ZONE_ORIGIN.corridor[2],
];

const overlook = (): CameraPose => {
  const halfFrame = Math.atan(
    Math.tan((OVERLOOK.fov / 2) * DEGREES) * (STAGE.width / STAGE.height),
  );
  const distance = RUN / OVERLOOK.fill / 2 / Math.tan(halfFrame);
  const elevation = OVERLOOK.elevation * DEGREES;
  const middle = -RUN / 2;

  return {
    position: at([
      Math.cos(elevation) * distance,
      Math.sin(elevation) * distance + SECTION.floor,
      middle,
    ]),
    target: at([0, SECTION.floor + OVERLOOK.aim, middle]),
    fov: OVERLOOK.fov,
    arc: OVERLOOK.arc,
  };
};

/**
 * Act III opens inside Act II's world, and that is the whole point.
 *
 * The scene stays in the corridor zone: the corridor is the subject, not the
 * place the subject is in. What changes is the pose, the air and the ceiling —
 * and the flow, which has been running since C1 and is what makes the plan view
 * a system already in motion rather than a diagram being drawn.
 */
export const act3Scenes: readonly SceneDefinition[] = [
  {
    id: 'whole',
    title: 'The pipeline, whole',
    chapter: CHAPTER,
    zone: corridorZone.id,
    world: 'foreground',
    pose: overlook(),
    air: opened,
    travel: { seconds: RISE_SECONDS, ease: EASE.camera },
    assets: [...CORRIDOR_ASSETS],
    create: () => new RiseScene(),
  },
];

/**
 * The ceiling comes off at the end of the corridor's run, and the deck is what
 * decides where the end is.
 *
 * `RISE.opens` is zone progress, so inserting a scene anywhere in Act II moves
 * it. Left to drift it fails the worst way round: the lids lift on a station
 * scene with the camera inside the building, watching the roof leave.
 */
const corridorRun = [...act2Scenes, ...act3Scenes];
const progress = zoneProgressByIndex(corridorRun);
const rise = corridorRun.findIndex((scene) => scene.id === 'whole');

if (progress[rise] !== RISE.opens) {
  throw new Error(
    `Act III: 'whole' sits at zone progress ${progress[rise]}, but RISE.opens is ` +
      `${RISE.opens}. Update RISE in config/corridor.ts to match the deck.`,
  );
}
