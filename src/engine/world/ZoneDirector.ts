import {
  Group,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  WebGLRenderTarget,
  type Texture,
  type WebGLRenderer,
} from 'three';
import { TRANSITION } from '@/config/presentation';
import type { QualitySettings } from '@/config/quality';
import type { AssetLoader } from '@/engine/assets/AssetLoader';
import type { CameraDirector } from '@/engine/camera/CameraDirector';
import type { AtmosphereDirector } from '@/engine/render/AtmosphereDirector';
import { recessed, type Atmosphere } from '@/engine/render/atmosphere';
import type { World } from '@/engine/render/World';
import type { RenderMode } from '@/engine/scene/types';
import type { ZoneCrossing, ZoneDefinition, ZoneInstance } from './types';

interface ActiveZone {
  readonly definition: ZoneDefinition;
  readonly instance: ZoneInstance | null;
  readonly group: Group;
}

/** An outgoing zone kept alive until the camera is past the threshold. */
interface Departing {
  readonly zone: ActiveZone;
  readonly releaseAtZ: number;
}

/**
 * Owns the lifetime of each zone. A zone is mounted when the deck enters its
 * scenes and parked when it leaves. Teardown is immediate unless the scene
 * declares a `ZoneCrossing`, which keeps the old zone until the camera passes a
 * given z. Zones are built once and never rebuilt. See `learnings.md` §39.
 */
export class ZoneDirector {
  private active: ActiveZone | null = null;
  private readonly built = new Map<string, ActiveZone>();
  private departing: Departing | null = null;
  /** Next zone, mounted behind the current one before it is entered. */
  private warmed: ActiveZone | null = null;
  /** Zone a crossing is leaving. Cleared once its atmosphere is used. */
  private leaving: ZoneDefinition | null = null;

  constructor(
    private readonly world: World,
    private readonly renderer: WebGLRenderer,
    private readonly quality: QualitySettings,
    private readonly atmosphere: AtmosphereDirector,
    private readonly assets: AssetLoader,
    /**
     * Used to release a departing zone: camera position plus `isMoving`, which
     * a bare camera cannot report.
     */
    private readonly camera: CameraDirector,
  ) {}

  enter(
    definition: ZoneDefinition,
    mode: RenderMode,
    progress: number,
    animate: boolean,
    crossing: ZoneCrossing | null = null,
    air: ((base: Atmosphere) => Atmosphere) | null = null,
    /**
     * Duration of the camera move, so the atmosphere eases over the same time.
     * Defaults to the standard hop limit.
     */
    travelSeconds: number = TRANSITION.camera.maxSeconds,
  ): void {
    const changed = this.active?.definition.id !== definition.id;

    // A new navigation during a crossing abandons it: the camera has a new move.
    if (changed || !crossing) this.releaseDeparting();

    if (changed) {
      const outgoing = this.active;
      this.active = null;

      if (outgoing && crossing && animate) {
        // Opened before the new zone mounts so the doors start with the camera.
        outgoing.instance?.setThreshold?.(true, crossing.seconds);
        this.leaving = outgoing.definition;
        this.departing = { zone: outgoing, releaseAtZ: crossing.releaseAtZ };
      } else if (outgoing) {
        this.park(outgoing);
      }

      this.active = this.mount(definition);
    }

    this.active?.instance?.setProgress?.(progress, animate && !changed);

    const base = air ? air(definition.atmosphere) : definition.atmosphere;
    const target = mode === 'recessed' ? recessed(base) : base;

    // A crossing blends from the old zone's atmosphere to the new one inside
    // the `CROSSING_LIGHT` window. See `AtmosphereDirector.crossTo`.
    if (changed && crossing && animate && this.leaving) {
      this.atmosphere.crossTo(this.leaving.atmosphere, target, crossing.seconds, CROSSING_LIGHT);
      this.leaving = null;
    } else if (animate && !changed) {
      this.atmosphere.moveTo(target, travelSeconds);
    } else {
      this.atmosphere.snapTo(target);
    }
  }

  update(dt: number): void {
    this.active?.instance?.update?.(dt);

    const departing = this.departing;
    if (!departing) return;

    departing.zone.instance?.update?.(dt);

    // Release when the camera passes `releaseAtZ`, or when its move ends in
    // case the pose stops short. Uses camera state because GSAP time is scaled
    // and can drift from `dt`.
    if (this.camera.camera.position.z < departing.releaseAtZ || !this.camera.isMoving) {
      this.releaseDeparting();
    }
  }

  dispose(): void {
    this.releaseDeparting();
    if (this.active) this.park(this.active);
    this.active = null;
    for (const zone of this.built.values()) zone.instance?.dispose();
    this.built.clear();
  }

  /** Whether a zone has already been built, uploaded and compiled. */
  isPrepared(id: string): boolean {
    return this.built.has(id);
  }

  /** Whether this zone is already standing behind the current one. */
  isWarmed(id: string): boolean {
    return this.warmed?.definition.id === id;
  }

  /**
   * Builds a zone, uploads its textures and buffers, and compiles its shaders
   * during load. On the corridor this avoids a 1.7 s compile mid-talk.
   * The group must be visible here because `compile` uses `traverseVisible`.
   */
  async prepare(definition: ZoneDefinition): Promise<void> {
    if (this.built.has(definition.id)) return;

    const zone = this.build(definition);
    this.world.zones.add(zone.group);
    this.upload(zone.group);

    await this.renderer
      .compileAsync(this.world.scene, this.camera.camera)
      .catch(() => {
        // A failed precompile only costs a hitch later.
      });

    this.paint(zone.group);
    this.park(zone);
  }

  /**
   * Renders only this zone into a 1x1 target so its vertex and index buffers
   * upload now (they upload on first draw). Frustum culling is off because the
   * camera is in another zone. Shadows stay on so depth programs compile too.
   */
  private paint(group: Group): void {
    const target = new WebGLRenderTarget(1, 1);
    const previous = this.renderer.getRenderTarget();
    const restored: Object3D[] = [];
    const culled: Mesh[] = [];

    for (const child of this.world.zones.children) {
      if (child === group || !child.visible) continue;
      child.visible = false;
      restored.push(child);
    }
    if (this.world.stage.visible) {
      this.world.stage.visible = false;
      restored.push(this.world.stage);
    }

    group.traverse((child) => {
      const mesh = child as Mesh;
      if (!mesh.isMesh || !mesh.frustumCulled) return;
      mesh.frustumCulled = false;
      culled.push(mesh);
    });

    this.renderer.setRenderTarget(target);
    this.renderer.render(this.world.scene, this.camera.camera);
    this.renderer.setRenderTarget(previous);

    for (const mesh of culled) mesh.frustumCulled = true;
    for (const object of restored) object.visible = true;
    target.dispose();
  }

  /**
   * Adds the next zone to the scene graph a beat early. Cheap after `prepare`.
   * Builds on demand if the zone was never prepared.
   */
  warm(definition: ZoneDefinition): void {
    if (this.active?.definition.id === definition.id) return;
    if (this.warmed?.definition.id === definition.id) return;

    this.unwarm();

    const zone = this.built.get(definition.id) ?? this.build(definition);
    this.warmed = zone;
    this.world.zones.add(zone.group);
    this.active?.instance?.setBeyond?.(true);
  }

  /**
   * Uploads a zone's textures now. `compileAsync` skips textures, which would
   * otherwise upload on the first frame that samples them.
   */
  private upload(group: Group): void {
    const seen = new Set<Texture>();
    group.traverse((child) => {
      const mesh = child as Mesh;
      if (!mesh.isMesh) return;
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const material of materials) {
        if (!(material instanceof MeshStandardMaterial)) continue;
        for (const map of [
          material.map,
          material.normalMap,
          material.roughnessMap,
          material.metalnessMap,
          material.aoMap,
          material.emissiveMap,
        ]) {
          if (!map || seen.has(map)) continue;
          seen.add(map);
          this.renderer.initTexture(map);
        }
      }
    });
  }

  /**
   * Removes a warmed zone and resets `setBeyond` on the current one. Used when
   * the presenter navigates back before the crossing.
   */
  unwarm(): void {
    const warmed = this.warmed;
    if (!warmed) return;
    this.warmed = null;
    this.world.zones.remove(warmed.group);
    this.active?.instance?.setBeyond?.(false);
  }

  private mount(definition: ZoneDefinition): ActiveZone {
    // Entering a warmed zone keeps its group in the graph.
    if (this.warmed?.definition.id === definition.id) this.warmed = null;

    const zone = this.built.get(definition.id) ?? this.build(definition);
    this.world.zones.add(zone.group);
    // During a crossing the old zone keeps the shadow rig until release.
    if (!this.departing) this.aim(zone);
    return zone;
  }

  private build(definition: ZoneDefinition): ActiveZone {
    const group = new Group();
    group.name = `zone:${definition.id}`;
    group.position.set(...definition.origin);

    const instance =
      definition.create?.({
        stage: group,
        world: this.world,
        renderer: this.renderer,
        camera: this.camera.camera,
        quality: this.quality,
        assets: this.assets,
      }) ?? null;

    const zone = { definition, instance, group };
    this.built.set(definition.id, zone);
    return zone;
  }

  /** Points the key light, shadow frustum and sky at this zone. */
  private aim(zone: ActiveZone): void {
    const { definition } = zone;
    this.world.setLightTarget(definition.origin);
    this.world.fitShadow(definition.shadow.radius, definition.shadow.far);
    zone.instance?.takeSky?.();
  }

  private releaseDeparting(): void {
    const departing = this.departing;
    if (!departing) return;
    this.departing = null;
    this.park(departing.zone);
    // Deferred from `mount` during a crossing.
    if (this.active) this.aim(this.active);
  }

  private park(zone: ActiveZone): void {
    zone.instance?.suspend?.();
    this.world.zones.remove(zone.group);
  }
}

/**
 * Crossing light timing, as fractions (0 to 1) of the move. Must match the
 * profile in `animations/entry.ts`: the camera reaches the doorway at 0.34 and
 * clears the vestibule by about 0.55. `lift` ends before the doors open;
 * `from`/`to` confine the light change to the vestibule.
 */
const CROSSING_LIGHT = { lift: 0.22, from: 0.34, to: 0.56 } as const;
