import type { Group, PerspectiveCamera } from 'three';
import type { QualitySettings } from '@/config/quality';
import type { AssetLoader } from '@/engine/assets/AssetLoader';
import type { CameraPose } from '@/engine/camera/types';
import type { World } from '@/engine/render/World';
import type { FrameHandler, NavDirection } from '@/engine/types';
import type { ZoneCrossing } from '@/engine/world/types';

export interface SceneContext {
  /** DOM overlay layer for this scene. Removed automatically on exit. */
  readonly root: HTMLElement;
  /** 3D content root. Detached from the world automatically on exit. */
  readonly stage: Group;
  readonly world: World;
  /**
   * The posed camera, for tethering DOM to a point in the world. Scenes read
   * it; moving it is the camera director's business.
   */
  readonly camera: PerspectiveCamera;
  readonly assets: AssetLoader;
  readonly quality: QualitySettings;
  /**
   * Seconds of camera travel before this scene's content appears. The DOM
   * layer already waits this long, so scene reveals must offset by it too.
   */
  readonly entryDelay: number;
  /** Aborted on exit. */
  readonly signal: AbortSignal;

  onFrame(handler: FrameHandler): void;

  /**
   * Register cleanup for resources this scene created.
   *
   * Disposal is explicit rather than automatic because loaded models are
   * cached and shared: a scene that clones a GLB must not dispose the
   * geometry and materials the cache still owns.
   */
  onDispose(fn: () => void): void;
}

export interface SceneInstance {
  /** Clicker steps that stay inside the scene, counting the one it enters on. */
  readonly beats?: number;

  enter(context: SceneContext, direction: NavDirection): void;

  /**
   * Move to `index`. `settle` reconstructs the state without animating, for
   * beats reached backwards or by jump.
   */
  beat?(index: number, settle: boolean): void;

  exit?(direction: NavDirection): void;
}

/**
 * Whether the 3D world is the subject or the backdrop.
 *
 * `foreground` — the world carries the argument; the camera is in the content.
 * `recessed` — the camera sits in open volume, fog closes and exposure drops,
 * leaving a dim depth field behind a designed 2D composition. The renderer
 * never stops and there is no cut to "a slide".
 */
export type RenderMode = 'foreground' | 'recessed';

export interface SceneDefinition {
  /** Permanent URL slug. */
  readonly id: string;
  readonly title: string;
  readonly chapter: string;
  /** Which built zone this scene is looking at. */
  readonly zone: string;
  readonly world: RenderMode;
  /** Where the camera comes to rest for this scene. */
  readonly pose: CameraPose;
  /** Asset ids that must be resolved before entering. */
  readonly assets?: readonly string[];
  /**
   * Entering this scene crosses a designed threshold out of the previous zone.
   *
   * Declared on the arriving scene rather than the departing one because a
   * crossing is a property of the boundary, and the boundary is only reached by
   * going somewhere. Only honoured travelling forwards: a jump back through a
   * door during questions wants to be a cut, not a set piece replayed at the
   * presenter.
   *
   * Implies its own pacing. `TRANSITION.camera` rate-limits every ordinary move
   * to 4.5 s, which is right for repositioning between two things the camera is
   * looking at and far too short for one that has to cover an avenue, open a
   * pair of doors and settle inside a building.
   */
  readonly crossing?: ZoneCrossing;
  create(): SceneInstance;
}
