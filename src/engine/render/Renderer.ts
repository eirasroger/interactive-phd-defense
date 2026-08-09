import { ACESFilmicToneMapping, PCFSoftShadowMap, SRGBColorSpace, WebGLRenderer } from 'three';
import { ADAPTIVE } from '@/config/presentation';
import type { QualitySettings } from '@/config/quality';

export interface RendererEvents {
  onContextLost?: () => void;
  onContextRestored?: () => void;
  onResize?: (width: number, height: number) => void;
}

/**
 * Owns the WebGL context and everything that must survive losing it.
 *
 * Context loss is treated as expected rather than exceptional: a laptop that
 * sleeps, switches GPU or is put under load mid-defense will drop the context,
 * and the presentation has to come back rather than show a blank canvas.
 */
export class Renderer {
  readonly canvas: HTMLCanvasElement;
  readonly renderer: WebGLRenderer;

  private pixelRatioScale = 1;
  private width = 1;
  private height = 1;

  constructor(
    private readonly container: HTMLElement,
    private quality: QualitySettings,
    private readonly events: RendererEvents = {},
  ) {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'stage-canvas';
    container.appendChild(this.canvas);

    this.renderer = new WebGLRenderer({
      canvas: this.canvas,
      // Always on. This was conditioned on `maxPixelRatio < 2`, which assumed a
      // high tier implies a high-DPI display and supersamples the edges away.
      // It does not: `effectivePixelRatio` is `min(devicePixelRatio, max)`, so a
      // high-tier machine on an ordinary 1x monitor got pixel ratio 1 *and* no
      // antialiasing — the worst of both, and the single largest quality defect
      // in the exterior.
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
      // Needed so a lost context can be recovered rather than ending the talk.
      failIfMajorPerformanceCaveat: false,
    });

    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.95;
    this.renderer.shadowMap.enabled = quality.shadows;
    this.renderer.shadowMap.type = PCFSoftShadowMap;

    this.bindContextEvents();

    // Sized immediately so anything constructed after this reads a real
    // viewport, but no event is emitted yet: subscribers do not exist.
    this.measure();
  }

  /**
   * Begins observing size. Called once the engine has wired its subscribers,
   * so the initial resize reaches a fully constructed graph.
   */
  start(): void {
    this.resizeObserver = new ResizeObserver(() => {
      if (this.measure()) this.events.onResize?.(this.width, this.height);
    });
    this.resizeObserver.observe(this.container);
    this.events.onResize?.(this.width, this.height);
  }

  /**
   * Re-reads the container after the stage has been rescaled.
   *
   * `measure` uses `getBoundingClientRect`, which is post-transform, so the
   * drawing buffer always matches the pixels actually painted. But scaling the
   * stage does not change any layout box inside it, so `ResizeObserver` stays
   * silent and this has to be called by hand.
   */
  refresh(): void {
    if (this.measure()) this.events.onResize?.(this.width, this.height);
  }

  get size(): { width: number; height: number } {
    return { width: this.width, height: this.height };
  }

  get aspect(): number {
    return this.width / Math.max(this.height, 1);
  }

  /** Driven by the atmosphere, so exposure is part of a zone's look rather than a constant. */
  setExposure(value: number): void {
    if (this.renderer.toneMappingExposure === value) return;
    this.renderer.toneMappingExposure = value;
  }

  setQuality(quality: QualitySettings): void {
    this.quality = quality;
    this.renderer.shadowMap.enabled = quality.shadows;
    this.applyPixelRatio();
  }

  /**
   * Scales pixel ratio down when frames are being missed. Resolution is the
   * cheapest large lever available and degrades far more gracefully than
   * dropping frames does.
   */
  setPixelRatioScale(scale: number): void {
    const next = Math.max(ADAPTIVE.minPixelRatio / this.quality.maxPixelRatio, Math.min(scale, 1));
    if (Math.abs(next - this.pixelRatioScale) < 0.01) return;
    this.pixelRatioScale = next;
    this.applyPixelRatio();
  }

  get effectivePixelRatio(): number {
    return Math.min(window.devicePixelRatio, this.quality.maxPixelRatio) * this.pixelRatioScale;
  }

  dispose(): void {
    this.resizeObserver?.disconnect();
    this.renderer.dispose();
    this.canvas.remove();
  }

  private resizeObserver: ResizeObserver | null = null;

  /** Applies the container's current size. Returns whether it changed. */
  private measure(): boolean {
    const rect = this.container.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    if (width === this.width && height === this.height) return false;

    this.width = width;
    this.height = height;
    this.renderer.setSize(width, height, false);
    this.applyPixelRatio();
    return true;
  }

  private applyPixelRatio(): void {
    this.renderer.setPixelRatio(this.effectivePixelRatio);
  }

  private bindContextEvents(): void {
    this.canvas.addEventListener('webglcontextlost', (event) => {
      // Preventing the default is what makes restoration possible at all.
      event.preventDefault();
      this.events.onContextLost?.();
    });

    this.canvas.addEventListener('webglcontextrestored', () => {
      this.renderer.shadowMap.enabled = this.quality.shadows;
      this.applyPixelRatio();
      this.events.onContextRestored?.();
    });
  }
}
