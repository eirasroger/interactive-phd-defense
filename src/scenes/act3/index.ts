import { EASE } from '@/animations/timing';
import { RISE, RUN, SECTION } from '@/config/corridor';
import { ZONE_ORIGIN } from '@/config/layout';
import { STAGE } from '@/config/presentation';
import type { CameraPose, Vec3 } from '@/engine/camera/types';
import type { SceneDefinition } from '@/engine/scene/types';
import { zoneProgressByIndex } from '@/engine/world/zoneRuns';
import { act2Scenes } from '@/scenes/act2';
import { CORRIDOR_ASSETS, corridorZone, opened } from '@/world/corridor/CorridorZone';
import { THEME_TWO } from '@/content/act3';
import { BackboneScene } from './BackboneScene';
import { ThemeScene } from './ThemeScene';
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

const overlook = (pull = 1, arc: number = OVERLOOK.arc): CameraPose => {
  const halfFrame = Math.atan(
    Math.tan((OVERLOOK.fov / 2) * DEGREES) * (STAGE.width / STAGE.height),
  );
  const distance = (RUN / OVERLOOK.fill / 2 / Math.tan(halfFrame)) * pull;
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
    arc,
  };
};

/**
 * The move refusing to stop dead.
 *
 * The theme is a two-dimensional composition and the camera has nothing left to
 * find, so this is not a camera move: it is the last few percent of the rise's
 * own easing, spent while the figure underneath it clears. A locked frame with
 * only opacity changing in it is the specific thing that reads flat, because
 * nothing in the image tells the eye it is still looking at a place. Six per
 * cent of the distance over one and nine tenths of a second is small enough
 * that nobody can name it and enough that the frame stays alive.
 *
 * No arc. A crane path over a six per cent pull is a wobble.
 *
 * The length is what brackets the dissolve: `entryDelay` is the travel less a
 * quarter second, so the composition begins arriving at 1.65 s against a
 * clearing that runs to 2.9 s, and the incoming thing starts before the
 * outgoing one has finished.
 */
const DRIFT = { pull: 1.06, seconds: 1.9 } as const;

/**
 * The dive, and why the crossing between two flat compositions is a camera move.
 *
 * From here on Act III is text over a volume, and two slides in the same volume
 * separated by a cross-dissolve are two slides. Travelling between them is the
 * one thing this deck can do that a deck cannot: the camera leaves the overlook,
 * drops out of the plan's altitude and levels off inside the sea, and the second
 * theme arrives with the bubbles still going past. It is the same mechanism as
 * every other transition in the talk, which is why it costs nothing to own.
 *
 * **Where it stops matters more than how it gets there.** Levelling out is what
 * makes the sea read as a place with a horizon rather than as a texture: at the
 * overlook the camera looks down into the volume, and here it looks along it.
 */
const DIVE = {
  seconds: 3.4,
  /** Well inside the volume, near the mouth end, on the axis. */
  eye: 26,
  /** Slightly above the eye, so the level-off has a horizon in it. */
  aim: 30,
  from: 46,
  to: -74,
  fov: 46,
} as const;

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
  /**
   * The first cross-cutting theme, and the last scene the corridor is mounted
   * for.
   *
   * `recessed` is the honest declaration even though almost nothing is left to
   * recede: the composition is the subject and the world behind it is a field.
   * It inherits `opened` so the dimming is a transform of the air the plan was
   * read through rather than a second rig that can drift away from it.
   *
   * The dissolve is not here. It belongs to the zone, because what leaves is
   * the zone's own figure, and entering this scene by a jump has to find the
   * world in the same state as walking into it.
   */
  {
    id: 'ai',
    title: 'AI as the methodological backbone',
    chapter: CHAPTER,
    zone: corridorZone.id,
    world: 'recessed',
    pose: overlook(DRIFT.pull, 0),
    air: opened,
    travel: { seconds: DRIFT.seconds, ease: EASE.camera },
    assets: [...CORRIDOR_ASSETS],
    create: () => new BackboneScene(),
  },
  /**
   * The second theme, and the dive that reaches it.
   *
   * Still in the corridor zone, because the sea is: crossing out of the zone
   * here would take the volume away and leave a cut where the move is. There is
   * no corridor left in the frame by this point, and that is the intended
   * reading of a zone whose last state is the sea it drained into.
   */
  {
    id: 'theme-two',
    title: 'Cross-cutting theme 2',
    chapter: CHAPTER,
    zone: corridorZone.id,
    world: 'recessed',
    pose: {
      position: at([0, SECTION.floor + DIVE.eye, DIVE.from]),
      target: at([0, SECTION.floor + DIVE.aim, DIVE.to]),
      fov: DIVE.fov,
    },
    air: opened,
    travel: { seconds: DIVE.seconds, ease: EASE.camera },
    assets: [...CORRIDOR_ASSETS],
    create: () => new ThemeScene(THEME_TWO),
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

for (const [id, threshold] of [
  ['whole', RISE.opens],
  ['ai', RISE.disperses],
] as const) {
  const index = corridorRun.findIndex((scene) => scene.id === id);
  if (progress[index] !== threshold) {
    throw new Error(
      `Act III: '${id}' sits at zone progress ${progress[index]}, but its threshold is ` +
        `${threshold}. Update CORRIDOR_RUN in config/corridor.ts to the corridor's ` +
        `scene count (${corridorRun.length}).`,
    );
  }
}
