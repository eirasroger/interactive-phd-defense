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
  /** Call every frame: the camera keeps moving after the scene has arrived. */
  track(): void;
  show(visible: boolean, settle?: boolean): gsap.core.Timeline;
}

/**
 * DOM labels tethered to points in the world.
 *
 * The third typographic register the design system names, and the one that was
 * missing: on the glass, in the world, and this — text that belongs to an
 * object rather than to the frame. A composition that talks about four things
 * standing in front of the audience while pointing at none of them reads as a
 * slide that happens to have a render behind it.
 *
 * **Projected into stage coordinates, not window ones.** The canvas layer and
 * the overlay layer are both `inset: 0` inside the same letterboxed stage box,
 * so normalised device coordinates map onto the fixed 1920x1080 surface and the
 * label lands on the object at every scale without reading painted size.
 *
 * Tracking is per frame rather than per beat. The camera arrives on a tween and
 * keeps easing for the better part of two seconds after a scene mounts, so a
 * position sampled once on enter is wrong for exactly as long as anyone is
 * looking at it.
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

        // `z > 1` is behind the near plane, where the projection flips and the
        // label would swing to the opposite side of the frame.
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
