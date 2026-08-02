import { Group, type WebGLRenderer } from 'three';
import { TRANSITION } from '@/config/presentation';
import type { QualitySettings } from '@/config/quality';
import type { AssetLoader } from '@/engine/assets/AssetLoader';
import type { AtmosphereDirector } from '@/engine/render/AtmosphereDirector';
import { recessed } from '@/engine/render/atmosphere';
import type { World } from '@/engine/render/World';
import type { RenderMode } from '@/engine/scene/types';
import type { ZoneDefinition, ZoneInstance } from './types';

interface ActiveZone {
  readonly definition: ZoneDefinition;
  readonly instance: ZoneInstance | null;
  readonly group: Group;
}

/**
 * Owns the built world's lifetime.
 *
 * A zone is mounted when the presentation enters its run of scenes and released
 * when it leaves, which is a far coarser cadence than scene changes. Teardown is
 * immediate rather than deferred: a zone boundary is always a designed
 * transition — walking through a door — so there is nothing to dissolve.
 */
export class ZoneDirector {
  private active: ActiveZone | null = null;

  constructor(
    private readonly world: World,
    private readonly renderer: WebGLRenderer,
    private readonly quality: QualitySettings,
    private readonly atmosphere: AtmosphereDirector,
    private readonly assets: AssetLoader,
  ) {}

  enter(definition: ZoneDefinition, mode: RenderMode, progress: number, animate: boolean): void {
    const changed = this.active?.definition.id !== definition.id;
    if (changed) {
      this.release();
      this.active = this.mount(definition);
    }

    // A zone change re-establishes light and world state rather than easing
    // into it: there is nothing on screen yet for a tween to be continuous with.
    const move = animate && !changed;

    this.active?.instance?.setProgress?.(progress, move);

    const target = mode === 'recessed' ? recessed(definition.atmosphere) : definition.atmosphere;
    if (move) {
      this.atmosphere.moveTo(target, TRANSITION.cameraSeconds);
    } else {
      this.atmosphere.snapTo(target);
    }
  }

  update(dt: number): void {
    this.active?.instance?.update?.(dt);
  }

  dispose(): void {
    this.release();
  }

  private mount(definition: ZoneDefinition): ActiveZone {
    const group = new Group();
    group.name = `zone:${definition.id}`;
    group.position.set(...definition.origin);
    this.world.zones.add(group);

    this.world.setLightTarget(definition.origin);
    this.world.fitShadow(definition.shadow.radius, definition.shadow.far);

    const instance =
      definition.create?.({
        stage: group,
        world: this.world,
        renderer: this.renderer,
        quality: this.quality,
        assets: this.assets,
      }) ?? null;

    return { definition, instance, group };
  }

  private release(): void {
    const active = this.active;
    if (!active) return;
    this.active = null;

    active.instance?.dispose();
    this.world.zones.remove(active.group);
  }
}
