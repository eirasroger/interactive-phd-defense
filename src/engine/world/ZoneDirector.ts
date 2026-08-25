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
 * Owns the built world's lifetime.
 *
 * A zone is mounted when the presentation enters its run of scenes and taken out
 * of the scene graph when it leaves, which is a far coarser cadence than scene
 * changes.
 *
 * **Teardown is immediate unless the scene declares a crossing.** The original
 * reasoning was that a zone boundary is always a designed transition — walking
 * through a door — so there is nothing to dissolve. Half of that is right and
 * half is exactly backwards: walking through a door is the one case where both
 * worlds are on screen at once, and the frame in which the outside can stop
 * being drawn is a place in the geometry rather than a moment on a clock. A
 * `ZoneCrossing` is what says which case this is.
 *
 * A zone is built once and then parked, never rebuilt. Parking removes the group
 * from the scene graph and leaves the instance alive; `dispose` is the end of
 * the deck. See `learnings.md` §39.
 */
export class ZoneDirector {
  private active: ActiveZone | null = null;
  private readonly built = new Map<string, ActiveZone>();
  private departing: Departing | null = null;
  /** The zone standing behind the current one, waiting to be walked into. */
  private warmed: ActiveZone | null = null;
  /** The zone a crossing is leaving, held only long enough to route through it. */
  private leaving: ZoneDefinition | null = null;

  constructor(
    private readonly world: World,
    private readonly renderer: WebGLRenderer,
    private readonly quality: QualitySettings,
    private readonly atmosphere: AtmosphereDirector,
    private readonly assets: AssetLoader,
    /**
     * Read to decide when a departing zone is safely out of shot — both where
     * the camera is and whether it is still travelling. The director rather
     * than the bare camera, because "the move has finished" is not something a
     * `Object3D` can answer and a clock of our own gets it wrong.
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
  ): void {
    const changed = this.active?.definition.id !== definition.id;

    // A second navigation while one crossing is still in flight abandons it.
    // The camera has already been taken over by the new move, so the world the
    // release was waiting on is no longer the one being left.
    if (changed || !crossing) this.releaseDeparting();

    if (changed) {
      const outgoing = this.active;
      this.active = null;

      if (outgoing && crossing && animate) {
        // Opened *before* the new zone mounts, so the doors start moving on the
        // same frame the camera does.
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

    // Light and air ease across a crossing and are set otherwise. A crossing
    // goes via the world it is leaving, at full strength, before it goes
    // inside, and its change of light is confined to the stretch where the
    // camera is between the two — see `AtmosphereDirector.crossTo`.
    if (changed && crossing && animate && this.leaving) {
      this.atmosphere.crossTo(this.leaving.atmosphere, target, crossing.seconds, CROSSING_LIGHT);
      this.leaving = null;
    } else if (animate && !changed) {
      this.atmosphere.moveTo(target, TRANSITION.camera.maxSeconds);
    } else {
      this.atmosphere.snapTo(target);
    }
  }

  update(dt: number): void {
    this.active?.instance?.update?.(dt);

    const departing = this.departing;
    if (!departing) return;

    departing.zone.instance?.update?.(dt);

    // The plane is what normally fires. The move ending is insurance against a
    // pose edited to stop short of it, because a zone left mounted forever is a
    // whole outdoors being drawn behind a wall for the rest of the talk.
    //
    // **Insurance, and not a timer.** It was a countdown of `dt` against the
    // crossing's declared length, which is wrong in a way that only shows up
    // when the two clocks disagree: `dt` is wall-clock and the move runs on
    // GSAP's, which is scaled — by the reduced-motion setting in production and
    // by `__time` while this transition was being authored. Slowed to 0.06 the
    // countdown expired 33 m short of the door and deleted the entire outdoors
    // with the camera still standing on the avenue looking at it. Asking the
    // camera whether it has stopped cannot drift from the camera.
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
   * Pay a zone's entire standing-up cost once, before the talk starts.
   *
   * `warm` was written to move this work off the beat that plays the
   * contributions morph, and it moved it exactly one beat: onto the beat
   * before, which is the last thing said before the deck walks through the
   * door. Measured on the corridor, that beat cost 127 ms of blocked main
   * thread and a **1.7 second** `compileAsync` — the GPU building 42 shader
   * programs while it is also drawing, which is a stutter through the whole
   * approach even though the main thread is mostly free.
   *
   * There is no beat of a defence where that is acceptable, because every beat
   * has someone speaking over it. The only moment the deck may block is the one
   * the audience is not watching: the load. So the work moves there in full,
   * and `warm` goes back to being what its name says — putting an already
   * finished world into the scene graph, which is a pointer assignment.
   *
   * The group has to be **visible** while this runs: `WebGLRenderer.compile`
   * walks the scene with `traverseVisible`, so a hidden group compiles nothing
   * and the whole cost simply arrives later. It is parked again immediately
   * afterwards, and the loading screen is over the canvas throughout.
   */
  async prepare(definition: ZoneDefinition): Promise<void> {
    if (this.built.has(definition.id)) return;

    const zone = this.build(definition);
    this.world.zones.add(zone.group);
    this.upload(zone.group);

    await this.renderer
      .compileAsync(this.world.scene, this.camera.camera)
      .catch(() => {
        // A failed precompile costs a hitch later, not a broken deck.
      });

    this.paint(zone.group);
    this.park(zone);
  }

  /**
   * Draw the zone once, into a single pixel, so its geometry reaches the GPU.
   *
   * `compileAsync` builds programs and `upload` pushes textures, and between
   * them they still leave the largest buffers on the CPU: **vertex and index
   * data uploads on the first draw call that uses it**, and nothing before that
   * frame asks for it. So the corridor still arrived with tens of megabytes of
   * `bufferData` on the beat it was warmed — small enough to stop reading as a
   * freeze once the shaders had moved, and still a visible catch.
   *
   * Drawing it is the only thing that forces the upload, so it is drawn. Into a
   * 1x1 target, with everything else in the scene hidden, so every draw call
   * issues and every buffer is bound while almost no fragment is shaded. Frustum
   * culling is switched off for the pass because the camera is standing in
   * another zone entirely and would otherwise reject the very geometry this is
   * here to upload.
   *
   * Shadows are left on: a foliage or lightmapped material's depth variant is a
   * separate program with its own buffers, and skipping the shadow pass here
   * would leave exactly half the work to arrive later.
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
   * Stand the next zone up a beat early.
   *
   * Cheap now: `prepare` has already built the instance, uploaded its textures
   * and compiled its programs, so this is the scene-graph half of what this
   * method used to do and nothing else.
   *
   * It still falls back to building on demand. `prepare` runs at load for every
   * zone the deck names, so that path is only reached if one was added without
   * being registered — in which case a stutter here is the right failure, and a
   * far better one than a missing world.
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
   * Push a zone's textures to the GPU before anything draws them.
   *
   * `compileAsync` builds shader *programs*; it does not upload textures, and
   * a texture uploads on the first frame that samples it. For this zone that is
   * a 4096 occlusion atlas plus its detail maps arriving in one frame, which is
   * tens of megabytes of `texImage2D` on the main thread — the rest of the
   * hitch after the recompile was moved off it.
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
   * Take a warmed zone back out of the graph.
   *
   * Warming is not a one-way door. A defence is not walked in a straight line:
   * a question sends the presenter backwards, and a zone that was stood up for
   * a crossing that then did not happen is a whole other world left standing
   * behind the one on screen — the corridor visible through the entrance glass
   * on every earlier Act I frame, with the recess plug still open for it.
   * Whatever `warm` did, this undoes, including the state it asked the zone in
   * front to hold.
   */
  unwarm(): void {
    const warmed = this.warmed;
    if (!warmed) return;
    this.warmed = null;
    this.world.zones.remove(warmed.group);
    this.active?.instance?.setBeyond?.(false);
  }

  private mount(definition: ZoneDefinition): ActiveZone {
    // Being entered is not being unwarmed: the group stays in the graph, it
    // just stops being something that can be taken back out.
    if (this.warmed?.definition.id === definition.id) this.warmed = null;

    const zone = this.built.get(definition.id) ?? this.build(definition);
    this.world.zones.add(zone.group);
    // The shadow rig belongs to whichever zone is being *looked at*, which
    // during a crossing is still the one being left. Refitting it on mount
    // dropped a 58 m frustum to a 6 m one at the moment the crossing began —
    // so the sunlit building lost every shadow it had while the camera was
    // still fifty metres away looking straight at it. It is handed over with
    // the release instead.
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

  /**
   * Hands a zone everything that belongs to whichever one is being looked at:
   * the key light's target, its shadow frustum, and the sky.
   */
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
    // Deferred to here rather than done at mount — see `mount`.
    if (this.active) this.aim(this.active);
  }

  private park(zone: ActiveZone): void {
    zone.instance?.suspend?.();
    this.world.zones.remove(zone.group);
  }
}

/**
 * The crossing's light, in fractions of the move.
 *
 * These are read against `animations/entry.ts`, which is what makes them
 * meaningful rather than arbitrary: that profile is front-loaded, so the camera
 * is at the doorway by `t = 0.34` having covered 70% of the distance, and is
 * through the vestibule and past the handover by about `t = 0.55`.
 *
 * `lift` ends at 0.22 — early, while the building still fills the frame and
 * before the doors part, because that is when the world wants to be at its best.
 *
 * `from`/`to` bracket the vestibule. Before 0.34 the camera is outside and the
 * light has to stay the forecourt's; after 0.55 the outdoors has stopped being
 * drawn and anything still owed shows up as fog rolling into a corridor that
 * ought to have been dim when it was revealed. The nine metres in between are
 * where a threshold's change of light belongs anyway.
 */
const CROSSING_LIGHT = { lift: 0.22, from: 0.34, to: 0.56 } as const;
