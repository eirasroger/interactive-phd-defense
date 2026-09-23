import { ACESFilmicToneMapping, PCFSoftShadowMap, SRGBColorSpace, WebGLRenderer } from 'three';
import { ADAPTIVE } from '@/config/presentation';
import type { QualitySettings } from '@/config/quality';

export interface RendererEvents {
  onContextLost?: () => void;
  onContextRestored?: () => void;
  onResize?: (width: number, height: number) => void;
}

/**
 * Owns the WebGL context and recovers from context loss (sleep, GPU switch or
 * heavy load), so the presentation resumes after it.
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
      // Always on: a high tier on a 1x monitor still renders at pixel ratio 1.
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
      // Keeps context creation working on constrained GPUs.
      failIfMajorPerformanceCaveat: false,
    });

    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.95;
    this.renderer.shadowMap.enabled = quality.shadows;
    this.renderer.shadowMap.type = PCFSoftShadowMap;

    this.bindContextEvents();

    // Sized now so later code reads a real viewport. No event yet, since
    // nothing is subscribed.
    this.measure();
  }

  /** Starts observing size. Call after the engine has wired its subscribers. */
  start(): void {
    this.resizeObserver = new ResizeObserver(() => {
      if (this.measure()) this.events.onResize?.(this.width, this.height);
    });
    this.resizeObserver.observe(this.container);
    this.events.onResize?.(this.width, this.height);
  }

  /**
   * Re-reads the container after the stage is rescaled. A CSS scale does not
   * trigger `ResizeObserver`, so call this by hand.
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

  /** Set by the atmosphere, so each zone can have its own exposure. */
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
   * Lowers resolution when frames are missed. Emits a resize because
   * `RenderPipeline` sizes its targets from the drawing buffer.
   */
  setPixelRatioScale(scale: number): void {
    const next = Math.max(ADAPTIVE.minPixelRatio, Math.min(scale, 1));
    if (Math.abs(next - this.pixelRatioScale) < 0.01) return;
    this.pixelRatioScale = next;
    this.applyPixelRatio();
    this.events.onResize?.(this.width, this.height);
  }

  /**
   * Device pixels per CSS pixel. Capped by `devicePixelRatio`, the tier's
   * `maxPixelRatio` and a total pixel budget (`maxRenderPixels`), which keeps
   * a large display such as 4K from multiplying the frame cost.
   */
  get effectivePixelRatio(): number {
    const requested = Math.min(window.devicePixelRatio, this.quality.maxPixelRatio);
    const budgeted = Math.sqrt(
      this.quality.maxRenderPixels / Math.max(this.width * this.height, 1),
    );
    return Math.min(requested, budgeted) * this.pixelRatioScale;
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
      // Required for the context to be restored.
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
