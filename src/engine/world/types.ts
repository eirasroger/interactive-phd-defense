import type { Group, WebGLRenderer } from 'three';
import type { Vec3 } from '@/engine/camera/types';
import type { QualitySettings } from '@/config/quality';
import type { AssetLoader } from '@/engine/assets/AssetLoader';
import type { Atmosphere } from '@/engine/render/atmosphere';
import type { World } from '@/engine/render/World';

export interface ZoneContext {
  /** Zone content root, already positioned at the zone origin. */
  readonly stage: Group;
  readonly world: World;
  readonly renderer: WebGLRenderer;
  readonly quality: QualitySettings;
  /**
   * Assets are already resolved: scenes declare what their zone needs, and the
   * scene director loads them before the zone is entered.
   */
  readonly assets: AssetLoader;
}

export interface ZoneInstance {
  /**
   * How far through the zone's scene run the presentation has reached, 0 to 1.
   *
   * World state is derived from position in the deck rather than owned by
   * scenes, so navigating backwards restores it without any scene knowing that
   * it happened. `animate` is false for direct navigation, mirroring the
   * snap-versus-move split the camera already uses.
   */
  setProgress?(progress: number, animate: boolean): void;
  update?(dt: number): void;
  dispose(): void;
}

export interface ZoneDefinition {
  readonly id: string;
  readonly origin: Vec3;
  readonly atmosphere: Atmosphere;
  /** Shadow frustum sized to this zone's content. */
  readonly shadow: { readonly radius: number; readonly far: number };
  /** Zones with no built content — the demo span — declare atmosphere only. */
  create?(context: ZoneContext): ZoneInstance;
}
