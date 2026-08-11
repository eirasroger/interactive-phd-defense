import type { SceneDefinition } from '@/engine/scene/types';
import { act1Scenes } from './act1';
import { act2Scenes } from './act2';
import { AssemblyScene } from './demo/AssemblyScene';
import { CorridorScene } from './demo/CorridorScene';
import { STATION_IDS, stationPose } from './demo/corridor';
import { FieldScene } from './demo/FieldScene';
import { FlowScene } from './demo/FlowScene';
import { OriginScene } from './demo/OriginScene';

const DEMO_ZONE = 'demo';

/**
 * Ordered scene registry — the order here is the order of the talk.
 *
 * `id` is the scene's permanent URL and should not change once shared. `pose`
 * is where the camera comes to rest; the director decides how to travel there.
 * `zone` names the built world the scene is looking at, and consecutive scenes
 * sharing a zone form the run that its world state is distributed across.
 *
 * The engine demos remain after Act I until the zones they exercise exist for
 * real. They are reachable but no longer the front of the deck.
 */
export const scenes: readonly SceneDefinition[] = [
  ...act1Scenes,
  // The act boundary is a designed crossing rather than a cut: the first Act II
  // scene declares it, and entering it opens the building's doors and carries
  // the camera through them in one move. See `scenes/act2/index.ts`.
  ...act2Scenes,
  {
    id: 'origin',
    title: 'A Continuous World',
    chapter: 'Engine demo',
    zone: DEMO_ZONE,
    world: 'foreground',
    pose: { position: [0, 2, 19], target: [0, 0, 0], fov: 42 },
    create: () => new OriginScene(),
  },
  {
    id: 'assembly',
    title: 'Blender Asset Pipeline',
    chapter: 'Engine demo',
    zone: DEMO_ZONE,
    world: 'foreground',
    pose: { position: [6, 3.4, -26], target: [0, 0.8, -34], fov: 40, arc: 2.5 },
    assets: ['assembly'],
    create: () => new AssemblyScene(),
  },
  {
    id: 'flow',
    title: 'Pipeline Flow',
    chapter: 'Engine demo',
    zone: DEMO_ZONE,
    world: 'foreground',
    // Aimed left of the content so the pipeline sits in the clear right half,
    // opposite the text column.
    pose: { position: [-3, 3.6, -47], target: [-3, 0, -64], fov: 44, arc: 3 },
    create: () => new FlowScene(),
  },
  {
    id: 'field',
    title: 'Decision Space',
    chapter: 'Engine demo',
    zone: DEMO_ZONE,
    world: 'foreground',
    pose: { position: [-4, 9, -74], target: [-4, 0, -96], fov: 46, arc: 4 },
    create: () => new FieldScene(),
  },
  // One scene per station. The corridor is a single continuous space, so
  // walking it is navigation between poses inside it rather than five
  // separate scenes that each happen to look like a corridor.
  ...STATION_IDS.map((id, index) => ({
    id: id.toLowerCase(),
    title: `Corridor · ${id}`,
    chapter: 'The Corridor',
    zone: DEMO_ZONE,
    world: 'foreground' as const,
    pose: stationPose(index),
    assets: ['corridorBay'],
    create: () => new CorridorScene(index),
  })),
];
