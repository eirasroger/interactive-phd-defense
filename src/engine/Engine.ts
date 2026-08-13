import { quality } from '@/config/quality';
import { AssetLoader, type AssetEntry } from '@/engine/assets/AssetLoader';
import { CameraDirector } from '@/engine/camera/CameraDirector';
import { CameraRig } from '@/engine/camera/CameraRig';
import { Clock } from '@/engine/Clock';
import { PerformanceMonitor } from '@/engine/diagnostics/PerformanceMonitor';
import {
  bindPointerIdle,
  bindPresenterInput,
  bindTouchNavigation,
  toggleFullscreen,
} from '@/engine/Input';
import { AtmosphereDirector } from '@/engine/render/AtmosphereDirector';
import { RenderPipeline } from '@/engine/render/RenderPipeline';
import { Renderer } from '@/engine/render/Renderer';
import { World } from '@/engine/render/World';
import { Router } from '@/engine/Router';
import { SceneDirector, type SceneState } from '@/engine/scene/SceneDirector';
import type { SceneDefinition } from '@/engine/scene/types';
import { bindStageFit } from '@/engine/StageFit';
import { ZoneDirector } from '@/engine/world/ZoneDirector';
import { zoneProgressByIndex } from '@/engine/world/zoneRuns';
import { zoneFor } from '@/world/zones';

export interface EngineOptions {
  readonly container: HTMLElement;
  readonly overlay: HTMLElement;
  readonly scenes: readonly SceneDefinition[];
  readonly manifest: readonly AssetEntry[];
  readonly onState: (state: SceneState) => void;
  readonly onLoadingChange: (loading: boolean, progress: number) => void;
  readonly onDiagnostics: (fps: number, visible: boolean) => void;
  readonly onContextLost: (lost: boolean) => void;
}

/**
 * Top-level composition root.
 *
 * Everything the presentation needs is constructed and wired here; no other
 * module reaches across subsystem boundaries. The frame loop is the single
 * place where camera state, diagnostics and rendering are advanced, in that
 * order, so what is drawn always reflects the pose computed this frame.
 */
export class Engine {
  private readonly clock = new Clock();
  private readonly router = new Router();
  private readonly assets = new AssetLoader();
  private readonly renderer: Renderer;
  private readonly world: World;
  private readonly rig: CameraRig;
  private readonly cameraDirector: CameraDirector;
  private readonly pipeline: RenderPipeline;
  private readonly atmosphere = new AtmosphereDirector();
  private readonly zones: ZoneDirector;
  private readonly zoneProgress: readonly number[];
  private readonly scenes: SceneDirector;
  private readonly performance: PerformanceMonitor;
  private readonly lifetime = new AbortController();

  private diagnosticsVisible = false;
  private contextLost = false;

  constructor(private readonly options: EngineOptions) {
    this.renderer = new Renderer(options.container, quality, {
      onResize: (width, height) => {
        this.rig.setAspect(width / Math.max(height, 1));
        this.pipeline.setSize(width, height);
      },
      onContextLost: () => {
        this.contextLost = true;
        this.options.onContextLost(true);
      },
      onContextRestored: () => {
        this.contextLost = false;
        this.options.onContextLost(false);
      },
    });

    this.world = new World(this.renderer.renderer, quality);
    this.rig = new CameraRig(this.renderer.aspect);
    this.cameraDirector = new CameraDirector(this.rig);
    this.pipeline = new RenderPipeline(
      this.renderer.renderer,
      this.world.scene,
      this.rig.camera,
      quality,
    );

    this.zones = new ZoneDirector(
      this.world,
      this.renderer.renderer,
      quality,
      this.atmosphere,
      this.assets,
      this.cameraDirector,
    );
    this.zoneProgress = zoneProgressByIndex(options.scenes);

    this.performance = new PerformanceMonitor((scale) => {
      this.renderer.setPixelRatioScale(scale);
    });

    this.assets.register(options.manifest);

    this.scenes = new SceneDirector(options.scenes, {
      overlay: options.overlay,
      world: this.world,
      camera: this.cameraDirector,
      assets: this.assets,
      clock: this.clock,
      quality,
      onLoadingChange: options.onLoadingChange,
    });

    this.scenes.subscribe((state) => {
      this.enterZone(state);
      options.onState(state);
    });
  }

  /**
   * The built world follows the deck.
   *
   * Zone, render mode and world state are all read off the scene definition and
   * its position in its zone's run, so a scene never sets up the world it stands
   * in — which is what keeps a jump backwards during questions from leaving the
   * building half specified or the light belonging to somewhere else.
   */
  private enterZone(state: SceneState): void {
    // Forwards only. A crossing is a set piece — doors opening, two worlds
    // briefly sharing a frame — and replaying it at a presenter who has jumped
    // back through a door to answer a question is the wrong reading of what
    // they asked for. Backwards is a cut, like every other jump.
    const crossing = state.direction === 'forward' ? (state.definition.crossing ?? null) : null;

    this.zones.enter(
      zoneFor(state.definition.zone),
      state.definition.world,
      this.zoneProgress[state.index] ?? 0,
      state.direction !== 'jump',
      crossing,
    );

    this.warmNextZone(state);
  }

  private warmNextZone(state: SceneState): void {
    if (state.beat < 1) return;

    const next = this.options.scenes[state.index + 1];
    if (!next || next.zone === state.definition.zone) return;

    this.zones.warm(zoneFor(next.zone));
  }

  start(): void {
    // Before the renderer starts, so its first measurement is of a stage that
    // is already at its final scale.
    bindStageFit(() => this.renderer.refresh(), this.lifetime.signal);

    // Started here, not in the constructor, so the first resize reaches a
    // fully wired camera rig and render pipeline.
    this.renderer.start();

    this.clock.add(this.frame);
    this.clock.start();
    this.bindInput();

    this.router.start((id) => {
      const found = id === null ? -1 : this.scenes.indexOf(id);
      if (found === -1) {
        const first = this.scenes.definitionAt(0);
        if (first) this.router.replace(first.id);
        void this.scenes.show(0);
        return;
      }
      void this.scenes.show(found);
    });
  }

  dispose(): void {
    this.lifetime.abort();
    this.clock.stop();
    this.router.stop();
    this.atmosphere.kill();
    this.zones.dispose();
    this.pipeline.dispose();
    this.world.dispose();
    this.assets.dispose();
    this.renderer.dispose();
  }

  private readonly frame = (dt: number): void => {
    // A lost context cannot be drawn to; skipping keeps the tab responsive
    // until the browser hands the context back.
    if (this.contextLost) return;

    this.rig.apply();
    this.world.applyAtmosphere(this.atmosphere.state);
    this.renderer.setExposure(this.atmosphere.state.exposure);
    this.zones.update(dt);
    this.performance.update(dt);
    this.pipeline.render();

    if (this.diagnosticsVisible) {
      this.options.onDiagnostics(this.performance.fps, true);
    }
  };

  private bindInput(): void {
    const { signal } = this.lifetime;

    // A click plays the next beat if there is one, and otherwise moves on.
    const next = (): void => {
      if (!this.scenes.advanceBeat()) this.navigate(this.scenes.currentIndex + 1);
    };
    const previous = (): void => {
      if (!this.scenes.retreatBeat()) this.navigate(this.scenes.currentIndex - 1);
    };

    bindPresenterInput(
      {
        next,
        previous,
        first: () => this.navigate(0),
        last: () => this.navigate(this.scenes.count - 1),
        toggleFullscreen: () => void toggleFullscreen(),
        toggleDiagnostics: () => {
          this.diagnosticsVisible = !this.diagnosticsVisible;
          this.options.onDiagnostics(this.performance.fps, this.diagnosticsVisible);
        },
      },
      signal,
    );

    bindTouchNavigation({ next, previous }, signal);
    bindPointerIdle(signal);
  }

  private navigate(target: number): void {
    const clamped = Math.min(Math.max(target, 0), this.scenes.count - 1);
    const definition = this.scenes.definitionAt(clamped);
    if (definition) this.router.navigate(definition.id);
  }
}
