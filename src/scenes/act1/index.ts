import { ZONE_ORIGIN } from '@/config/layout';
import { act1Captions } from '@/content/act1';
import type { CameraPose, Vec3 } from '@/engine/camera/types';
import type { SceneDefinition } from '@/engine/scene/types';
import { zoneProgressByIndex } from '@/engine/world/zoneRuns';
import { EXTERIOR_ASSETS, exteriorZone } from '@/world/exterior/ExteriorZone';
import { ENTRANCE, REVIEW } from '@/world/exterior/site';
import { ExteriorScene } from './ExteriorScene';

const CHAPTER = 'Act I — Exterior';

/** Poses are authored in site coordinates and lifted into the world here. */
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
  world: 'foreground' | 'recessed',
  cameraPose: CameraPose,
  caption: (typeof act1Captions)[keyof typeof act1Captions],
): SceneDefinition => ({
  id,
  title,
  chapter: CHAPTER,
  zone: exteriorZone.id,
  world,
  pose: cameraPose,
  assets: [...EXTERIOR_ASSETS],
  create: () => new ExteriorScene(caption),
});

/**
 * Act I, walked. Eleven scenes, 8:35.
 *
 * The camera approaches the building down its −X flank so the massing sits in
 * the right half of the frame, clear of the text column and its scrim. The
 * `recessed` scenes turn away into open site: nothing to look at is the point,
 * and it is also where the frame budget is recovered before the next foreground
 * beat.
 *
 * Three scenes are framed on the specification slot — `leverage` first sees it,
 * `practice` closes on it while candidates hold beside it, `gaps` pulls back far
 * enough to carry six markers. They are the act's one built device and their
 * framing is derived from `SLOT`, not from numbers typed four times.
 *
 * Re-derived for the 33.6 × 16 × 17 m slab. It is wider and lower than the
 * massing these poses were first cut against, so every one is a fresh
 * derivation rather than a nudge: a wider building needs more standoff to stay
 * inside the frame, and a lower one needs the camera lower to keep the parapet
 * off the top edge.
 */
export const act1Scenes: readonly SceneDefinition[] = [
  // Provisional. The act is still cut to its old eleven-station order; the
  // re-cut to the new walk (overview, lake, river, park, construction,
  // scaffold, alternatives, park, avenue, approach, entrance) is outstanding.
  // This one pose is moved because the old title stood where the lake now is.
  //
  // Framings verified in the browser and waiting for the re-cut:
  //   overview          pose([64, 34, 148], [0, 6, 44], 46)
  //   from the bridge   pose([0, 2.3, 86], [0, 5, 8], 52)   <- scene 9/10
  //   over the stream   pose([2, 4.2, 103], [6, -1.4, 82], 52)
  // The bridge pose is the one that carries the terminated vista: the entrance
  // sits dead centre at the end of the straight avenue, which is what the brief
  // for scene 9 asks for.
  scene('title', 'Title', 'foreground', pose([64, 34, 148], [0, 6, 44], 46), act1Captions.title),

  scene(
    'footprint',
    'Footprint and targets',
    'recessed',
    pose([-36, 5, 84], [-70, 9, 38], 44, 1.5),
    act1Captions.footprint,
  ),

  // Slot beat A. First sight of the unassigned bay, at a distance that still
  // reads the whole massing behind it: the claim is that the building is
  // decided and the envelope is not, so both have to be in frame.
  scene(
    'leverage',
    'Where leverage sits',
    'foreground',
    pose([-28, 6, 66], [-16, 9, 16], 42, 2),
    act1Captions.leverage,
  ),

  scene(
    'tools',
    'The tools presuppose completeness',
    'recessed',
    pose([-44, 6, 62], [-76, 10, 32], 44, 2),
    act1Captions.tools,
  ),

  scene(
    'mismatch',
    'Early design cannot supply it',
    'foreground',
    pose([-34, 5, 52], [-18, 11, 10], 44, 2),
    act1Captions.mismatch,
  ),

  // The options' own scene, and the only one that turns its back on the
  // building entirely. Square to the row and close, aimed `lead` metres west so
  // the four panels sit across the right of frame and the left stays clear for
  // the caption.
  //
  // Derived from `REVIEW`, never typed: the row's position decides where this
  // stands, so the two cannot drift apart.
  scene(
    'practice',
    'What decides in practice',
    'foreground',
    pose(
      [REVIEW.centre[0], 4.2, REVIEW.centre[2] + REVIEW.standoff],
      [REVIEW.centre[0] - REVIEW.lead, 3.5, REVIEW.centre[2]],
      40,
      0.6,
    ),
    act1Captions.practice,
  ),

  // Turned east rather than west. This pose used to look out over the west park
  // and the review row now stands in that exact direction — with the options on
  // site for this scene, a shot whose whole point is that there is nothing to
  // look at had four panels dead centre.
  //
  // Far enough east that the building's own corner and the scaffold clear the
  // frame too; what is left is open promenade and a tree, which is the whole
  // job of a recessed beat.
  scene(
    'sota',
    'State of the art',
    'recessed',
    pose([-8, 6, 62], [52, 10, 50], 44, 1.5),
    act1Captions.sota,
  ),

  // Slot beat C. Pulled back from `practice` because six markers need room the
  // close pose does not have.
  scene(
    'gaps',
    'Six gaps',
    'foreground',
    pose([-30, 7, 62], [-17, 8, 16], 44, 1.5),
    act1Captions.gaps,
  ),

  scene(
    'objectives',
    'Four objectives',
    'foreground',
    pose([-28, 6, 52], [-15, 10, 10], 44, 1),
    act1Captions.objectives,
  ),

  scene(
    'method',
    'Method and structure',
    'recessed',
    pose([-46, 5.5, 46], [-74, 9, 18], 44, 2),
    act1Captions.method,
  ),

  // The hinge into Act II, derived from the entrance rather than hand-placed so
  // the corridor threshold lines up with the same opening. Parallel to the
  // entrance axis rather than aimed at it: a straight one-point approach puts
  // the door right of centre, leaves the text column clear, and is already
  // pointing where Act II continues. The only head-on shot in the act.
  //
  // Close. At the standoff the other poses use, a 34 m elevation fills the
  // frame and the opening is lost among eight identical bays — which is fatal
  // for the one shot whose whole job is to say *this is the way in*. Twenty
  // metres crops the parapet and buys a door the audience can see.
  scene(
    'structure',
    'Entering',
    'foreground',
    pose(
      [ENTRANCE.position[0] - 5.5, 3.8, ENTRANCE.position[2] + 27],
      [ENTRANCE.position[0] - 5.5, 2.8, ENTRANCE.position[2]],
      40,
      1.5,
    ),
    act1Captions.structure,
  ),
];

/**
 * The review row's span is a pair of numbers in `site.ts`, and the deck's order
 * is what actually produces them. They must open one scene before the options
 * are looked at and close one scene after, because that is what puts the
 * panels' travel inside a scene that faces the building.
 *
 * Reorder the act and the two disagree silently: the panels either stay parked
 * off frame while the scene arguing about them plays to an empty promenade, or
 * they walk across the middle of a shot.
 */
const progressOf = (id: string): number => {
  const index = act1Scenes.findIndex((entry) => entry.id === id);
  if (index < 0) throw new Error(`Act I: no scene '${id}'.`);
  return zoneProgressByIndex(act1Scenes)[index] ?? 0;
};

for (const [id, expected, name] of [
  ['mismatch', REVIEW.from, 'REVIEW.from'],
  ['gaps', REVIEW.to, 'REVIEW.to'],
] as const) {
  if (progressOf(id) !== expected) {
    throw new Error(
      `Act I: '${id}' sits at zone progress ${progressOf(id)}, but ${name} is ${expected}. ` +
        `Update ${name} in world/exterior/site.ts to match the deck.`,
    );
  }
}
