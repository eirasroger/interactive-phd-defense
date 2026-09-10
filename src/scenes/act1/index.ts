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
import { ContributionsScene } from './ContributionsScene';
import { EpdScene } from './EpdScene';
import { ExteriorScene } from './ExteriorScene';
import { GapsScene } from './GapsScene';
import { OpeningScene } from './OpeningScene';
import { LeverageScene } from './LeverageScene';
import { MotivationScene } from './MotivationScene';
import { ObjectivesScene } from './ObjectivesScene';
import { PracticeScene } from './PracticeScene';

/**
 * What the progress bar names. The thesis sections the audience is being walked
 * through, so the orientation cue reads as the argument rather than as the
 * staging that carries it.
 */
const CHAPTER = {
  opening: 'Introduction',
  motivation: 'Motivation · Research context',
  state: 'State of the art',
  gaps: 'Research gaps',
  objectives: 'Objectives',
  contributions: 'Contributions',
} as const;

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
 * The route is a descent and a walk inland, and the descent now starts above
 * the weather:
 *
 * 1. **opening** — inside cloud, a hundred and eighteen metres up. The title
 *    card, and nothing else in the frame.
 * 2. **lake** — the fall out of it, onto the water facing the shore. The site
 *    is read off the water, as if off a boat, and it is the first time the
 *    audience sees any of it.
 * 3. **leverage** — on down the same bearing, still over water. Its own
 *    composition: the room to change the building against what changing it
 *    costs.
 * 4. **river** — west along the outlet, over the channel, following it. Its
 *    own composition, not a caption: circular economy, as the value-retention
 *    hierarchy.
 * 5. **park** — off the water and turned inland: the riverside walk leading to
 *    the building.
 * 6. **construction** — in to the massing, scaffolded, from the east.
 * 7. **scaffold** — closer, on the scaffold itself, at the unassigned bay.
 * 8. **alternatives** — the four options, on the promenade thirty metres east.
 * 9. **gaps** — north-west into the park, facing away from everything.
 * 10. **objectives** — the bridge, and the entrance centred down the avenue.
 * 11. **contributions** — halfway down that avenue, same aim. The act ends here.
 *
 * **There is no establishing shot and no arrival-at-the-door beat.** The first
 * was a second title card over a site the audience was about to be flown into
 * anyway, which spent the reveal on a caption they had just read; the descent
 * out of the cloud now lands directly on the motivation.
 *
 * **There was an arrival-at-the-door beat.** One stood here, carrying the words
 * *Five papers. One pipeline.* — which is the previous scene's last frame said
 * out loud, at the exact moment the audience has just watched it drawn. The act
 * now ends on the pipeline, and the way in is the doors opening, which is a
 * transition rather than a slide.
 *
 * Two composition rules run through every pose. The text column sits on the
 * left, so the subject is aimed **right of centre** — which for a camera
 * heading west means standing north of what it is looking at, and for one
 * heading east means the opposite. And the five `recessed` beats (leverage,
 * river, alternatives, gaps, method) turn into open site or step back from it,
 * which is both where the argument stops needing a picture and where the frame
 * budget is recovered.
 *
 * **`alternatives` and `gaps` now run consecutively recessed**, which the old
 * `ai` beat existed partly to prevent. Accepted: they are the two beats of the
 * act that carry the most information, the world has nothing to contribute to
 * either, and two is under the three-in-a-row threshold the rule is really
 * about.
 *
 * **Three recessed beats run consecutively at `lake`, `leverage` and `river`**,
 * against the rule that two and a half minutes of dimmed world is where a
 * continuous world starts reading as a slide deck. Taken deliberately: the
 * motivation and its premise are the one stretch of the act with no object to
 * look at, and the alternative is arguing them over a building whose relevance
 * has not been established yet.
 */
export const act1Scenes: readonly SceneDefinition[] = [
  // The talk opens inside weather, with nothing on screen but the title and the
  // light coming through it.
  //
  // **A hundred and twenty-four metres up and, for a moment, blind.** `clouded`
  // closes the air to twenty-six metres, so for as long as the card is up no
  // part of the site survives to be drawn and the frame is `CloudShell`'s
  // panorama alone. What the numbers decide is where the fall begins.
  //
  // **Aimed steeply down, and that is arithmetic rather than taste.** The
  // ground plane is 900 m across, so from any real altitude the band between
  // the site's own horizon and the panorama's is empty grey — `sky.ts` says as
  // much about its below-horizon stops. At 124 m the plane's edge sits about
  // 15° below the horizon, and a 46° frame aimed 43° down has its top edge at
  // 20°, which puts the whole band off the top of the screen. Aimed level, as
  // an earlier cut was, it was the top third of the frame for four seconds.
  //
  // The fall from here to `lake` passes through very nearly the framing the act
  // used to open on: the two poses share a bearing, so the site is read whole
  // from altitude on the way down without spending a beat on it.
  //
  // Three things this beat is buying, in order of how much they matter:
  //
  // 1. **The title reads.** Dark ink on a light ground is the highest contrast
  //    the deck can produce, and the opening card is the one frame where a
  //    scrim over the world was costing the establishing shot most.
  // 2. **The site arrives as an event.** The act used to open on the site
  //    already in frame, so the descent it is built around started from a state
  //    the audience had been looking at for half a minute. It is now a reveal.
  // 3. **The load is invisible.** This is the heaviest moment in the deck —
  //    assets streaming, shaders compiling, the first frame of a world that has
  //    never been drawn. Nothing can hitch in an empty white volume.
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

  // **The arrival, and the bottom of the descent out of the cloud.** The camera
  // comes down a hundred and twelve metres onto the water and reads the site off
  // it. Nothing is built in the near half of this frame, which is the point —
  // this beat is the reason the work exists, not yet the work.
  //
  // `travel` rather than the paced default, because this is not a hop between
  // two things the camera is looking at: it is the one continuous fall the deck
  // opens with, with the air opening and the cloud thinning around it, and
  // `TRANSITION.camera` would cap it at four and a half seconds. The rest of Act
  // I is paced normally — only the first move is a set piece.
  //
  // `recessed`, and the only scene in the act with its own composition rather
  // than a caption: the argument is four numbers, so the world steps back and
  // becomes the surface they are read against.
  {
    id: 'lake',
    title: 'Motivation and research context',
    chapter: CHAPTER.motivation,
    zone: exteriorZone.id,
    world: 'recessed',
    pose: pose([138, 6, 98], [26, 5, 66], 48, 6),
    travel: { seconds: 5.2, ease: EASE.camera },
    assets: [...EXTERIOR_ASSETS],
    create: () => new MotivationScene(),
  },

  // Halfway from the lake pose to the river pose, on the same bearing and the
  // same descent — literally a point on the glide the camera already travels
  // between those two, which is how a beat is inserted into a continuous route
  // without opening a corridor through anything.
  //
  // South of z = 98 for the reason the river pose carries: `WOODLAND.bank`
  // starts there, has no corridor clearance, and both legs of this move now
  // stop short of it.
  //
  // `recessed`, and its own composition: the argument is a shape, so the world
  // steps back and becomes the surface it is read against. This is the second
  // half of the motivation, and the premise the three stream scenes after it
  // all assume — see `content/leverage.ts`.
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
    chapter: CHAPTER.state,
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
    chapter: CHAPTER.state,
    zone: exteriorZone.id,
    world: 'foreground',
    pose: pose([40, 5, 78], [-16, 4, 40], 46, 2),
    assets: [...EXTERIOR_ASSETS],
    create: () => new AssessmentScene(),
  },

  // The massing whole, from the east three-quarter, which is the side the
  // scaffold stands on. Aimed past the building's west corner so the elevation
  // sits right of centre.
  //
  // Its own composition rather than a caption: the declaration, read on the
  // building it would describe. The panel in the slot is the product this beat
  // is holding a document about, so the running example is met here as data
  // before it is met at C2 as a corpus.
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

  // Close on the scaffold. This is the Blender preview framing, converted:
  // Blender is Z-up facing -Y and glTF maps that to web +Z, so (x, y, z) there
  // is (x, z, -y) here. Aimed a few metres west of the bays it wraps so the
  // structure stands right of centre.
  //
  // A caption, because the world is already the figure: the unassigned bay and
  // the access standing in front of it say the whole beat, and this is the one
  // pose in the act close enough to read either. It is also where the review
  // row walks on, thirty-five metres behind the camera.
  scene(
    'scaffold',
    'The decision',
    CHAPTER.state,
    'foreground',
    pose([22, 7, 40], [5, 9, 12], 40, 1),
    act1Captions.decision,
  ),

  // The options' own scene, and the only one that turns its back on the
  // building entirely. Square to the row and close, aimed `lead` metres back
  // toward the building so the four panels sit across the right of frame and
  // the left stays clear for the composition.
  //
  // Thirty-five metres from the scaffold pose and on the same side of the site,
  // so the two beats are one continuous move rather than a cut. That continuity
  // is what makes the scaffold and the row read as one place. The panels cannot
  // stand in the scaffold's own frame: it is a close elevation study aimed
  // upward, with no ground in it and no half of the frame to spare, and a bay
  // module stood at that distance is taller than the shot and occludes the
  // elevation it is a candidate for.
  //
  // Derived from `REVIEW`, never typed: the row's position decides where this
  // stands, so the two cannot drift apart.
  {
    id: 'alternatives',
    title: 'What decides in practice',
    chapter: CHAPTER.state,
    zone: exteriorZone.id,
    // `recessed`, and it is the one beat in the act where information has to
    // dominate: a four-by-four matrix laid at full contrast over four lit
    // panels leaves both unreadable. Receding rather than blurring is the
    // design system's own answer, and the row stays legible behind it as the
    // four things the matrix is about.
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

  // Out into the park, which puts the review row **behind the camera** while it
  // walks itself off site during this scene. It also swings the building
  // seventy degrees off axis, so what is left is grass, a path and the far bank
  // — the whole job of a recessed beat.
  //
  // **Held south of the pavilion, and that is what decides the numbers.**
  // `PAVILION` stands at x 38.5 to 55.5, z 61.3 to 68.7, with eaves at 3.9 m
  // and a roof raking to 5.2. The pose this replaces stood at (30, 62), and the
  // straight line `CameraDirector` tweens from `alternatives` — which begins at
  // (62, 57) — crosses the pavilion's x span at z 58.0 to 60.7, clearing its
  // near face by 0.6 m with the camera passing through 4.3 m of height. That is
  // inside the near clip plane of a wall, not a near miss.
  //
  // Twelve metres south instead. The incoming leg runs z 57 to 50, away from
  // the pavilion the whole way; the outgoing leg to `objectives` never reaches
  // x 38.5, so neither touches it. The bearing and pitch are the old pose's,
  // translated — the frame is the same park, read from twelve metres nearer the
  // promenade.
  //
  // **Unverified against a render.** The site is authored blind and there is no
  // free-look camera yet (`PLAN.md`), so the clearances above are arithmetic.
  // Park groups scatter outside the review corridor at x < 38, which is where
  // this stands: check the arrival for a tree before rehearsing on it.
  //
  // Its own composition rather than a caption: the coverage field, struck one
  // row at a time. See `content/gaps.ts` and `scenes/act1/GapsScene.ts`.
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

  // From the bridge, on the site axis. The one terminated vista in the act: the
  // entrance sits dead centre at the end of fifty metres of avenue, with the
  // tree rows converging on it. Derived from the crossing rather than typed, so
  // meandering the river moves the bridge and this pose together.
  // Its own composition rather than a caption: the six gap keys gathered into
  // four. See `content/objectives.ts` and `scenes/act1/ObjectivesScene.ts`.
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

  // Halfway down the same walk, aimed at the same point. Nothing changes but
  // the distance, which is what makes the beat read as an approach rather than
  // as a new place.
  //
  // Its own composition rather than a caption: the four objectives answered,
  // then the five answers travelling into the plan of the corridor the next
  // scene walks into. See `content/contributions.ts`.
  //
  // `recessed`, and it has to be. This is the widest composition in the act — a
  // 1664-unit field carrying five cards and six edges — and the avenue it sits
  // over is a lit vista with tree rows converging down the middle of frame.
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
