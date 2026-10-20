import { EASE } from '@/animations/timing';
import { RISE, RUN, SECTION } from '@/config/corridor';
import { ZONE_ORIGIN } from '@/config/layout';
import { STAGE } from '@/config/presentation';
import type { CameraPose, Vec3 } from '@/engine/camera/types';
import type { SceneDefinition } from '@/engine/scene/types';
import { zoneProgressByIndex } from '@/engine/world/zoneRuns';
import { act1Captions } from '@/content/act1';
import { act2Scenes } from '@/scenes/act2';
import { ExteriorScene } from '@/scenes/act1/ExteriorScene';
import { CORRIDOR_ASSETS, corridorZone, opened } from '@/world/corridor/CorridorZone';
import { BackboneScene } from './BackboneScene';
import { ConclusionsScene } from './ConclusionsScene';
import { DiscussionScene } from './DiscussionScene';
import { RiseScene } from './RiseScene';

/** Thesis section names shown in the progress bar. */
const CHAPTER = {
  pipeline: 'Integrated pipeline',
  crossCutting: 'Cross-cutting theme',
  discussion: 'Discussion',
  conclusions: 'Conclusions',
} as const;

/**
 * Duration of the climb in seconds. The move covers 80 m and a 90° turn, and
 * all of it finishes by about 6 s.
 */
const RISE_SECONDS = 7.5;

/**
 * Overhead plan view, derived from the corridor run so it follows
 * `corridorPlan.json`.
 *
 * The camera sits east of the plan: straight overhead makes the look direction
 * parallel to up, which `lookAt` cannot resolve. From the east, C1 is on the
 * left and C5 on the right, matching `ContributionMap`.
 *
 * Steep angle and narrow lens keep the plan close to orthographic.
 * `aim` raises the look point so the figure sits below frame centre.
 */
const OVERLOOK = {
  fill: 0.8,
  elevation: 76,
  fov: 34,
  aim: 16,
  /** Crane arc: the lift clears the roof before the camera pulls back. */
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
 * Small pull-back (6% over 1.9 s) so the frame keeps moving while the plan
 * clears. No arc: at this distance an arc looks like a wobble.
 *
 * The duration brackets the dissolve: the composition starts arriving at
 * 1.65 s (`entryDelay` is travel minus 0.25 s) and the clearing runs to 2.9 s.
 */
const DRIFT = { pull: 1.06, seconds: 1.9 } as const;

/**
 * Descent from the overlook into the sea, levelling off inside the volume to
 * look along it, so the frame has a horizon.
 */
const DIVE = {
  seconds: 3.6,
  eye: 21,
  /** Slightly above the eye, so the level-off has a horizon. */
  aim: 24,
  from: -36,
  to: -158,
  fov: 46,
} as const;

/**
 * Rise out of the sea to look down on the plan again, echoing the act's
 * opening shot with only the five points left.
 */
const ASCENT = {
  seconds: 4.6,
  /** Well above the volume. */
  eye: 58,
  /** Below the eye, so the camera settles looking down. */
  aim: 28,
  from: -150,
  to: -238,
  fov: 42,
} as const;

/**
 * Final shot under the returning title card: drops back into the volume,
 * moves along it and widens the lens. At the ascent's altitude the frame
 * would be empty.
 */
const CLOSE = {
  seconds: 5,
  /** Back inside the volume, above the dive's level-off height. */
  eye: 34,
  /** Level with the eye, so the field shows a horizon. */
  aim: 31,
  from: -120,
  to: -250,
  fov: 50,
} as const;

/**
 * Act III stays in the corridor zone. Only the pose, air and ceiling change.
 * The flow keeps running from C1, so the plan view shows a system in motion.
 */
export const act3Scenes: readonly SceneDefinition[] = [
  {
    id: 'whole',
    title: 'The pipeline, whole',
    chapter: CHAPTER.pipeline,
    zone: corridorZone.id,
    world: 'foreground',
    pose: overlook(),
    air: opened,
    travel: { seconds: RISE_SECONDS, ease: EASE.camera },
    assets: [...CORRIDOR_ASSETS],
    create: () => new RiseScene(),
  },
  /**
   * The cross-cutting theme, and the last scene with the corridor mounted.
   * Uses `opened` air so the dimming derives from the plan view's air.
   * The dissolve lives in the zone, so a jump here finds the same world state.
   */
  {
    id: 'ai',
    title: 'Artificial intelligence across the pipeline',
    chapter: CHAPTER.crossCutting,
    zone: corridorZone.id,
    world: 'recessed',
    pose: overlook(DRIFT.pull, 0),
    air: opened,
    travel: { seconds: DRIFT.seconds, ease: EASE.camera },
    assets: [...CORRIDOR_ASSETS],
    create: () => new BackboneScene(),
  },
  /**
   * Discussion, reached by the dive. Stays in the corridor zone because the sea
   * volume belongs to it; leaving the zone would cut the move.
   */
  {
    id: 'discussion',
    title: 'Implications, limitations, and future work',
    chapter: CHAPTER.discussion,
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
    create: () => new DiscussionScene(),
  },
  /**
   * Conclusions. The five points sit where `corridorPlan.json` puts the five
   * rooms, and the ascent needs the zone's volume, so it stays in the corridor.
   */
  {
    id: 'conclusions',
    title: 'Conclusions',
    chapter: CHAPTER.conclusions,
    zone: corridorZone.id,
    world: 'recessed',
    pose: {
      position: at([0, SECTION.floor + ASCENT.eye, ASCENT.from]),
      target: at([0, SECTION.floor + ASCENT.aim, ASCENT.to]),
      fov: ASCENT.fov,
    },
    air: opened,
    travel: { seconds: ASCENT.seconds, ease: EASE.camera },
    assets: [...CORRIDOR_ASSETS],
    create: () => new ConclusionsScene(),
  },
  /** Closing title card, reusing the opening composition from `content/act1.ts`. */
  {
    id: 'close',
    title: 'Thank you',
    chapter: CHAPTER.conclusions,
    zone: corridorZone.id,
    world: 'recessed',
    pose: {
      position: at([0, SECTION.floor + CLOSE.eye, CLOSE.from]),
      target: at([0, SECTION.floor + CLOSE.aim, CLOSE.to]),
      fov: CLOSE.fov,
    },
    air: opened,
    travel: { seconds: CLOSE.seconds, ease: EASE.camera },
    assets: [...CORRIDOR_ASSETS],
    create: () => new ExteriorScene(act1Captions.overview),
  },
];

/**
 * Checks that `RISE.opens` and `RISE.disperses` (zone progress) still land on
 * the right scenes. Adding a scene to Act II shifts them, and the roof would
 * then lift during a station scene.
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
