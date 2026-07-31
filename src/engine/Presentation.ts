import { Clock } from './Clock';
import { Router } from './Router';
import type { NavDirection, Scene, SceneContext, SceneDefinition } from './types';

/** How long an exiting layer stays mounted so its transition can play out. */
const EXIT_REMOVAL_MS = 1200;
const POINTER_IDLE_MS = 2500;

interface ActiveScene {
  readonly scene: Scene;
  readonly layer: HTMLElement;
  readonly controller: AbortController;
  readonly frameDisposers: Array<() => void>;
}

export interface PresentationState {
  readonly index: number;
  readonly total: number;
  readonly definition: SceneDefinition;
}

export type StateListener = (state: PresentationState) => void;

/**
 * Owns navigation, scene lifecycle and global timing.
 *
 * The URL hash is the authoritative position; every navigation path writes
 * the hash and reacts to it, so there is exactly one way position changes.
 * Navigation is synchronous and never waits for an animation to finish —
 * the presenter must always be able to move on mid-transition.
 */
export class Presentation {
  private readonly clock = new Clock();
  private readonly router = new Router();
  private readonly listeners = new Set<StateListener>();

  private active: ActiveScene | null = null;
  private index = -1;
  private pointerIdleTimer = 0;

  constructor(
    private readonly stage: HTMLElement,
    private readonly scenes: readonly SceneDefinition[],
  ) {
    if (scenes.length === 0) {
      throw new Error('Presentation requires at least one scene.');
    }
  }

  start(): void {
    this.clock.start();
    this.bindKeyboard();
    this.bindPointer();

    this.router.start((id) => {
      const found = id === null ? -1 : this.scenes.findIndex((scene) => scene.id === id);
      if (found === -1) {
        const first = this.scenes[0];
        if (first) this.router.replace(first.id);
        this.show(0);
        return;
      }
      this.show(found);
    });
  }

  next(): void {
    this.goTo(this.index + 1);
  }

  previous(): void {
    this.goTo(this.index - 1);
  }

  goTo(target: number): void {
    const clamped = this.clamp(target);
    const definition = this.scenes[clamped];
    if (definition) this.router.navigate(definition.id);
  }

  subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    if (this.index >= 0) {
      const state = this.state();
      if (state) listener(state);
    }
    return () => {
      this.listeners.delete(listener);
    };
  }

  private state(): PresentationState | null {
    const definition = this.scenes[this.index];
    if (!definition) return null;
    return { index: this.index, total: this.scenes.length, definition };
  }

  private clamp(value: number): number {
    return Math.min(Math.max(value, 0), this.scenes.length - 1);
  }

  private show(target: number): void {
    const clamped = this.clamp(target);
    if (clamped === this.index) return;

    const definition = this.scenes[clamped];
    if (!definition) return;

    const direction: NavDirection =
      this.index === -1 ? 'jump' : clamped > this.index ? 'forward' : 'backward';

    this.teardown(direction);

    const layer = document.createElement('section');
    layer.className = 'scene-layer';
    layer.dataset['scene'] = definition.id;
    layer.dataset['direction'] = direction;
    layer.setAttribute('aria-label', definition.title);
    this.stage.appendChild(layer);

    const controller = new AbortController();
    const frameDisposers: Array<() => void> = [];
    const scene = definition.create();

    const context: SceneContext = {
      root: layer,
      signal: controller.signal,
      onFrame: (handler) => {
        frameDisposers.push(this.clock.add(handler));
      },
    };

    this.active = { scene, layer, controller, frameDisposers };
    this.index = clamped;

    scene.enter(context, direction);

    // Next frame, so the layer's initial styles are committed before the
    // active state is applied and the entry transition can interpolate.
    requestAnimationFrame(() => layer.classList.add('is-active'));

    document.title = `${definition.title} — PhD Defense`;

    const state = this.state();
    if (state) {
      for (const listener of this.listeners) listener(state);
    }
  }

  private teardown(direction: NavDirection): void {
    const active = this.active;
    if (!active) return;
    this.active = null;

    active.controller.abort();
    for (const dispose of active.frameDisposers) dispose();
    active.scene.exit?.(direction);

    active.layer.classList.remove('is-active');
    active.layer.classList.add('is-exiting');
    window.setTimeout(() => active.layer.remove(), EXIT_REMOVAL_MS);
  }

  private bindKeyboard(): void {
    window.addEventListener('keydown', (event) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;

      switch (event.key) {
        // PageUp/PageDown are what physical presenter remotes emit.
        case 'ArrowRight':
        case 'ArrowDown':
        case 'PageDown':
        case ' ':
          event.preventDefault();
          this.next();
          break;
        case 'ArrowLeft':
        case 'ArrowUp':
        case 'PageUp':
          event.preventDefault();
          this.previous();
          break;
        case 'Home':
          event.preventDefault();
          this.goTo(0);
          break;
        case 'End':
          event.preventDefault();
          this.goTo(this.scenes.length - 1);
          break;
        case 'f':
          event.preventDefault();
          void this.toggleFullscreen();
          break;
        default:
          break;
      }
    });
  }

  private bindPointer(): void {
    const wake = (): void => {
      document.body.dataset['pointer'] = 'active';
      window.clearTimeout(this.pointerIdleTimer);
      this.pointerIdleTimer = window.setTimeout(() => {
        document.body.dataset['pointer'] = 'idle';
      }, POINTER_IDLE_MS);
    };

    window.addEventListener('pointermove', wake, { passive: true });
    window.addEventListener('pointerdown', wake, { passive: true });
    wake();
  }

  private async toggleFullscreen(): Promise<void> {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      // Fullscreen is a convenience; denial must never interrupt the talk.
    }
  }
}
