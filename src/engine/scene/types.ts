import type { Group } from 'three';
import type { QualitySettings } from '@/config/quality';
import type { AssetLoader } from '@/engine/assets/AssetLoader';
import type { CameraPose } from '@/engine/camera/types';
import type { World } from '@/engine/render/World';
import type { FrameHandler, NavDirection } from '@/engine/types';

export interface SceneContext {
  /** DOM overlay layer for this scene. Removed automatically on exit. */
  readonly root: HTMLElement;
  /** 3D content root. Detached from the world automatically on exit. */
  readonly stage: Group;
  readonly world: World;
  readonly assets: AssetLoader;
  readonly quality: QualitySettings;
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
  enter(context: SceneContext, direction: NavDirection): void;
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
  create(): SceneInstance;
}
