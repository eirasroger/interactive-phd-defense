import { Vector2, type Camera, type Scene, type WebGLRenderer } from 'three';
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

  constructor(
    private readonly renderer: WebGLRenderer,
    private readonly scene: Scene,
    private camera: Camera,
    quality: QualitySettings,
  ) {
    if (quality.postProcessing) this.buildComposer(quality);
  }

  private buildComposer(quality: QualitySettings): void {
    const { width, height } = this.renderer.getSize(new Vector2());

    this.composer = new EffectComposer(this.renderer);
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

  setCamera(camera: Camera): void {
    this.camera = camera;
    if (!this.composer) return;
    for (const pass of this.composer.passes) {
      if (pass instanceof RenderPass) pass.camera = camera;
    }
  }

  setSize(width: number, height: number): void {
    this.composer?.setSize(width, height);
    this.bloom?.setSize(width, height);
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
