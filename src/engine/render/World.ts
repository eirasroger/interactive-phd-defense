import {
  Color,
  DirectionalLight,
  Fog,
  Group,
  HemisphereLight,
  Object3D,
  PMREMGenerator,
  Scene,
  type Texture,
  type WebGLRenderer,
} from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { Vec3 } from '@/engine/camera/types';
import type { QualitySettings } from '@/config/quality';
import type { AtmosphereState } from './AtmosphereDirector';

/**
 * The single persistent scene graph.
 *
 * Two content roots, with different lifetimes. `zones` holds the built world —
 * a building, a corridor — which outlives any one scene and is never touched by
 * scene teardown. `stage` holds per-scene content, attached on enter and
 * detached on exit. Keeping them apart is what allows nine scenes to look at
 * one building without rebuilding it nine times.
 *
 * Lighting, fog and background are global and never rebuilt. They are *driven*,
 * by whatever atmosphere the current zone and render mode resolve to.
 */
export class World {
  readonly scene = new Scene();
  /** Per-scene content. Detached on scene exit. */
  readonly stage = new Group();
  /** Persistent zone content. Outlives scenes. */
  readonly zones = new Group();

  private readonly fog = new Fog(0x000000, 1, 100);
  private readonly ambient = new HemisphereLight(0xffffff, 0x000000, 0);
  private readonly keyLight = new DirectionalLight(0xffffff, 0);
  private readonly backgroundColor = new Color();
  private readonly lightTarget = new Object3D();

  private defaultEnvironment: Texture | null = null;
  private background: Texture | null = null;

  constructor(renderer: WebGLRenderer, quality: QualitySettings) {
    this.scene.fog = this.fog;
    this.scene.background = this.backgroundColor;
    this.scene.add(this.stage, this.zones, this.ambient);

    this.keyLight.target = this.lightTarget;
    this.keyLight.shadow.bias = -0.0006;
    this.keyLight.shadow.normalBias = 0.02;
    this.scene.add(this.keyLight, this.lightTarget);
    this.setQuality(quality);
    this.fitShadow(5, 60);

    this.buildDefaultEnvironment(renderer);
  }

  /**
   * Image-based lighting generated procedurally rather than loaded from an HDR
   * file: it costs no payload, needs no network, and keeps the offline
   * guarantee intact. Zones with their own sky override it.
   */
  private buildDefaultEnvironment(renderer: WebGLRenderer): void {
    const pmrem = new PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    this.defaultEnvironment = pmrem.fromScene(room, 0.04).texture;
    this.scene.environment = this.defaultEnvironment;
    room.dispose();
    pmrem.dispose();
  }

  /** Called every frame with the director's interpolated state. */
  applyAtmosphere(state: AtmosphereState): void {
    this.fog.color.copy(state.fogColor);
    this.fog.near = state.fogNear;
    this.fog.far = state.fogFar;

    // A background that does not match the fog produces a visible seam where
    // distant geometry stops. Zones that supply a sky take over the match.
    if (!this.background) this.backgroundColor.copy(state.fogColor);

    this.ambient.color.copy(state.skyColor);
    this.ambient.groundColor.copy(state.groundColor);
    this.ambient.intensity = state.ambientIntensity;

    this.keyLight.color.copy(state.keyColor);
    this.keyLight.intensity = state.keyIntensity;
    this.keyLight.position.set(
      this.lightTarget.position.x + state.keyX,
      this.lightTarget.position.y + state.keyY,
      this.lightTarget.position.z + state.keyZ,
    );

    this.scene.environmentIntensity = state.environmentIntensity;
    this.scene.backgroundIntensity = state.backgroundIntensity;
  }

  /**
   * Recentres the key light so its shadow frustum follows the active zone.
   * A directional shadow camera is centred on the light's target, so a zone
   * placed 200 units down the world would otherwise fall outside it entirely.
   */
  setLightTarget(origin: Vec3): void {
    this.lightTarget.position.set(...origin);
    this.lightTarget.updateMatrixWorld();
  }

  /** Sizes the shadow frustum to the zone that is being lit. */
  fitShadow(radius: number, far: number): void {
    const camera = this.keyLight.shadow.camera;
    camera.left = -radius;
    camera.right = radius;
    camera.top = radius;
    camera.bottom = -radius;
    camera.near = 1;
    camera.far = far;
    camera.updateProjectionMatrix();
  }

  /** A zone's sky. `null` restores the fog-matched flat background. */
  setBackground(texture: Texture | null): void {
    this.background = texture;
    this.scene.background = texture ?? this.backgroundColor;
  }

  /** A zone's image-based lighting. `null` restores the default room. */
  setEnvironment(texture: Texture | null): void {
    this.scene.environment = texture ?? this.defaultEnvironment;
  }

  setQuality(quality: QualitySettings): void {
    this.keyLight.castShadow = quality.shadows;
    this.keyLight.shadow.mapSize.setScalar(quality.shadowMapSize);
    this.keyLight.shadow.map?.dispose();
    this.keyLight.shadow.map = null;
  }

  dispose(): void {
    this.defaultEnvironment?.dispose();
  }
}
