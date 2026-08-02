import gsap from 'gsap';
import { DURATION, EASE, seconds } from '@/animations/timing';
import { createCaption } from '@/components/Caption';
import { createPointCloud } from '@/components/three/PointCloud';
import { demoCaptions } from '@/content/demo';
import type { SceneContext, SceneInstance } from '@/engine/scene/types';
import { DEMO_LAYOUT } from './layout';

const COLUMNS = 48;

/** Validates: large GPU instancing, shader-driven state, scene-owned disposal. */
export class FieldScene implements SceneInstance {
  enter(context: SceneContext): void {
    const count = Math.min(context.quality.particleBudget, 40_000);

    const cloud = createPointCloud({
      count,
      color: 0xf5a524,
      size: 6,
      scatter: 17,
      // A ranked lattice: ordered rows and columns, the resolved counterpart
      // to the scattered cloud in the opening scene.
      formation: (index) => {
        const column = index % COLUMNS;
        const row = Math.floor(index / COLUMNS);
        const rows = Math.ceil(count / COLUMNS);
        const x = (column / (COLUMNS - 1) - 0.5) * 20;
        const z = (row / Math.max(rows - 1, 1) - 0.5) * 14;
        const y = Math.sin(column * 0.32) * Math.cos(row * 0.21) * 1.6;
        return [x, y, z];
      },
    });

    cloud.object.position.set(...DEMO_LAYOUT.field);
    context.stage.add(cloud.object);
    context.onDispose(() => cloud.dispose());

    const state = { progress: 0 };
    gsap.to(state, {
      progress: 1,
      duration: seconds(DURATION.cinematic * 2.2),
      ease: EASE.standard,
      delay: seconds(DURATION.normal),
    });

    context.onFrame((_dt, elapsed) => {
      cloud.update(elapsed);
      cloud.setProgress(state.progress);
    });

    const caption = createCaption(demoCaptions['field']!);
    context.root.appendChild(caption.element);
    caption.reveal(0.2);
  }
}
