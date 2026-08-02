import gsap from 'gsap';
import {
  BoxGeometry,
  Color,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Vector3,
  type BufferGeometry,
  type Texture,
} from 'three';
import { DURATION, EASE, seconds } from '@/animations/timing';
import { createCaption } from '@/components/Caption';
import { demoCaptions } from '@/content/demo';
import type { SceneContext, SceneInstance } from '@/engine/scene/types';
import { CORRIDOR, STATION_IDS, stationZ } from './corridor';
import { DEMO_LAYOUT } from './layout';

const ACCENT = 0x5b9dff;
const EMISSIVE_INTENSITY = 2.6;

/**
 * The corridor, walked from the inside.
 *
 * Geometry and lighting both come from `tools/blender/corridor_bay.py`: one bay
 * whose ribs and chamfers are modifier output, lit by a Cycles bake that
 * carries bounce light, contact shadows and the accent strips' colour spill.
 * The web material is therefore unlit — the whole lighting solution is one
 * texture and zero lights per frame, which is the part real-time rendering
 * cannot reproduce at any price.
 *
 * The bay is instanced, so the corridor is one draw call however long it grows.
 */
export class CorridorScene implements SceneInstance {
  constructor(private readonly station: number) {}

  enter(context: SceneContext): void {
    const group = new Group();
    group.position.set(...DEMO_LAYOUT.corridor);
    context.stage.add(group);

    const bay = this.bayFrom(context);
    const bays = new InstancedMesh(bay.geometry, bay.material, CORRIDOR.stationCount);
    const matrix = new Matrix4();
    for (let i = 0; i < CORRIDOR.stationCount; i += 1) {
      bays.setMatrixAt(i, matrix.makeTranslation(0, 0, stationZ(i)));
    }
    bays.instanceMatrix.needsUpdate = true;
    // Instances span the whole corridor; culling against the first bay's
    // bounds would pop the run out of view the moment the camera passes it.
    bays.frustumCulled = false;
    group.add(bays);

    const strips = this.buildStrips(group);

    context.onDispose(() => {
      // The bay's geometry and texture belong to the asset cache and are shared
      // with every other visit — only what this scene created is disposed.
      bay.material.dispose();
      strips.geometry.dispose();
      strips.material.dispose();
    });

    gsap.to(strips.material, {
      emissiveIntensity: EMISSIVE_INTENSITY,
      duration: seconds(DURATION.slow * 1.4),
      ease: EASE.enter,
      delay: 0.1,
    });

    const caption = createCaption(demoCaptions[STATION_IDS[this.station]!.toLowerCase()]!);
    context.root.appendChild(caption.element);
    caption.reveal(0.2);
  }

  /**
   * Unlit material over the baked map.
   *
   * A MeshStandardMaterial would relight geometry that already contains its
   * lighting, washing out exactly the contact shadows the bake was run for.
   */
  private bayFrom(context: SceneContext): { geometry: BufferGeometry; material: MeshBasicMaterial } {
    const gltf = context.assets.model('corridorBay');

    let source: Mesh | null = null;
    gltf.scene.traverse((child) => {
      if (!source && (child as Mesh).isMesh) source = child as Mesh;
    });
    if (!source) throw new Error('corridorBay contains no mesh.');

    const mesh = source as Mesh;
    const baked = (mesh.material as MeshStandardMaterial).map as Texture | null;

    return {
      geometry: mesh.geometry,
      material: new MeshBasicMaterial({ map: baked, fog: true }),
    };
  }

  /**
   * The light sources themselves.
   *
   * The bake holds their spill but not the emitters — they were never part of
   * the exported mesh — so the visible source is drawn here, where its
   * brightness can be animated.
   */
  private buildStrips(group: Group) {
    const { width, height, gap, stationCount } = CORRIDOR;
    const run = gap * stationCount;
    const half = width / 2;

    const geometry = new BoxGeometry(0.06, 0.07, run - 0.4);
    const material = new MeshStandardMaterial({
      color: 0x05070a,
      emissive: new Color(ACCENT),
      emissiveIntensity: 0,
    });

    const strips = new InstancedMesh(geometry, material, 3);
    const matrix = new Matrix4();
    const centre = stationZ(0) - run / 2;
    const unit = new Vector3(1, 1, 1);

    strips.setMatrixAt(0, matrix.makeTranslation(-half + 0.1, 0.16, centre).scale(unit));
    strips.setMatrixAt(1, matrix.makeTranslation(half - 0.1, 0.16, centre).scale(unit));
    // The ceiling strip is a wide panel rather than a rail, so it is the same
    // geometry stretched across the corridor.
    strips.setMatrixAt(
      2,
      matrix
        .makeTranslation(0, height - 0.18, centre)
        .scale(new Vector3((width - 1.2) / 0.06, 1, 1)),
    );
    strips.instanceMatrix.needsUpdate = true;
    strips.frustumCulled = false;
    group.add(strips);

    return { geometry, material, mesh: strips };
  }
}
