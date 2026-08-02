import gsap from 'gsap';
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Points,
  PointsMaterial,
  Vector3,
} from 'three';
import { DURATION, EASE, STAGGER, seconds } from '@/animations/timing';
import { disposeObject3D } from '@/animations/object3d';
import { createCaption } from '@/components/Caption';
import { demoCaptions } from '@/content/demo';
import type { SceneContext, SceneInstance } from '@/engine/scene/types';
import { DEMO_LAYOUT } from './layout';

const STAGES = 5;
const STAGE_SPACING = 4.2;
const STREAM_PARTICLES = 900;
const STREAM_SPEED = 0.16;

/** Validates: procedural geometry, animated data flow, PBR materials, timelines. */
export class FlowScene implements SceneInstance {
  enter(context: SceneContext): void {
    const group = new Group();
    group.position.set(...DEMO_LAYOUT.flow);
    context.stage.add(group);

    const nodes = this.buildStages(group, context);
    const path = nodes.map((node) => node.position.clone());

    this.buildLinks(group, path);
    const stream = this.buildStream(group, path, context);

    context.onFrame((dt, elapsed) => stream.update(dt, elapsed));

    // Everything here is scene-created, so the scene owns its disposal.
    context.onDispose(() => disposeObject3D(group));

    const caption = createCaption(demoCaptions['flow']!);
    context.root.appendChild(caption.element);
    caption.reveal(0.2);
  }

  private buildStages(group: Group, context: SceneContext): Mesh[] {
    const geometry = new CylinderGeometry(0.75, 0.75, 0.34, 48);
    const timeline = gsap.timeline();
    const nodes: Mesh[] = [];

    for (let i = 0; i < STAGES; i += 1) {
      // Hue walks from the AI blue toward the circular green: the pipeline
      // visibly moves from computation to a sustainability outcome.
      const material = new MeshStandardMaterial({
        color: new Color().lerpColors(
          new Color(0x5b9dff),
          new Color(0x2dd4a7),
          i / (STAGES - 1),
        ),
        roughness: 0.28,
        metalness: 0.6,
        emissive: new Color(0x0a1622),
      });

      const node = new Mesh(geometry, material);
      node.position.set((i - (STAGES - 1) / 2) * STAGE_SPACING, 0, 0);
      node.rotation.x = Math.PI / 2;
      node.castShadow = context.quality.shadows;
      group.add(node);
      nodes.push(node);

      node.scale.setScalar(0.001);
      timeline.to(
        node.scale,
        {
          x: 1,
          y: 1,
          z: 1,
          duration: seconds(DURATION.slow),
          ease: EASE.enter,
        },
        i * seconds(STAGGER * 2),
      );
    }

    return nodes;
  }

  private buildLinks(group: Group, path: readonly Vector3[]): void {
    const material = new MeshStandardMaterial({
      color: 0x2a3442,
      roughness: 0.6,
      metalness: 0.2,
    });

    for (let i = 0; i < path.length - 1; i += 1) {
      const from = path[i]!;
      const to = path[i + 1]!;
      const length = from.distanceTo(to);

      const link = new Mesh(new CylinderGeometry(0.035, 0.035, length, 8), material);
      link.position.copy(from).lerp(to, 0.5);
      link.rotation.z = Math.PI / 2;
      group.add(link);
    }
  }

  /**
   * A stream of particles travelling the length of the pipeline.
   *
   * Positions are updated on the CPU because the count is small and the path
   * is polyline-based; a GPU implementation would not pay for itself here.
   */
  private buildStream(group: Group, path: readonly Vector3[], context: SceneContext) {
    const count = Math.min(STREAM_PARTICLES, context.quality.particleBudget);
    const positions = new Float32Array(count * 3);
    const offsets = new Float32Array(count);

    for (let i = 0; i < count; i += 1) offsets[i] = Math.random();

    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(positions, 3));

    const material = new PointsMaterial({
      color: 0x9fd9ff,
      size: 0.075,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      blending: AdditiveBlending,
    });

    const points = new Points(geometry, material);
    points.frustumCulled = false;
    group.add(points);

    const start = path[0]!;
    const end = path[path.length - 1]!;
    const span = end.x - start.x;

    let travelled = 0;

    return {
      update(dt: number, elapsed: number) {
        travelled = (travelled + dt * STREAM_SPEED) % 1;

        for (let i = 0; i < count; i += 1) {
          const t = (offsets[i]! + travelled) % 1;
          const seed = offsets[i]! * 6.283;

          positions[i * 3] = start.x + span * t;
          // Particles converge toward the axis as they advance: the spread
          // narrowing is the pipeline refining a diffuse input.
          const spread = (1 - t) * 0.85 + 0.06;
          positions[i * 3 + 1] = Math.sin(elapsed * 1.4 + seed) * spread;
          positions[i * 3 + 2] = Math.cos(elapsed * 1.1 + seed) * spread;
        }

        geometry.attributes['position']!.needsUpdate = true;
      },
    };
  }
}
