import gsap from 'gsap';
import { DURATION, EASE, seconds } from '@/animations/timing';
import { createCaption } from '@/components/Caption';
import { createPointCloud } from '@/components/three/PointCloud';
import { demoCaptions } from '@/content/demo';
import type { SceneContext, SceneInstance } from '@/engine/scene/types';
import { DEMO_LAYOUT } from './layout';

/** Validates: DOM overlay, GPU point field, camera rest pose. */
export class OriginScene implements SceneInstance {
  enter(context: SceneContext): void {
    // Deliberately sparse: this field sits behind the opening statement, and
    // density here costs legibility for no explanatory gain.
    const budget = Math.min(context.quality.particleBudget, 7_000);

    const cloud = createPointCloud({
      count: budget,
      color: 0x2dd4a7,
      size: 5,
      scatter: 13,
      formation: (index, total) => {
        const angle = (index / total) * Math.PI * 2 * 18;
        const radius = 3 + (index / total) * 9;
        return [Math.cos(angle) * radius, (index / total - 0.5) * 6, Math.sin(angle) * radius];
      },
    });

    cloud.object.position.set(...DEMO_LAYOUT.origin);
    context.stage.add(cloud.object);
    context.onDispose(() => cloud.dispose());

    // Held at low progress: this scene is the "uncertain" end of the language.
    const state = { progress: 0.05 };
    gsap.to(state, {
      progress: 0.28,
      duration: seconds(DURATION.cinematic * 2),
      ease: EASE.standard,
    });

    context.onFrame((_dt, elapsed) => {
      cloud.update(elapsed);
      cloud.setProgress(state.progress);
    });

    const caption = createCaption(demoCaptions['origin']!);
    context.root.appendChild(caption.element);
    caption.reveal(0.2);
  }
}
