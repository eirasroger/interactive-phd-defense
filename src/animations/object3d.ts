import gsap from 'gsap';
import { Material, type Object3D } from 'three';
import { DURATION, EASE, seconds } from './timing';

interface FadeOptions {
  seconds?: number;
  ease?: string;
  delay?: number;
}

function materialsOf(root: Object3D): Material[] {
  const found: Material[] = [];
  root.traverse((child) => {
    const material = (child as { material?: Material | Material[] }).material;
    if (!material) return;
    if (Array.isArray(material)) found.push(...material);
    else found.push(material);
  });
  return found;
}

/**
 * Fades an object in by animating material opacity.
 *
 * Transparency is enabled for the duration and switched back off at the end:
 * leaving objects permanently transparent costs a depth-sorting pass and
 * causes ordering artefacts once scenes get dense.
 */
export function fadeIn(root: Object3D, options: FadeOptions = {}): gsap.core.Timeline {
  const materials = materialsOf(root);
  const timeline = gsap.timeline();

  for (const material of materials) {
    const targetOpacity = material.opacity;
    material.transparent = true;
    material.opacity = 0;

    timeline.to(
      material,
      {
        opacity: targetOpacity,
        duration: seconds(options.seconds ?? DURATION.slow),
        ease: options.ease ?? EASE.enter,
        onComplete: () => {
          material.transparent = targetOpacity < 1;
        },
      },
      options.delay ?? 0,
    );
  }

  return timeline;
}

export function fadeOut(root: Object3D, options: FadeOptions = {}): gsap.core.Timeline {
  const materials = materialsOf(root);
  const timeline = gsap.timeline();

  for (const material of materials) {
    material.transparent = true;
    timeline.to(
      material,
      {
        opacity: 0,
        duration: seconds(options.seconds ?? DURATION.normal),
        ease: options.ease ?? EASE.exit,
      },
      options.delay ?? 0,
    );
  }

  return timeline;
}

/** Disposes geometry and materials a scene created itself. */
export function disposeObject3D(root: Object3D): void {
  root.traverse((child) => {
    const mesh = child as { geometry?: { dispose(): void }; material?: Material | Material[] };
    mesh.geometry?.dispose();
    if (!mesh.material) return;
    if (Array.isArray(mesh.material)) mesh.material.forEach((m) => m.dispose());
    else mesh.material.dispose();
  });
}
