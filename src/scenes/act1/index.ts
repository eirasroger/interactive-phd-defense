import { ZONE_ORIGIN } from '@/config/layout';
import { act1Captions } from '@/content/act1';
import type { CameraPose, Vec3 } from '@/engine/camera/types';
import type { SceneDefinition } from '@/engine/scene/types';
import { zoneProgressByIndex } from '@/engine/world/zoneRuns';
import { EXTERIOR_ASSETS, exteriorZone } from '@/world/exterior/ExteriorZone';
import { CROSSING } from '@/world/exterior/paths';
import { AVENUE, CONSTRUCTION, ENTRANCE, REVIEW } from '@/world/exterior/site';
import { AssessmentScene } from './AssessmentScene';
import { CircularEconomyScene } from './CircularEconomyScene';
import { EarlyDesignScene } from './EarlyDesignScene';
import { ExteriorScene } from './ExteriorScene';
import { MotivationScene } from './MotivationScene';

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
 * How far down the avenue the approach beat stands, as a fraction of its run.
 *
 * Derived rather than typed: the avenue's far end is the bridge and the bridge
 * is wherever the meander put it, so a literal z would drift the moment the
 * river changes.
 */
const alongAvenue = (fraction: number): number =>
  AVENUE.from + (CROSSING.z - AVENUE.from) * fraction;

/** The face of the mass above the entrance — what the vista terminates on. */
const ENTRANCE_FACE = ENTRANCE.position[2] + ENTRANCE.oversail;

/**
 * Act I, walked as a route through the site rather than as eleven framings of
 * one elevation.
 *
 * **The eleven poses are one route, not eleven viewpoints.** Every move is
 * short and continues the last one's heading, because the transition between
 * scenes is a camera tween through open air: two poses a hundred metres apart
 * facing opposite ways do not read as a move, they read as a cut, and the whole
 * point of a continuous world is that there are none.
 *
 * The route is a descent and a walk inland:
 *
 * 1. **overview** — high over the lake, looking back at the whole site.
 * 2. **lake** — straight down onto the water on the same bearing, facing the
 *    shore. The site is read from the water, as if off a boat.
 * 3. **river** — west along the outlet, over the channel, following it. Its
 *    own composition, not a caption: circular economy, as the value-retention
 *    hierarchy.
 * 4. **park** — off the water and turned inland: the riverside walk leading to
 *    the building.
 * 5. **construction** — in to the massing, scaffolded, from the east.
 * 6. **scaffold** — closer, on the scaffold itself.
 * 7. **alternatives** — the four options, on the promenade thirty metres east.
 * 8. **gaps** — back out north-west into the park, facing away from everything.
 * 9. **objectives** — the bridge, and the entrance centred down the avenue.
 * 10. **method** — halfway down that avenue, same aim.
 * 11. **entrance** — at the door. The hinge into Act II.
 *
 * Two composition rules run through every pose. The text column sits on the
 * left, so the subject is aimed **right of centre** — which for a camera
 * heading west means standing north of what it is looking at, and for one
 * heading east means the opposite. And the three `recessed` beats (river, gaps,
 * method) turn into open site, which is both where the argument stops needing a
 * picture and where the frame budget is recovered.
 */
export const act1Scenes: readonly SceneDefinition[] = [
  // Forty-four metres up and out over the lake, looking back west-south-west at
  // the whole site: water in the foreground, the shore, the park, the river and
  // the building. **Over the water on purpose** — this is the only quarter of
  // the site with nothing standing in it, so it is the only place a camera can
  // be high without being inside the woodland belt, and the descent from here
  // to the next pose is a straight line along one bearing.
  scene(
    'overview',
    'The site',
    'foreground',
    pose([150, 44, 134], [18, 6, 54], 46),
    act1Captions.overview,
  ),

  // The same bearing, twenty-five metres forward and thirty-eight down: the
  // camera settles onto the water and reads the site off it. Nothing is built
  // in the near half of this frame, which is the point — this beat is the
  // reason the work exists, not yet the work.
  //
  // `recessed`, and the only scene in the act with its own composition rather
  // than a caption: the argument is four numbers, so the world steps back and
  // becomes the surface they are read against.
  {
    id: 'lake',
    title: 'Motivation and research context',
    chapter: CHAPTER,
    zone: exteriorZone.id,
    world: 'recessed',
    pose: pose([138, 6, 98], [26, 5, 66], 48, 6),
    assets: [...EXTERIOR_ASSETS],
    create: () => new MotivationScene(),
  },

  // West along the outlet, still on the water, now over the channel itself and
  // following it. Four metres up and aimed down its length, so the stream
  // recedes through the frame rather than crossing it — the shot is the
  // travelling, not the water.
  //
  // This pose and the lake's both sit **south of z = 98**, so the ninety metres
  // of glide between them does too. That is a routing constraint rather than a
  // framing one: `WOODLAND.bank` starts at 98, carries no corridor clearance
  // and is the densest planting on the site, so a path a few metres north of
  // here spends half the transition inside a hedge.
  //
  // `recessed`, and its own composition rather than a caption, like `lake`:
  // the argument is the value-retention hierarchy, so the world steps back and
  // becomes the surface it is read against.
  {
    id: 'river',
    title: 'Circular economy',
    chapter: CHAPTER,
    zone: exteriorZone.id,
    world: 'recessed',
    pose: pose([46, 5, 95], [0, -1.6, 89], 50, 5),
    assets: [...EXTERIOR_ASSETS],
    create: () => new CircularEconomyScene(),
  },

  // Sixteen metres off the river and turned inland. The riverside walk leads
  // out of the near corner and the building closes the frame beyond it; heading
  // west-south-west, so south — and therefore the building — falls on the right
  // of frame and the river on the left, under the text.
  //
  // Its own composition rather than a caption — the life-cycle band, built
  // across five beats. Left `foreground` even so: `lake` and `river` are both
  // recessed and a third in a row is two and a half minutes of dimmed world,
  // which is where a continuous world starts reading as a slide deck again.
  // The `wide` veil the composition sets is what carries legibility here.
  {
    id: 'park',
    title: 'Sustainability assessment',
    chapter: CHAPTER,
    zone: exteriorZone.id,
    world: 'foreground',
    pose: pose([40, 5, 78], [-16, 4, 40], 46, 2),
    assets: [...EXTERIOR_ASSETS],
    create: () => new AssessmentScene(),
  },

  // The massing whole, from the east three-quarter, which is the side the
  // scaffold stands on. Aimed past the building's west corner so the elevation
  // sits right of centre.
  scene(
    'construction',
    'The building under construction',
    'foreground',
    pose([46, 9, 52], [-10, 8, 18], 44, 2.5),
    act1Captions.data,
  ),

  // Close on the scaffold. This is the Blender preview framing, converted:
  // Blender is Z-up facing -Y and glTF maps that to web +Z, so (x, y, z) there
  // is (x, z, -y) here. Aimed a few metres west of the bays it wraps so the
  // structure stands right of centre.
  // Its own composition rather than a caption: the influence / information
  // crossing, which is stream 5's device and belongs on the one beat standing
  // where the building is still open.
  {
    id: 'scaffold',
    title: 'Early design',
    chapter: CHAPTER,
    zone: exteriorZone.id,
    world: 'foreground',
    pose: pose([22, 7, 40], [5, 9, 12], 40, 1),
    assets: [...EXTERIOR_ASSETS],
    create: () => new EarlyDesignScene(),
  },

  // The options' own scene, and the only one that turns its back on the
  // building entirely. Square to the row and close, aimed `lead` metres back
  // toward the building so the four panels sit across the right of frame and
  // the left stays clear for the caption.
  //
  // Thirty-five metres from the scaffold pose and on the same side of the site,
  // so the two beats are one continuous move rather than a cut.
  //
  // Derived from `REVIEW`, never typed: the row's position decides where this
  // stands, so the two cannot drift apart.
  scene(
    'alternatives',
    'What decides in practice',
    'foreground',
    pose(
      [REVIEW.centre[0], 3.6, REVIEW.centre[2] + REVIEW.standoff],
      [REVIEW.centre[0] - REVIEW.lead, 3.2, REVIEW.centre[2]],
      40,
      0.6,
    ),
    act1Captions.alternatives,
  ),

  // Back out north-west along the riverside walk, which puts the review row
  // **behind the camera** while it walks itself off site during this scene. It
  // also swings the building past the right edge, so what is left is grass, a
  // path and the far bank — the whole job of a recessed beat.
  scene(
    'gaps',
    'Research gaps and open challenges',
    'recessed',
    pose([30, 5, 62], [-30, 2, 74], 48, 2),
    act1Captions.gaps,
  ),

  // From the bridge, on the site axis. The one terminated vista in the act: the
  // entrance sits dead centre at the end of fifty metres of avenue, with the
  // tree rows converging on it. Derived from the crossing rather than typed, so
  // meandering the river moves the bridge and this pose together.
  scene(
    'objectives',
    'Four objectives',
    'foreground',
    pose([CROSSING.x, 2.3, CROSSING.z], [0, 5, ENTRANCE_FACE], 52),
    act1Captions.objectives,
  ),

  // Halfway down the same walk, aimed at the same point. Nothing changes but
  // the distance, which is what makes the beat read as an approach rather than
  // as a new place.
  scene(
    'method',
    'Method and structure',
    'recessed',
    pose([0, 2.2, alongAvenue(0.46)], [0, 5, ENTRANCE_FACE], 50, 1),
    act1Captions.method,
  ),

  // The hinge into Act II, derived from the entrance rather than hand-placed so
  // the corridor threshold lines up with the same opening. Parallel to the
  // entrance axis rather than aimed at it: a straight one-point approach puts
  // the door right of centre, leaves the text column clear, and is already
  // pointing where Act II continues.
  //
  // Close. At the standoff the other poses use, a 34 m elevation fills the
  // frame and the opening is lost among eight identical bays — which is fatal
  // for the one shot whose whole job is to say *this is the way in*.
  scene(
    'entrance',
    'Entering',
    'foreground',
    pose(
      [ENTRANCE.position[0] - 5.5, 3.4, ENTRANCE.position[2] + 24],
      [ENTRANCE.position[0] - 5.5, 2.6, ENTRANCE.position[2]],
      44,
      1.5,
    ),
    act1Captions.entrance,
  ),
];

/**
 * Two spans in `site.ts` are really statements about *this* file's order, and
 * the deck is what actually produces them.
 *
 * The review row must open one scene before the options are looked at and close
 * one scene after, because that is what puts the panels' travel inside a scene
 * that cannot see them. The scaffold comes down on `gaps`, because that is the
 * one beat in the act facing away from the building.
 *
 * Reorder the act and they disagree silently, which is the worst way for this to
 * fail: the panels either stay parked off frame while the scene arguing about
 * them plays to an empty promenade, or they walk across the middle of a shot —
 * and a scaffold vanishing on camera is a bug the audience watches happen.
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
