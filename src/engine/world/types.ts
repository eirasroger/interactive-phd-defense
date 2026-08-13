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
  /**
   * The presentation is leaving this zone through a designed threshold.
   *
   * Distinct from `setProgress`, which is world state derived from the deck and
   * is true for as long as the scene is. This is a one-off event with a
   * duration: the doors of a building opening as the camera comes down the
   * avenue. `seconds` is the length of the camera move it happens inside, so a
   * zone can phase itself against the move rather than against a clock of its
   * own — and `seconds <= 0` means set the open state without animating, for a
   * jump.
   */
  setThreshold?(open: boolean, seconds: number): void;
  setBeyond?(present: boolean): void;
  update?(dt: number): void;
  suspend?(): void;
  dispose(): void;
}

/**
 * A designed crossing between two zones, declared by the scene being entered.
 *
 * Without one, a zone change is a cut: the outgoing world is released, the new
 * one is mounted, and light and air are set rather than eased, because there is
 * nothing on screen for a tween to be continuous with. That is the right
 * default and it is what every zone boundary in the deck used to be.
 *
 * A crossing says the opposite is true — that the camera travels from one world
 * into the other through geometry that belongs to both, and that for a couple
 * of seconds they are the same place.
 */
export interface ZoneCrossing {
  /** Length of the camera move this happens inside. */
  readonly seconds: number;
  /**
   * World z the camera passes through, at which the outgoing zone is released.
   *
   * A plane, not a moment, because what makes the release invisible is *where*
   * the camera is and not how long it has been travelling: it has to be far
   * enough inside that the outgoing world is behind the doorway. The whole deck
   * is traversed along −Z, so the plane is crossed when the camera's z falls
   * below this.
   */
  readonly releaseAtZ: number;
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
