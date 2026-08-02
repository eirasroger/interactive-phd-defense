import { ZONE_ORIGIN } from '@/config/layout';
import { act1Captions } from '@/content/act1';
import type { CameraPose, Vec3 } from '@/engine/camera/types';
import type { SceneDefinition } from '@/engine/scene/types';
import { EXTERIOR_ASSET, exteriorZone } from '@/world/exterior/ExteriorZone';
import { ENTRANCE } from '@/world/exterior/site';
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

/**
 * Act I, walked.
 *
 * The camera approaches the building down its −X flank so the massing sits in
 * the right half of the frame, clear of the text column and its scrim. The
 * `recessed` scenes turn away into open site: nothing to look at is the point,
 * and it is also where the frame budget is recovered before the next foreground
 * beat.
 *
 * Scenes 7 and 8 still want a device of their own — four objects that Act III
 * calls back to. They are framed for it here and carry text alone until it
 * exists.
 */
export const act1Scenes: readonly SceneDefinition[] = [
  {
    id: 'title',
    title: 'Title',
    chapter: CHAPTER,
    zone: exteriorZone.id,
    world: 'foreground',
    pose: pose([-26, 5, 92], [-20, 9, 8], 40),
    assets: [EXTERIOR_ASSET],
    create: () => new ExteriorScene(act1Captions.title),
  },
  {
    id: 'footprint',
    title: 'Footprint and targets',
    chapter: CHAPTER,
    zone: exteriorZone.id,
    world: 'recessed',
    pose: pose([-30, 4, 80], [-64, 8, 34], 44, 1.5),
    assets: [EXTERIOR_ASSET],
    create: () => new ExteriorScene(act1Captions.footprint),
  },
  {
    id: 'leverage',
    title: 'Where leverage sits',
    chapter: CHAPTER,
    zone: exteriorZone.id,
    world: 'foreground',
    pose: pose([-24, 2.2, 52], [-16, 12, 6], 46, 2),
    assets: [EXTERIOR_ASSET],
    create: () => new ExteriorScene(act1Captions.leverage),
  },
  {
    id: 'tools',
    title: 'The tools presuppose completeness',
    chapter: CHAPTER,
    zone: exteriorZone.id,
    world: 'recessed',
    pose: pose([-40, 5, 56], [-70, 9, 26], 44, 2),
    assets: [EXTERIOR_ASSET],
    create: () => new ExteriorScene(act1Captions.tools),
  },
  {
    id: 'mismatch',
    title: 'Early design cannot supply it',
    chapter: CHAPTER,
    zone: exteriorZone.id,
    world: 'foreground',
    pose: pose([-34, 3.2, 34], [-18, 11, 2], 44, 2.5),
    assets: [EXTERIOR_ASSET],
    create: () => new ExteriorScene(act1Captions.mismatch),
  },
  {
    id: 'practice',
    title: 'What decides in practice',
    chapter: CHAPTER,
    zone: exteriorZone.id,
    world: 'recessed',
    pose: pose([-46, 4, 40], [-74, 8, 16], 44, 2),
    assets: [EXTERIOR_ASSET],
    create: () => new ExteriorScene(act1Captions.practice),
  },
  {
    id: 'gaps',
    title: 'Four gaps',
    chapter: CHAPTER,
    zone: exteriorZone.id,
    world: 'foreground',
    pose: pose([-28, 4.5, 40], [-14, 9, 4], 44, 1.5),
    assets: [EXTERIOR_ASSET],
    create: () => new ExteriorScene(act1Captions.gaps),
  },
  {
    id: 'objectives',
    title: 'Four objectives',
    chapter: CHAPTER,
    zone: exteriorZone.id,
    world: 'foreground',
    pose: pose([-20, 4, 32], [-10, 8, 4], 44, 1),
    assets: [EXTERIOR_ASSET],
    create: () => new ExteriorScene(act1Captions.objectives),
  },
  {
    id: 'structure',
    title: 'Entering',
    chapter: CHAPTER,
    zone: exteriorZone.id,
    world: 'foreground',
    // Square to the entrance, derived from it rather than hand-placed: this is
    // the hinge into Act II, and the corridor threshold has to line up with the
    // same opening. The only head-on shot in the act.
    // Parallel to the entrance axis rather than aimed at it: a straight
    // one-point approach puts the door right of centre, leaves the text column
    // clear, and is already pointing where Act II continues.
    pose: pose(
      [ENTRANCE.position[0] - 9, 4.0, ENTRANCE.position[2] + 38],
      [ENTRANCE.position[0] - 9, 3.2, ENTRANCE.position[2]],
      44,
      1.5,
    ),
    assets: [EXTERIOR_ASSET],
    create: () => new ExteriorScene(act1Captions.structure),
  },
];
