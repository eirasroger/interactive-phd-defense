import { EASE } from '@/animations/timing';
import { ZONE_ORIGIN } from '@/config/layout';
import { act1Captions } from '@/content/act1';
import type { CameraPose, Vec3 } from '@/engine/camera/types';
import { clouded } from '@/engine/render/atmosphere';
import type { SceneDefinition } from '@/engine/scene/types';
import { zoneProgressByIndex } from '@/engine/world/zoneRuns';
import { EXTERIOR_ASSETS, exteriorZone } from '@/world/exterior/ExteriorZone';
import { CROSSING } from '@/world/exterior/paths';
import { AVENUE, CONSTRUCTION, ENTRANCE, REVIEW } from '@/world/exterior/site';
import { AssessmentScene } from './AssessmentScene';
import { CircularEconomyScene } from './CircularEconomyScene';
import { ContentsScene } from './ContentsScene';
import { ContributionsScene } from './ContributionsScene';
import { EpdScene } from './EpdScene';
import { ExteriorScene } from './ExteriorScene';
import { GapsScene } from './GapsScene';
import { OpeningScene } from './OpeningScene';
import { LeverageScene } from './LeverageScene';
import { MotivationScene } from './MotivationScene';
import { ObjectivesScene } from './ObjectivesScene';
import { PracticeScene } from './PracticeScene';

/** Thesis section names shown in the progress bar. */
const CHAPTER = {
  opening: 'Introduction',
  motivation: 'Motivation · Research context',
  state: 'State of the art',
  gaps: 'Research gaps',
  objectives: 'Objectives',
  contributions: 'Contributions',
} as const;

/** Converts site coordinates to world coordinates. */
const at = ([x, y, z]: Vec3): Vec3 => [
  x + ZONE_ORIGIN.exterior[0],
  y + ZONE_ORIGIN.exterior[1],
  z + ZONE_ORIGIN.exterior[2],
];

const pose = (position: Vec3, target: Vec3, fov: number, arc = 0): CameraPose => ({
  position: at(position),
  target: at(target),
  fov,
  arc,
});

const scene = (
  id: string,
  title: string,
  chapter: string,
  world: 'foreground' | 'recessed',
  cameraPose: CameraPose,
  caption: (typeof act1Captions)[keyof typeof act1Captions],
): SceneDefinition => ({
  id,
  title,
  chapter,
  zone: exteriorZone.id,
  world,
  pose: cameraPose,
  assets: [...EXTERIOR_ASSETS],
  create: () => new ExteriorScene(caption),
});

/**
 * Z at a fraction (0 to 1) of the way from the avenue start to the bridge.
 * Derived from `CROSSING` so it follows the river if the meander changes.
 */
const alongAvenue = (fraction: number): number =>
  AVENUE.from + (CROSSING.z - AVENUE.from) * fraction;

/** Z of the building face above the entrance, where the avenue view ends. */
const ENTRANCE_FACE = ENTRANCE.position[2] + ENTRANCE.oversail;

/**
 * Act I as one continuous camera route. Each move is short and keeps the
 * previous heading, so scene transitions look like camera moves.
 *
 * 1. opening: inside cloud, 330 m up. Title card only.
 * 2. contents: the descent, levelling at 70 m over the whole site.
 * 3. lake: onto the water, facing the shore.
 * 4. leverage: same bearing, still over water.
 * 5. river: west along the outlet, over the channel.
 * 6. park: turned inland, the riverside walk leading to the building.
 * 7. construction: the scaffolded massing, from the east.
 * 8. scaffold: close on the scaffold, at the unassigned bay.
 * 9. alternatives: the four options, on the promenade 30 m east.
 * 10. gaps: north-west into the park, facing away from the building.
 * 11. objectives: from the bridge, entrance centred down the avenue.
 * 12. contributions: halfway down the avenue, same aim. The act ends here.
 *
 * The text column is on the left, so each subject is aimed right of centre.
 * `recessed` beats face open site, which also saves frame budget. `lake`,
 * `leverage` and `river` run three recessed in a row on purpose: the
 * motivation has no object to look at yet.
 */
export const act1Scenes: readonly SceneDefinition[] = [
  // Title card inside cloud. `clouded` limits visibility to 26 m, so only the
  // `CloudShell` panorama is drawn. This hides the initial asset and shader
  // load and turns the descent into a reveal.
  //
  // Aimed steeply down so the empty grey band below the horizon (see `sky.ts`)
  // stays above the top of the frame. The 900 m ground plane ends well short of
  // the horizon.
  {
    id: 'opening',
    title: 'Doctoral thesis defence',
    chapter: CHAPTER.opening,
    zone: exteriorZone.id,
    world: 'foreground',
    pose: pose([118, 330, 142], [12, 232, 6], 46),
    air: clouded,
    assets: [...EXTERIOR_ASSETS],
    create: () => new OpeningScene(act1Captions.overview),
  },

  // The descent out of the cloud, ending on the only view of the whole site.
  //
  // 70 m up, aimed 37° down with a 48° fov: the top edge lands about 306 m out,
  // inside the woodland belt and short of the 400 m far plane
  // (`CAMERA_DEFAULTS`), so no clipped ground or horizon shows.
  //
  // `travel` sets a longer move than the `TRANSITION.camera` cap of 4.5 s. The
  // frame stays empty during the move (`decisions.md` §34). The contents list is
  // a left column, so the aerial stays visible on the right.
  {
    id: 'contents',
    title: 'Contents',
    chapter: CHAPTER.opening,
    zone: exteriorZone.id,
    world: 'foreground',
    pose: pose([126, 70, 158], [54, 0, 97], 48),
    travel: { seconds: 5.2, ease: EASE.camera },
    assets: [...EXTERIOR_ASSETS],
    create: () => new ContentsScene(),
  },

  // Bottom of the descent, on the water facing the shore. Uses the default
  // camera pacing. `recessed` so the four motivation figures stay readable.
  {
    id: 'lake',
    title: 'Motivation and research context',
    chapter: CHAPTER.motivation,
    zone: exteriorZone.id,
    world: 'recessed',
    pose: pose([138, 6, 98], [26, 5, 66], 48, 6),
    assets: [...EXTERIOR_ASSETS],
    create: () => new MotivationScene(),
  },

  // A point on the glide between the lake and river poses, so it needs no new
  // clear corridor. Kept south of z = 98 (see `river`). Second half of the
  // motivation; see `content/leverage.ts`.
  {
    id: 'leverage',
    title: 'Why the early stage',
    chapter: CHAPTER.motivation,
    zone: exteriorZone.id,
    world: 'recessed',
    pose: pose([92, 5.5, 96], [13, 2, 88], 49, 5),
    assets: [...EXTERIOR_ASSETS],
    create: () => new LeverageScene(),
  },

  // West along the outlet, low over the channel and aimed down its length.
  //
  // This pose and `lake` both sit south of z = 98, so the glide between them
  // does too. `WOODLAND.bank` starts at z = 98 with dense planting and no
  // corridor clearance.
  {
    id: 'river',
    title: 'Circular economy',
    chapter: CHAPTER.state,
    zone: exteriorZone.id,
    world: 'recessed',
    pose: pose([46, 5, 95], [0, -1.6, 89], 50, 5),
    assets: [...EXTERIOR_ASSETS],
    create: () => new CircularEconomyScene(),
  },

  // Turned inland, heading west-south-west: the building on the right, the river
  // on the left under the text. `foreground` to break up the run of recessed
  // beats. The composition's `wide` veil keeps the text legible.
  {
    id: 'park',
    title: 'Sustainability assessment',
    chapter: CHAPTER.state,
    zone: exteriorZone.id,
    world: 'foreground',
    pose: pose([40, 5, 78], [-16, 4, 40], 46, 2),
    assets: [...EXTERIOR_ASSETS],
    create: () => new AssessmentScene(),
  },

  // The whole massing from the east three-quarter, the scaffold side. Aimed past
  // the west corner so the elevation sits right of centre. The panel in the slot
  // is the product the EPD describes.
  {
    id: 'construction',
    title: 'Environmental product declarations',
    chapter: CHAPTER.state,
    zone: exteriorZone.id,
    world: 'foreground',
    pose: pose([46, 9, 52], [-10, 8, 18], 44, 2.5),
    assets: [...EXTERIOR_ASSETS],
    create: () => new EpdScene(),
  },

  // Close on the scaffold, matching the Blender preview camera. Blender (x, y, z)
  // is (x, z, -y) here. Aimed a few metres west so the scaffold sits right of
  // centre. The review row walks on 35 m behind the camera during this scene.
  scene(
    'scaffold',
    'The decision',
    CHAPTER.state,
    'foreground',
    pose([22, 7, 40], [5, 9, 12], 40, 1),
    act1Captions.decision,
  ),

  // Square to the review row, facing away from the building. Aimed `lead` metres
  // back so the four panels fill the right of frame. 35 m from the scaffold
  // pose, so the move between them is short. Derived from `REVIEW` so the pose
  // follows the row.
  {
    id: 'alternatives',
    title: 'What decides in practice',
    chapter: CHAPTER.state,
    zone: exteriorZone.id,
    // Recessed so the 4x4 matrix stays readable over the lit panels.
    world: 'recessed',
    pose: pose(
      [REVIEW.centre[0], 3.6, REVIEW.centre[2] + REVIEW.standoff],
      [REVIEW.centre[0] - REVIEW.lead, 3.2, REVIEW.centre[2]],
      40,
      0.6,
    ),
    assets: [...EXTERIOR_ASSETS],
    create: () => new PracticeScene(),
  },

  // Out into the park, facing away from the building. The review row walks off
  // site behind the camera, and the scaffold is struck, during this scene.
  //
  // Kept south of `PAVILION` (x 38.5 to 55.5, z 61.3 to 68.7, roof up to
  // 5.2 m): the leg from `alternatives` runs z 57 to 50 and the leg to
  // `objectives` stays west of x 38.5, so neither crosses it. These clearances
  // are unchecked in a render. Park trees scatter at x < 38, so check the
  // arrival for a tree.
  {
    id: 'gaps',
    title: 'Research gaps and open challenges',
    chapter: CHAPTER.gaps,
    zone: exteriorZone.id,
    world: 'recessed',
    pose: pose([34, 4.8, 50], [-26, 2, 70], 48, 2),
    assets: [...EXTERIOR_ASSETS],
    create: () => new GapsScene(),
  },

  // From the bridge on the site axis, with the entrance centred at the end of
  // the avenue. Derived from `CROSSING` so it moves with the bridge.
  {
    id: 'objectives',
    title: 'Four objectives',
    chapter: CHAPTER.objectives,
    zone: exteriorZone.id,
    world: 'foreground',
    pose: pose([CROSSING.x, 2.3, CROSSING.z], [0, 5, ENTRANCE_FACE], 52),
    assets: [...EXTERIOR_ASSETS],
    create: () => new ObjectivesScene(),
  },

  // Halfway down the avenue, same aim as `objectives`, so the move is a straight
  // approach. `recessed` because this is the widest composition in the act
  // (1664 units, five cards) over a bright avenue view.
  {
    id: 'contributions',
    title: 'Contributions',
    chapter: CHAPTER.contributions,
    zone: exteriorZone.id,
    world: 'recessed',
    pose: pose([0, 2.2, alongAvenue(0.46)], [0, 5, ENTRANCE_FACE], 50, 1),
    assets: [...EXTERIOR_ASSETS],
    create: () => new ContributionsScene(),
  },
];

/**
 * `REVIEW.from`, `REVIEW.to` and `CONSTRUCTION.struck` in `site.ts` must match
 * this scene order, so the review panels and scaffold only move off camera.
 * The check below throws on load if the act is reordered.
 */
const progressOf = (id: string): number => {
  const index = act1Scenes.findIndex((entry) => entry.id === id);
  if (index < 0) throw new Error(`Act I: no scene '${id}'.`);
  return zoneProgressByIndex(act1Scenes)[index] ?? 0;
};

for (const [id, expected, name] of [
  ['scaffold', REVIEW.from, 'REVIEW.from'],
  ['objectives', REVIEW.to, 'REVIEW.to'],
  ['gaps', CONSTRUCTION.struck, 'CONSTRUCTION.struck'],
] as const) {
  if (progressOf(id) !== expected) {
    throw new Error(
      `Act I: '${id}' sits at zone progress ${progressOf(id)}, but ${name} is ${expected}. ` +
        `Update ${name} in world/exterior/site.ts to match the deck.`,
    );
  }
}
