import gsap from 'gsap';
import { Vector3, type PerspectiveCamera } from 'three';
import { DURATION, EASE, STAGGER, seconds } from '@/animations/timing';
import { STAGE } from '@/config/presentation';
import type { Vec3 } from '@/engine/camera/types';
import { el } from '@/utilities/dom';
import './anchor.css';

export interface AnchorSpec {
  /** World position the label is tethered to. */
  readonly position: Vec3;
  readonly label: string;
}

export interface AnchorField {
  readonly element: HTMLElement;
  /** Call every frame, since the camera keeps easing after the scene mounts. */
  track(): void;
  show(visible: boolean, settle?: boolean): gsap.core.Timeline;
}

/**
 * DOM labels tethered to world points. Positions are projected into the fixed
 * 1920x1080 stage coordinates, which the canvas and overlay share, so labels
 * stay on target at any scale.
 */
export function createAnchorField(
  camera: PerspectiveCamera,
  specs: readonly AnchorSpec[],
): AnchorField {
  const projected = new Vector3();

  const anchors = specs.map((spec) => {
    const node = el('div', {
      className: 'anchor',
      children: [
        el('span', { className: 'anchor-label', text: spec.label }),
        el('span', { className: 'anchor-stem' }),
        el('span', { className: 'anchor-dot' }),
      ],
    });
    gsap.set(node, { opacity: 0, y: 10 });
    return { node, position: new Vector3(...spec.position) };
  });

  const element = el('div', {
    className: 'anchor-field',
    children: anchors.map((anchor) => anchor.node),
  });

  return {
    element,

    track() {
      for (const anchor of anchors) {
        projected.copy(anchor.position).project(camera);

        // `z > 1` is behind the near plane, where the projection flips sides.
        if (projected.z > 1) {
          anchor.node.style.visibility = 'hidden';
          continue;
        }

        anchor.node.style.visibility = 'visible';
        anchor.node.style.left = `${(projected.x * 0.5 + 0.5) * STAGE.width}px`;
        anchor.node.style.top = `${(1 - (projected.y * 0.5 + 0.5)) * STAGE.height}px`;
      }
    },

    show(visible, settle = false) {
      const timeline = gsap.timeline();
      const nodes = anchors.map((anchor) => anchor.node);

      if (settle) {
        gsap.set(nodes, { opacity: visible ? 1 : 0, y: visible ? 0 : 10 });
        return timeline;
      }

      return timeline.to(nodes, {
        opacity: visible ? 1 : 0,
        y: visible ? 0 : 10,
        duration: seconds(DURATION.slow),
        ease: visible ? EASE.enter : EASE.exit,
        stagger: seconds(STAGGER * 2),
        overwrite: 'auto',
      });
    },
  };
}
