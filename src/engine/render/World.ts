import {
  Color,
  DirectionalLight,
  Fog,
  Group,
  HemisphereLight,
  PMREMGenerator,
  Scene,
  type Texture,
  type WebGLRenderer,
} from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { WORLD } from '@/config/presentation';
import type { QualitySettings } from '@/config/quality';

/**
 * The single persistent scene graph.
 *
 * Scenes attach their content to `stage` and detach on exit; lighting, fog and
 * environment are global and never rebuilt, which is what makes movement
 * between scenes read as travel through one continuous space rather than as
 * separate rooms being swapped.
 */
export class World {
  readonly scene = new Scene();
  /** Scene content is parented here, keeping lights out of scene teardown. */
  readonly stage = new Group();

  private environment: Texture | null = null;
  private readonly keyLight: DirectionalLight;

  constructor(renderer: WebGLRenderer, quality: QualitySettings) {
    this.scene.background = new Color(WORLD.backgroundColor);
    this.scene.fog = new Fog(WORLD.fogColor, WORLD.fogNear, WORLD.fogFar);
    this.scene.add(this.stage);

    // Restrained levels: the palette is dark and the materials are light, so
    // over-lighting flattens every surface to white and destroys the colour
    // coding the scenes rely on to carry meaning.
    const ambient = new HemisphereLight(0xdfe8ff, 0x0a0c10, 0.45);
    this.scene.add(ambient);

    this.scene.environmentIntensity = 0.35;

    this.keyLight = new DirectionalLight(0xffffff, 1.5);
    this.keyLight.position.set(6, 12, 8);
    this.keyLight.castShadow = quality.shadows;
    this.keyLight.shadow.mapSize.setScalar(quality.shadowMapSize);
    this.keyLight.shadow.camera.near = 1;
    this.keyLight.shadow.camera.far = 60;
    this.keyLight.shadow.bias = -0.0005;
    this.scene.add(this.keyLight);

    this.buildEnvironment(renderer);
  }

  /**
   * Image-based lighting generated procedurally rather than loaded from an
   * HDR file: it costs no payload, needs no network, and keeps the offline
   * guarantee intact.
   */
  private buildEnvironment(renderer: WebGLRenderer): void {
    const pmrem = new PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    this.environment = pmrem.fromScene(room, 0.04).texture;
    this.scene.environment = this.environment;
    room.dispose();
    pmrem.dispose();
  }

  setQuality(quality: QualitySettings): void {
    this.keyLight.castShadow = quality.shadows;
    this.keyLight.shadow.mapSize.setScalar(quality.shadowMapSize);
    this.keyLight.shadow.map?.dispose();
    this.keyLight.shadow.map = null;
  }

  dispose(): void {
    this.environment?.dispose();
  }
}
