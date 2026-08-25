import {
  HalfFloatType,
  Vector2,
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
 * Wraps the two rendering paths behind one call.
 *
 * Post-processing is a tier decision, so the rest of the engine should never
 * branch on whether it is enabled. Lower tiers render straight to the canvas
 * and pay nothing for the composer.
 */
export class RenderPipeline {
  private composer: EffectComposer | null = null;
  private bloom: UnrealBloomPass | null = null;
  private samples: number;

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
   * How many samples the composer's own buffer takes.
   *
   * **The renderer's `antialias: true` does nothing once a composer is in the
   * path.** MSAA belongs to the drawing buffer, and a composer renders into its
   * own render target instead — which `EffectComposer` creates with `samples:
   * 0`. The result was that the *high* tier, the only one that enables
   * post-processing, was the only tier in the deck with no antialiasing at all:
   * every edge in every act stair-stepped, on the machines best able to afford
   * not to. Four is the knee; eight costs bandwidth for a difference a
   * projector cannot resolve.
   *
   * It is also the most expensive single thing in the frame once the display
   * grows. Four samples of `HalfFloatType` is 32 bytes per pixel of framebuffer
   * traffic, and on an integrated GPU sharing system memory that measured 8.7 ms
   * at 1080p — more than the whole park.
   *
   * **Two, because four was measured against it and could not be told apart.**
   * Crops of a railing, a facade corner and a canopy were rendered at 4x, 2x and
   * off, magnified five times and compared pixel by pixel. Going from 2x to off
   * is the visible step: mean difference 9.65 on the facade with 17% of pixels
   * changed, and the louvre bands visibly stair-step. Going from 4x to 2x is
   * not: 6.52 mean, and nothing an eye finds at a magnifier's distance, let
   * alone a projector's. Foliage is unchanged by any of the three, because
   * alpha-cut edges come from a texture threshold rather than from geometry
   * coverage, and foliage is most of the frame.
   *
   * So 2x is the default rather than the ladder's first concession, and the
   * ladder's rungs start at bloom instead. Four is still reachable by hand for a
   * machine with headroom to spare.
   */
  private static readonly SAMPLES = 2;

  /**
   * The size the composer's buffers must be, which is the drawing buffer and
   * never the CSS box.
   *
   * `EffectComposer` keeps a pixel ratio of its own and multiplies `setSize` by
   * it — except when it is handed a render target at construction, which is
   * exactly what this class does to get MSAA back. In that case three.js sets
   * that ratio to 1, so passing CSS pixels sized the scene buffer in CSS pixels
   * and the deck rendered at 1557x876 while presenting a 1751x985 canvas: 44%
   * of the pixels it was displaying, upscaled. Reading the drawing buffer here
   * rather than accepting a width and a height means the composer and the canvas
   * cannot be given different units in the first place.
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

    // Tight radius and a threshold above mid-grey, so bloom picks out genuine
    // highlights instead of haloing every lit surface.
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

  /**
   * Re-reads the drawing buffer. Takes no size, deliberately — see `bufferSize`.
   */
  setSize(): void {
    if (!this.composer) return;
    const { x: width, y: height } = this.bufferSize();
    this.composer.setSize(width, height);
    this.bloom?.setSize(width, height);
  }

  /**
   * Multisampling, as a rung the adaptive ladder can step down.
   *
   * Changing `samples` and disposing is the supported way to resize a render
   * target's sample count: the datablock is freed and reallocated against the
   * new value on next use, which costs an allocation rather than a shader
   * recompile. Rebuilding the composer instead would recompile bloom's five
   * downsample programs in the frame the presenter is speaking over.
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
   * Bloom is a pass rather than a rebuild, so switching it off is one flag.
   * `UnrealBloomPass` does not swap buffers, so a disabled one leaves the chain
   * behind it reading exactly what the render pass wrote.
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

  render(): void {
    if (this.composer) {
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }

  dispose(): void {
    this.composer?.dispose();
    this.composer = null;
    this.bloom = null;
  }
}
