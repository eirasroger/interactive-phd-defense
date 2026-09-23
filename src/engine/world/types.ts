import type { Group, PerspectiveCamera, WebGLRenderer } from 'three';
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
  /**
   * The deck camera, used for level of detail (e.g. park tree billboards).
   * Safe to hold: `CameraRig` owns one camera for the whole deck.
   */
  readonly camera: PerspectiveCamera;
  readonly quality: QualitySettings;
  /** Already loaded by the scene director before the zone is entered. */
  readonly assets: AssetLoader;
}

export interface ZoneInstance {
  /**
   * Progress through the zone's scenes, 0 to 1. World state is derived from
   * deck position, so backward navigation restores it. `animate` is false for
   * direct jumps.
   */
  setProgress?(progress: number, animate: boolean): void;
  /**
   * One-off exit event, such as building doors opening as the camera
   * approaches. `seconds` is the length of the camera move; `seconds <= 0`
   * sets the state without animating.
   */
  setThreshold?(open: boolean, seconds: number): void;
  setBeyond?(present: boolean): void;
  /**
   * Installs this zone's background and environment map. Called on mount, or
   * at the release point during a crossing so the outgoing sky stays while it
   * is on screen. A zone with no sky should implement this to clear it.
   */
  takeSky?(): void;
  update?(dt: number): void;
  suspend?(): void;
  dispose(): void;
}

/**
 * A continuous camera move between two zones, declared by the scene being
 * entered. Both zones stay mounted during the move. Without a crossing, a zone
 * change is a cut.
 */
export interface ZoneCrossing {
  /** Length of the camera move this happens inside. */
  readonly seconds: number;
  /**
   * World z at which the outgoing zone is released, once it is behind the
   * doorway. The deck travels along -Z, so this fires when camera z drops
   * below it.
   */
  readonly releaseAtZ: number;
}

export interface ZoneDefinition {
  readonly id: string;
  readonly origin: Vec3;
  readonly atmosphere: Atmosphere;
  /** Shadow frustum sized to this zone's content. */
  readonly shadow: { readonly radius: number; readonly far: number };
  /** Omitted by zones with no built content (the demo span). */
  create?(context: ZoneContext): ZoneInstance;
}
