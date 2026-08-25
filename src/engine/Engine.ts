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
 * Seconds between arriving on the beat before a crossing and standing the next
 * zone up.
 *
 * Everything expensive about that zone is already paid for at load, so what is
 * left is small — but it is not nothing, and it used to land on the same tick as
 * the click that played the beat. A hitch *on* an input reads as the deck not
 * responding; the same hitch half a second later, under someone speaking, is
 * not perceived at all. The delay buys nothing technically and everything
 * perceptually, which is the whole of its justification.
 *
 * It is a deadline rather than a wait: any navigation before it expires runs the
 * warm immediately, so the corridor is never less ready than it was before.
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
  private readonly ladder: QualityLadder;
  private readonly zones: ZoneDirector;
  private readonly zoneProgress: readonly number[];
  private readonly scenes: SceneDirector;
  private readonly performance: PerformanceMonitor;
  private readonly lifetime = new AbortController();

  private diagnosticsVisible = false;
  /** Held true across the initial load and the zone preparation that follows it. */
  private preparing = true;
  /** A zone due to be stood up, and the deadline it is waiting on. */
  private pendingWarm: ZoneDefinition | null = null;
  private warmTimer: ReturnType<typeof setTimeout> | null = null;
  /** Names what a long frame was doing. Dropped from production builds. */
  private readonly frames: FrameLog | null;
  private contextLost = false;

  constructor(private readonly options: EngineOptions) {
    this.renderer = new Renderer(options.container, quality, {
      onResize: (width, height) => {
        this.rig.setAspect(width / Math.max(height, 1));
        // No size passed: the pipeline reads the drawing buffer, which is the
        // only thing the composer and the canvas can both be sized from.
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
        // The adaptive ladder must not read a load as a slow machine.
        this.performance.setActive(!loading && !this.preparing);
        // The scene director finishing its own assets is not the end of loading
        // while zones are still being stood up — see `prepareZones`. Suppressing
        // its `false` keeps one continuous loading screen instead of a flash of
        // title slide over a deck that is about to block for two seconds.
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
   * The built world follows the deck.
   *
   * Zone, render mode and world state are all read off the scene definition and
   * its position in its zone's run, so a scene never sets up the world it stands
   * in — which is what keeps a jump backwards during questions from leaving the
   * building half specified or the light belonging to somewhere else.
   */
  private enterZone(state: SceneState): void {
    // Any deferred warm is due now. The deck is moving, and if this is the
    // navigation that walks through the door then the world on the far side of
    // it has to be standing before the crossing is set up rather than half a
    // second after the camera has started travelling.
    this.flushWarm();

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
      state.definition.air ?? null,
    );

    this.warmNextZone(state);
  }

  /**
   * Stand the next zone up on the last beat before a crossing — and take it
   * back down the moment that stops being where the deck is pointed.
   *
   * Every early return here is a navigation that has moved away from the
   * crossing, including backwards, so each of them has to undo the warm rather
   * than simply decline to repeat it.
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

  /** Stands a zone up after `WARM_DELAY_SECONDS`, or sooner if the deck moves. */
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
    // Before the renderer starts, so its first measurement is of a stage that
    // is already at its final scale.
    bindStageFit(() => this.renderer.refresh(), this.lifetime.signal);

    // Started here, not in the constructor, so the first resize reaches a
    // fully wired camera rig and render pipeline.
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
   * Stand every zone in the deck up before the first click.
   *
   * A zone costs the same to build whenever it is built; the only question is
   * who is watching. Deferred to the beat before its crossing, the corridor
   * cost a 1.7 second shader compile over the approach to the entrance — the
   * one move in Act I that has to be smooth, because it is the transition the
   * whole act has been walking toward. Done here it costs a slightly longer
   * loading screen, which is the one moment of the deck nobody is presenting
   * over.
   *
   * Assets are loaded per zone rather than per scene, because a zone is what
   * `create` reads and a scene's declaration is only ever the union of what its
   * zone needs. Everything is already cached by the time the scenes that
   * declare it are reached, so `ensureAssets` becomes a no-op for the rest of
   * the deck and no later scene change touches the network either.
   */
  private async prepareZones(): Promise<void> {
    try {
      for (const [zone, assets] of assetsByZone(this.options.scenes)) {
        if (this.zones.isPrepared(zone)) continue;
        await this.assets.load([...assets]);
        await this.zones.prepare(zoneFor(zone));
      }
    } catch (error) {
      // A zone that will not stand up early will be built on demand by `warm`,
      // exactly as it was before. Reported rather than swallowed: a deck that
      // silently lost its preparation is a deck that stutters in the hall for a
      // reason nobody can see.
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
    // A lost context cannot be drawn to; skipping keeps the tab responsive
    // until the browser hands the context back.
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
