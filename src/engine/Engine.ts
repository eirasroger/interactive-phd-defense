import { quality } from '@/config/quality';
import { AssetLoader, type AssetEntry } from '@/engine/assets/AssetLoader';
import { CameraDirector } from '@/engine/camera/CameraDirector';
import { CameraRig } from '@/engine/camera/CameraRig';
import { Clock } from '@/engine/Clock';
import { FrameLog } from '@/engine/diagnostics/FrameLog';
import { PerformanceMonitor } from '@/engine/diagnostics/PerformanceMonitor';
import {
  bindPointerIdle,
  bindPresenterInput,
  bindTouchNavigation,
  toggleFullscreen,
} from '@/engine/Input';
import { AtmosphereDirector } from '@/engine/render/AtmosphereDirector';
import { QualityLadder } from '@/engine/render/QualityLadder';
import { RenderPipeline } from '@/engine/render/RenderPipeline';
import { Renderer } from '@/engine/render/Renderer';
import { World } from '@/engine/render/World';
import { Router } from '@/engine/Router';
import { SceneDirector, type SceneState } from '@/engine/scene/SceneDirector';
import type { SceneDefinition } from '@/engine/scene/types';
import type { ZoneDefinition } from '@/engine/world/types';
import { bindStageFit } from '@/engine/StageFit';
import { ZoneDirector } from '@/engine/world/ZoneDirector';
import { assetsByZone, zoneProgressByIndex } from '@/engine/world/zoneRuns';
import { zoneFor } from '@/world/zones';

/**
 * Seconds to wait after reaching the beat before a crossing before warming the
 * next zone. Keeps the small warm hitch off the click itself. Any navigation
 * before the deadline runs the warm immediately.
 */
const WARM_DELAY_SECONDS = 0.5;

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
 * Composition root. Builds and wires every subsystem. The frame loop advances
 * camera, diagnostics and rendering in that order, so each frame draws the pose
 * computed in it.
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
  private readonly ladder: QualityLadder;
  private readonly zones: ZoneDirector;
  private readonly zoneProgress: readonly number[];
  private readonly scenes: SceneDirector;
  private readonly performance: PerformanceMonitor;
  private readonly lifetime = new AbortController();

  private diagnosticsVisible = false;
  /** True during the initial load and the zone preparation after it. */
  private preparing = true;
  /** Zone waiting to be warmed when `warmTimer` fires. */
  private pendingWarm: ZoneDefinition | null = null;
  private warmTimer: ReturnType<typeof setTimeout> | null = null;
  /** Logs what a long frame was doing. Dev builds only. */
  private readonly frames: FrameLog | null;
  private contextLost = false;

  constructor(private readonly options: EngineOptions) {
    this.renderer = new Renderer(options.container, quality, {
      onResize: (width, height) => {
        this.rig.setAspect(width / Math.max(height, 1));
        // The pipeline sizes itself from the drawing buffer, shared by the
        // composer and the canvas.
        this.pipeline.setSize();
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

    this.ladder = new QualityLadder(this.renderer, this.pipeline);
    this.performance = new PerformanceMonitor(() => this.ladder.stepDown());

    this.frames = import.meta.env.DEV
      ? new FrameLog(this.renderer.renderer, () => this.options.scenes[this.scenes.currentIndex]?.id ?? '—')
      : null;

    this.assets.register(options.manifest);

    this.scenes = new SceneDirector(options.scenes, {
      overlay: options.overlay,
      world: this.world,
      camera: this.cameraDirector,
      assets: this.assets,
      clock: this.clock,
      quality,
      onLoadingChange: (loading, value) => {
        // Pause the quality ladder while loading so a load is never treated as
        // a slow machine.
        this.performance.setActive(!loading && !this.preparing);
        // Loading continues while `prepareZones` runs. Holding the loading
        // screen avoids a brief flash of the title slide.
        if (!loading && this.preparing) return;
        options.onLoadingChange(loading, value);
      },
    });

    this.scenes.subscribe((state) => {
      this.enterZone(state);
      options.onState(state);
    });
  }

  /**
   * Sets the world from the scene definition and its position in its zone's
   * run. Scenes never set up the world themselves, so any jump lands in a
   * fully specified state.
   */
  private enterZone(state: SceneState): void {
    // Run any pending warm now so the next zone exists before a crossing starts.
    this.flushWarm();

    // Crossings play only when moving forward. Going backward is a cut.
    const crossing = state.direction === 'forward' ? (state.definition.crossing ?? null) : null;

    this.zones.enter(
      zoneFor(state.definition.zone),
      state.definition.world,
      this.zoneProgress[state.index] ?? 0,
      state.direction !== 'jump',
      crossing,
      state.definition.air ?? null,
      state.direction === 'forward' ? state.definition.travel?.seconds : undefined,
    );

    this.warmNextZone(state);
  }

  /**
   * Warms the next zone on the last beat before a crossing. Any other position
   * cancels and undoes the warm.
   */
  private warmNextZone(state: SceneState): void {
    const next = this.options.scenes[state.index + 1];
    const crossing = next && next.zone !== state.definition.zone;

    if (state.beat < 1 || !crossing) {
      this.cancelWarm();
      this.zones.unwarm();
      return;
    }

    this.scheduleWarm(zoneFor(next.zone));
  }

  /** Warms a zone after `WARM_DELAY_SECONDS`, or sooner if the deck moves. */
  private scheduleWarm(definition: ZoneDefinition): void {
    if (this.zones.isWarmed(definition.id)) return;
    if (this.pendingWarm?.id === definition.id) return;

    this.cancelWarm();
    this.pendingWarm = definition;
    this.warmTimer = setTimeout(() => {
      this.warmTimer = null;
      this.flushWarm();
    }, WARM_DELAY_SECONDS * 1000);
  }

  /** Runs a deferred warm now. Safe to call when there is nothing pending. */
  private flushWarm(): void {
    const definition = this.pendingWarm;
    this.cancelWarm();
    if (definition) this.zones.warm(definition);
  }

  private cancelWarm(): void {
    if (this.warmTimer !== null) clearTimeout(this.warmTimer);
    this.warmTimer = null;
    this.pendingWarm = null;
  }

  start(): void {
    // Bound first so the renderer's first measurement sees the final stage scale.
    bindStageFit(() => this.renderer.refresh(), this.lifetime.signal);

    // Started after construction so the first resize reaches a wired rig and
    // pipeline.
    this.renderer.start();

    this.clock.add(this.frame);
    this.clock.start();
    this.bindInput();

    let first = true;
    this.router.start((id) => {
      const found = id === null ? -1 : this.scenes.indexOf(id);
      const target = found === -1 ? 0 : found;
      if (found === -1) {
        const opening = this.scenes.definitionAt(0);
        if (opening) this.router.replace(opening.id);
      }

      const shown = this.scenes.show(target);
      if (!first) return;
      first = false;
      void shown.then(() => this.prepareZones());
    });
  }

  /**
   * Builds every zone during the loading screen, so shader compiles (1.7 s for
   * the corridor) never land mid-presentation. Assets load per zone, so later
   * `ensureAssets` calls are no-ops and scene changes never hit the network.
   */
  private async prepareZones(): Promise<void> {
    try {
      for (const [zone, assets] of assetsByZone(this.options.scenes)) {
        if (this.zones.isPrepared(zone)) continue;
        await this.assets.load([...assets]);
        await this.zones.prepare(zoneFor(zone));
      }
    } catch (error) {
      // Failed zones are built on demand by `warm`. Logged so the cause of any
      // later stutter is visible.
      console.warn('[engine] zone preparation failed; falling back to on-demand.', error);
    } finally {
      this.preparing = false;
      this.performance.setActive(true);
      this.options.onLoadingChange(false, 1);
    }
  }

  dispose(): void {
    this.cancelWarm();
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
    // Skip frames until the browser restores the WebGL context.
    if (this.contextLost) return;

    this.rig.apply();
    this.world.applyAtmosphere(this.atmosphere.state);
    this.renderer.setExposure(this.atmosphere.state.exposure);
    this.zones.update(dt);
    this.performance.update(dt);
    this.frames?.update(dt);
    this.pipeline.render();

    if (this.diagnosticsVisible) {
      this.options.onDiagnostics(this.performance.fps, true);
    }
  };

  private bindInput(): void {
    const { signal } = this.lifetime;

    // Play the next beat if there is one, otherwise go to the next scene.
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
