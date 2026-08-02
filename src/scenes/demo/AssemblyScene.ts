import gsap from 'gsap';
import { Box3, Vector3, type Object3D } from 'three';
import { DURATION, EASE, STAGGER, seconds } from '@/animations/timing';
import { createCaption } from '@/components/Caption';
import { demoCaptions } from '@/content/demo';
import type { SceneContext, SceneInstance } from '@/engine/scene/types';
import { DEMO_LAYOUT } from './layout';

const EXPLODE_SPACING = 0.9;

/** Validates: asset manifest, Draco decode, GLB node addressing, PBR lighting. */
export class AssemblyScene implements SceneInstance {
  enter(context: SceneContext): void {
    // Cloned, not mutated: the loaded GLTF stays pristine in the asset cache
    // so revisiting this scene costs nothing. Geometry and materials are
    // shared with the cache, which is why this scene disposes neither.
    const model = context.assets.model('assembly').scene.clone(true);

    const bounds = new Box3().setFromObject(model);
    const centre = bounds.getCenter(new Vector3());
    model.position.set(
      DEMO_LAYOUT.assembly[0] - centre.x,
      DEMO_LAYOUT.assembly[1] - centre.y,
      DEMO_LAYOUT.assembly[2] - centre.z,
    );

    for (const child of model.children) {
      child.castShadow = context.quality.shadows;
      child.receiveShadow = context.quality.shadows;
    }

    context.stage.add(model);

    // Sorted by height rather than trusting GLB node order, which the
    // exporter is free to change between runs.
    const layers = [...model.children].sort((a, b) => a.position.y - b.position.y);
    this.explode(layers);

    const caption = createCaption(demoCaptions['assembly']!);
    context.root.appendChild(caption.element);
    caption.reveal(0.2);
  }

  /** Separates the named layers so the build-up is legible rather than a block. */
  private explode(layers: readonly Object3D[]): void {
    const timeline = gsap.timeline();

    layers.forEach((layer, index) => {
      const restingY = layer.position.y;
      layer.position.y = restingY - 1.4;

      timeline.to(
        layer.position,
        {
          y: restingY + index * EXPLODE_SPACING,
          duration: seconds(DURATION.cinematic),
          ease: EASE.enter,
        },
        index * seconds(STAGGER * 2),
      );
    });
  }
}
