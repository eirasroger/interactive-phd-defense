import { Group, type WebGLRenderer } from 'three';
import { TRANSITION } from '@/config/presentation';
import type { QualitySettings } from '@/config/quality';
import type { AssetLoader } from '@/engine/assets/AssetLoader';
import type { CameraDirector } from '@/engine/camera/CameraDirector';
import type { AtmosphereDirector } from '@/engine/render/AtmosphereDirector';
import { recessed } from '@/engine/render/atmosphere';
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

    const target = mode === 'recessed' ? recessed(definition.atmosphere) : definition.atmosphere;

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

  warm(definition: ZoneDefinition): void {
    if (this.active?.definition.id === definition.id) return;

    const zone = this.built.get(definition.id) ?? this.build(definition);
    this.world.zones.add(zone.group);
    this.active?.instance?.setBeyond?.(true);
  }

  private mount(definition: ZoneDefinition): ActiveZone {
    const zone = this.built.get(definition.id) ?? this.build(definition);
    this.world.zones.add(zone.group);
    // The shadow rig belongs to whichever zone is being *looked at*, which
    // during a crossing is still the one being left. Refitting it on mount
    // dropped a 58 m frustum to a 6 m one at the moment the crossing began —
    // so the sunlit building lost every shadow it had while the camera was
    // still fifty metres away looking straight at it. It is handed over with
    // the release instead.
    if (!this.departing) this.aim(definition);
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
        quality: this.quality,
        assets: this.assets,
      }) ?? null;

    const zone = { definition, instance, group };
    this.built.set(definition.id, zone);
    return zone;
  }

  /** Points the key light and its shadow frustum at a zone. */
  private aim(definition: ZoneDefinition): void {
    this.world.setLightTarget(definition.origin);
    this.world.fitShadow(definition.shadow.radius, definition.shadow.far);
  }

  private releaseDeparting(): void {
    const departing = this.departing;
    if (!departing) return;
    this.departing = null;
    this.park(departing.zone);
    // Deferred to here rather than done at mount — see `mount`.
    if (this.active) this.aim(this.active.definition);
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
