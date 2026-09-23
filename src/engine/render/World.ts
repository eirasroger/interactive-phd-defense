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
 * The single persistent scene graph. `zones` holds built world content that
 * outlives scenes. `stage` holds per-scene content. Lighting, fog and
 * background are global and driven by the current atmosphere.
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
   * Procedural image-based lighting, so no HDR download is needed and the deck
   * works offline. Zones with their own sky override it.
   */
  private buildDefaultEnvironment(renderer: WebGLRenderer): void {
    const pmrem = new PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    this.defaultEnvironment = pmrem.fromScene(room, 0.04).texture;
    this.scene.environment = this.defaultEnvironment;
    room.dispose();
    pmrem.dispose();
  }

  /**
   * Current tone-mapping exposure. `OutputPass` applies ACES to the whole
   * frame and ignores `toneMapped` (learnings §59), so fixed-look surfaces read
   * this to cancel exposure in their own colour.
   */
  exposure = 1;

  /** Called every frame with the director's interpolated state. */
  applyAtmosphere(state: AtmosphereState): void {
    this.exposure = state.exposure;

    this.fog.color.copy(state.fogColor);
    this.fog.near = state.fogNear;
    this.fog.far = state.fogFar;

    // Match background to fog to avoid a seam at the horizon. Zones with a sky
    // handle this themselves.
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
   * Recentres the key light on the active zone. The directional shadow camera
   * is centred on the light target.
   */
  setLightTarget(origin: Vec3): void {
    this.lightTarget.position.set(...origin);
    this.lightTarget.updateMatrixWorld();
  }

  /** Sizes the shadow frustum to the lit zone. */
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

  /** Sets a zone's sky. `null` restores the fog-coloured background. */
  setBackground(texture: Texture | null): void {
    this.background = texture;
    this.scene.background = texture ?? this.backgroundColor;
  }

  /** Sets a zone's image-based lighting. `null` restores the default room. */
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
