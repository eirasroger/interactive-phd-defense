import type { Group, PerspectiveCamera } from 'three';
import type { QualitySettings } from '@/config/quality';
import type { AssetLoader } from '@/engine/assets/AssetLoader';
import type { CameraMoveOptions, CameraPose } from '@/engine/camera/types';
import type { Atmosphere } from '@/engine/render/atmosphere';
import type { World } from '@/engine/render/World';
import type { FrameHandler, NavDirection } from '@/engine/types';
import type { ZoneCrossing } from '@/engine/world/types';

export interface SceneContext {
  /** DOM overlay layer for this scene. Removed automatically on exit. */
  readonly root: HTMLElement;
  /** 3D content root. Detached from the world automatically on exit. */
  readonly stage: Group;
  readonly world: World;
  /** Read-only use: tethering DOM to world points. The camera director moves it. */
  readonly camera: PerspectiveCamera;
  readonly assets: AssetLoader;
  readonly quality: QualitySettings;
  /** Seconds of camera travel before content appears. Scene reveals must offset by it. */
  readonly entryDelay: number;
  /** Aborted on exit. */
  readonly signal: AbortSignal;

  onFrame(handler: FrameHandler): void;

  /**
   * Register cleanup for resources this scene created. Loaded models are cached
   * and shared, so never dispose geometry or materials owned by the cache.
   */
  onDispose(fn: () => void): void;
}

export interface SceneInstance {
  /** Clicker steps that stay inside the scene, counting the one it enters on. */
  readonly beats?: number;

  enter(context: SceneContext, direction: NavDirection): void;

  /** Move to `index`. `settle` sets the state without animating (backwards or jump). */
  beat?(index: number, settle: boolean): void;

  exit?(direction: NavDirection): void;
}

/**
 * Whether the 3D world is the subject or the backdrop.
 * `foreground`: the camera looks at 3D content.
 * `recessed`: fog closes and exposure drops, leaving a dim backdrop behind 2D
 * content. The renderer keeps running.
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
   * A designed threshold crossed on entry from the previous zone. Used only when
   * travelling forwards. Has its own pacing, since `TRANSITION.camera` caps
   * ordinary moves at 4.5 s.
   */
  readonly crossing?: ZoneCrossing;
  /**
   * Camera move with a fixed, designed duration that bypasses the
   * `TRANSITION.camera` cap. Used for set pieces such as the 60 m rise out of
   * the corridor. Used only when travelling forwards.
   */
  readonly travel?: CameraMoveOptions;
  /**
   * Transform of the zone's atmosphere for this scene. For scenes that leave the
   * volume the zone's fog was sized for.
   */
  readonly air?: (base: Atmosphere) => Atmosphere;
  create(): SceneInstance;
}
