import {
  HalfFloatType,
  Vector2,
  Vector4,
  WebGLRenderTarget,
  type Camera,
  type Scene,
  type WebGLRenderer,
} from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import type { QualitySettings } from '@/config/quality';

/**
 * One render call for both paths. Tiers with post-processing use the composer;
 * lower tiers render straight to the canvas.
 */
export class RenderPipeline {
  private composer: EffectComposer | null = null;
  private bloom: UnrealBloomPass | null = null;
  private samples: number;
  /** Stands in for the composer's target in `compile` and `prime`. */
  private readonly probe = new WebGLRenderTarget(1, 1);

  constructor(
    private readonly renderer: WebGLRenderer,
    private readonly scene: Scene,
    private camera: Camera,
    quality: QualitySettings,
  ) {
    this.samples = RenderPipeline.SAMPLES;
    if (quality.postProcessing) this.buildComposer(quality);
  }

  /**
   * MSAA samples for the composer's render target. The renderer's `antialias`
   * has no effect once a composer is used. 2x looks the same as 4x on a
   * projector; 4x half-float cost 8.7 ms at 1080p on an integrated GPU.
   */
  private static readonly SAMPLES = 2;

  /**
   * Composer buffer size in device pixels, read from the drawing buffer.
   * With a custom render target, `EffectComposer` uses a pixel ratio of 1,
   * so CSS sizes would render at reduced resolution.
   */
  private bufferSize(): Vector2 {
    return this.renderer.getDrawingBufferSize(new Vector2());
  }

  private buildComposer(quality: QualitySettings): void {
    const { x: width, y: height } = this.bufferSize();

    const target = new WebGLRenderTarget(width, height, {
      type: HalfFloatType,
      samples: this.effectiveSamples(),
    });

    this.composer = new EffectComposer(this.renderer, target);
    this.composer.addPass(new RenderPass(this.scene, this.camera));

    // Tight radius and a high threshold, so only bright highlights bloom.
    this.bloom = new UnrealBloomPass(
      new Vector2(width, height),
      quality.bloomStrength,
      0.3,
      0.92,
    );
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
  }

  private effectiveSamples(): number {
    return Math.min(this.samples, this.renderer.capabilities.maxSamples);
  }

  setCamera(camera: Camera): void {
    this.camera = camera;
    if (!this.composer) return;
    for (const pass of this.composer.passes) {
      if (pass instanceof RenderPass) pass.camera = camera;
    }
  }

  /** Resizes from the drawing buffer. See `bufferSize`. */
  setSize(): void {
    if (!this.composer) return;
    const { x: width, y: height } = this.bufferSize();
    this.composer.setSize(width, height);
    this.bloom?.setSize(width, height);
  }

  /**
   * Sets the MSAA sample count, used by the adaptive quality ladder.
   * Disposing the targets reallocates them on next use without recompiling
   * bloom's shaders.
   */
  setSamples(samples: number): void {
    if (samples === this.samples) return;
    this.samples = samples;
    if (!this.composer) return;

    for (const target of [this.composer.renderTarget1, this.composer.renderTarget2]) {
      target.samples = this.effectiveSamples();
      target.dispose();
    }
  }

  /**
   * `UnrealBloomPass` does not swap buffers, so disabling it passes the render
   * pass output through unchanged.
   */
  setBloomEnabled(enabled: boolean): void {
    if (this.bloom) this.bloom.enabled = enabled;
  }

  setQuality(quality: QualitySettings): void {
    if (quality.postProcessing && !this.composer) {
      this.buildComposer(quality);
      return;
    }
    if (!quality.postProcessing && this.composer) {
      this.composer.dispose();
      this.composer = null;
      this.bloom = null;
      return;
    }
    if (this.bloom) this.bloom.strength = quality.bloomStrength;
  }

  /**
   * Starts compiling every program the scene needs, in the variant the frame
   * will use. Resolves once they are ready.
   */
  compile(): Promise<unknown> {
    return this.bound(() => this.renderer.compileAsync(this.scene, this.camera));
  }

  /**
   * Draws the scene once at one pixel, into the same kind of target the frame
   * uses. This uploads vertex buffers and compiles shadow programs, which
   * `compile` does not. On the canvas path it must run inside a frame that
   * renders afterwards, or the browser presents a cleared canvas.
   */
  prime(): void {
    this.bound(() => {
      const scissor = this.renderer.getScissor(new Vector4());
      const scissorTest = this.renderer.getScissorTest();
      this.renderer.setScissor(0, 0, 1, 1);
      this.renderer.setScissorTest(true);
      this.renderer.render(this.scene, this.camera);
      this.renderer.setScissor(scissor);
      this.renderer.setScissorTest(scissorTest);
    });
  }

  /**
   * three.js picks a shader variant by whether a render target is bound. Into
   * a target it compiles without tone mapping and in linear colour, because
   * the composer's `OutputPass` does both. Onto the canvas it compiles with
   * them. Warming against the wrong one compiles programs the frame never uses.
   */
  private bound<T>(draw: () => T): T {
    const previous = this.renderer.getRenderTarget();
    this.renderer.setRenderTarget(this.composer ? this.probe : null);
    try {
      return draw();
    } finally {
      this.renderer.setRenderTarget(previous);
    }
  }

  render(): void {
    if (this.composer) {
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }

  dispose(): void {
    this.probe.dispose();
    this.composer?.dispose();
    this.composer = null;
    this.bloom = null;
  }
}
