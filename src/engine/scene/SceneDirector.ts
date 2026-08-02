import { Group } from 'three';
import { TRANSITION } from '@/config/presentation';
import type { QualitySettings } from '@/config/quality';
import type { AssetLoader } from '@/engine/assets/AssetLoader';
import type { CameraDirector } from '@/engine/camera/CameraDirector';
import type { Clock } from '@/engine/Clock';
import type { World } from '@/engine/render/World';
import type { FrameHandler, NavDirection } from '@/engine/types';
import type { SceneContext, SceneDefinition, SceneInstance } from './types';

/** How long an exiting layer stays mounted so its transition can play out. */
const EXIT_REMOVAL_MS = 1400;

interface ActiveScene {
  readonly instance: SceneInstance;
  readonly layer: HTMLElement;
  readonly group: Group;
  readonly controller: AbortController;
  readonly disposers: Array<() => void>;
}

export interface SceneState {
  readonly index: number;
  readonly total: number;
  readonly definition: SceneDefinition;
  /** How the scene was reached. `jump` means direct navigation, so no easing. */
  readonly direction: NavDirection;
}

export interface SceneDirectorDeps {
  readonly overlay: HTMLElement;
  readonly world: World;
  readonly camera: CameraDirector;
  readonly assets: AssetLoader;
  readonly clock: Clock;
  readonly quality: QualitySettings;
  readonly onLoadingChange: (loading: boolean, progress: number) => void;
}

/**
 * Owns scene lifecycle and the transition between scenes.
 *
 * Requests are tokenised: if the presenter moves on while assets are still
 * loading, the stale request is abandoned rather than mounting a scene that
 * has already been navigated past.
 */
export class SceneDirector {
  private readonly listeners = new Set<(state: SceneState) => void>();
  private active: ActiveScene | null = null;
  private index = -1;
  private token = 0;
  private direction: NavDirection = 'jump';

  constructor(
    private readonly scenes: readonly SceneDefinition[],
    private readonly deps: SceneDirectorDeps,
  ) {
    if (scenes.length === 0) throw new Error('At least one scene is required.');
  }

  get currentIndex(): number {
    return this.index;
  }

  get count(): number {
    return this.scenes.length;
  }

  indexOf(id: string): number {
    return this.scenes.findIndex((scene) => scene.id === id);
  }

  definitionAt(index: number): SceneDefinition | undefined {
    return this.scenes[index];
  }

  subscribe(listener: (state: SceneState) => void): () => void {
    this.listeners.add(listener);
    const state = this.state();
    if (state) listener(state);
    return () => {
      this.listeners.delete(listener);
    };
  }

  async show(target: number): Promise<void> {
    const clamped = Math.min(Math.max(target, 0), this.scenes.length - 1);
    if (clamped === this.index) return;

    const definition = this.scenes[clamped];
    if (!definition) return;

    const direction: NavDirection =
      this.index === -1 ? 'jump' : clamped > this.index ? 'forward' : 'backward';

    const requestToken = ++this.token;

    await this.ensureAssets(definition, requestToken);
    if (requestToken !== this.token) return;

    this.teardown(direction);
    this.mount(definition, direction);
    this.index = clamped;
    this.direction = direction;

    this.moveCamera(definition, direction);
    this.emit();
    this.prefetchNeighbours(clamped);
  }

  private async ensureAssets(definition: SceneDefinition, requestToken: number): Promise<void> {
    const ids = definition.assets ?? [];
    if (ids.length === 0) return;

    const missing = ids.filter((id) => !this.deps.assets.has(id));
    if (missing.length === 0) return;

    this.deps.onLoadingChange(true, 0);
    try {
      await this.deps.assets.load(ids, (loaded, total) => {
        if (requestToken === this.token) {
          this.deps.onLoadingChange(true, total === 0 ? 1 : loaded / total);
        }
      });
    } finally {
      if (requestToken === this.token) this.deps.onLoadingChange(false, 1);
    }
  }

  private mount(definition: SceneDefinition, direction: NavDirection): void {
    const layer = document.createElement('section');
    layer.className = 'scene-layer';
    layer.dataset['scene'] = definition.id;
    layer.dataset['direction'] = direction;
    layer.setAttribute('aria-label', definition.title);
    this.deps.overlay.appendChild(layer);

    const group = new Group();
    group.name = `scene:${definition.id}`;
    this.deps.world.stage.add(group);

    const controller = new AbortController();
    const disposers: Array<() => void> = [];
    const instance = definition.create();

    const context: SceneContext = {
      root: layer,
      stage: group,
      world: this.deps.world,
      assets: this.deps.assets,
      quality: this.deps.quality,
      signal: controller.signal,
      onFrame: (handler: FrameHandler) => {
        disposers.push(this.deps.clock.add(handler));
      },
      onDispose: (fn: () => void) => {
        disposers.push(fn);
      },
    };

    this.active = { instance, layer, group, controller, disposers };
    instance.enter(context, direction);

    requestAnimationFrame(() => layer.classList.add('is-active'));
    document.title = `${definition.title} — PhD Defense`;
  }

  private teardown(direction: NavDirection): void {
    const active = this.active;
    if (!active) return;
    this.active = null;

    active.controller.abort();
    active.instance.exit?.(direction);

    active.layer.classList.remove('is-active');
    active.layer.classList.add('is-exiting');

    // Disposal is deferred so the outgoing scene can animate away first.
    window.setTimeout(() => {
      for (const dispose of active.disposers) dispose();
      this.deps.world.stage.remove(active.group);
      active.layer.remove();
    }, EXIT_REMOVAL_MS);
  }

  private moveCamera(definition: SceneDefinition, direction: NavDirection): void {
    if (direction === 'jump' && this.index === -1) {
      this.deps.camera.snapTo(definition.pose);
      return;
    }

    this.deps.camera.moveTo(definition.pose, {
      seconds: direction === 'jump' ? TRANSITION.jumpSeconds : TRANSITION.cameraSeconds,
    });
  }

  /** Neighbours are warmed so ordinary next/previous never shows a loader. */
  private prefetchNeighbours(index: number): void {
    for (const offset of [1, -1, 2]) {
      const neighbour = this.scenes[index + offset];
      if (neighbour?.assets?.length) this.deps.assets.prefetch(neighbour.assets);
    }
  }

  private state(): SceneState | null {
    const definition = this.scenes[this.index];
    if (!definition) return null;
    return {
      index: this.index,
      total: this.scenes.length,
      definition,
      direction: this.direction,
    };
  }

  private emit(): void {
    const state = this.state();
    if (!state) return;
    for (const listener of this.listeners) listener(state);
  }
}
