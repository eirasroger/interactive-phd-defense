import {
  Box3,
  DirectionalLight,
  Group,
  HemisphereLight,
  LinearFilter,
  Mesh,
  OrthographicCamera,
  Scene,
  Vector3,
  WebGLRenderTarget,
  type Object3D,
  type Texture,
  type WebGLRenderer,
} from 'three';
import { findTrees } from './trees';

export interface Impostor {
  readonly texture: Texture;
  /** Width over height of the source tree, so the card is never stretched. */
  readonly aspect: number;
  dispose(): void;
}

/** Texels across the tallest dimension of one tree. */
const SIZE = 512;

/** Plants shorter than this are understorey and never stand in the far belt. */
const TREE_METRES = 5;

/**
 * Billboard impostors, rendered in the browser from the trees already loaded.
 *
 * The perimeter woodland needs eight hundred trees and cannot afford eight
 * hundred meshes. The usual answer is an atlas of tree cut-outs baked in
 * Blender and shipped as a texture, which costs a megabyte, a pipeline step,
 * and a standing obligation to re-bake whenever the planting changes species.
 *
 * None of that is necessary, because the trees are **already here**. Rendering
 * them to a texture at load costs a few milliseconds once, ships nothing, and
 * cannot drift out of agreement with the near planting — the belt is literally
 * a photograph of the same asset. Change the species in `fetch_assets.py` and
 * the woodland changes with it, with no second thing to remember.
 *
 * Lighting is baked into the card rather than evaluated per fragment. A cross
 * of flat quads has no meaningful normal, so lighting one in real time gives a
 * flat shape that swings between fully lit and fully dark as the camera turns;
 * a rendered tree carries its own modelling. At 96 m and beyond, through haze,
 * that is the correct trade and it is the one every real-time forest makes.
 */
export function renderImpostors(
  renderer: WebGLRenderer,
  source: Object3D,
  limit = 4,
): Impostor[] {
  const templates = findTemplates(source, limit);
  if (templates.length === 0) return [];

  const scene = new Scene();
  // Flat-ish and generous. The card is seen against sky and haze from a long
  // way off, and anything approaching a real key here bakes a hard shadow side
  // into a shape that will be seen from every angle.
  const sky = new HemisphereLight(0xdceaf6, 0x4a5236, 2.1);
  const key = new DirectionalLight(0xfff0dc, 1.7);
  key.position.set(-4, 5, 6);
  scene.add(sky, key);

  const state = renderer.getRenderTarget();
  const alpha = renderer.getClearAlpha();
  renderer.setClearAlpha(0);

  const impostors = templates.map((template, index) => {
    const subject = clump(template, index);
    const bounds = new Box3().setFromObject(subject);
    const size = bounds.getSize(new Vector3());
    const centre = bounds.getCenter(new Vector3());

    const height = Math.max(size.y, 0.001);
    const width = Math.max(size.x, size.z, 0.001);
    const aspect = width / height;

    const target = new WebGLRenderTarget(Math.round(SIZE * aspect), SIZE, {
      minFilter: LinearFilter,
      magFilter: LinearFilter,
      depthBuffer: true,
    });
    target.texture.generateMipmaps = false;

    // Orthographic and square to the tree, so the card carries no perspective
    // of its own to disagree with the perspective it is drawn under.
    const camera = new OrthographicCamera(-width / 2, width / 2, height / 2, -height / 2, 0.1, 4000);
    camera.position.set(centre.x, centre.y, centre.z + Math.max(width, height) * 2);
    camera.lookAt(centre);

    scene.add(subject);
    renderer.setRenderTarget(target);
    renderer.clear(true, true, false);
    renderer.render(scene, camera);
    scene.remove(subject);

    return {
      texture: target.texture,
      aspect,
      dispose() {
        target.dispose();
      },
    };
  });

  renderer.setRenderTarget(state);
  renderer.setClearAlpha(alpha);
  scene.clear();

  return impostors;
}

/**
 * Three of the same tree, jittered, rendered as one card.
 *
 * A single conifer at LOD1 is a thin pole with a sparse canopy — accurate to
 * the asset, and useless as a woodland edge, because a belt of them is a belt
 * of poles you can see clean through. That is not a density problem the
 * instance count can solve: doubling the trees doubles the poles.
 *
 * A card carrying a clump reads as woodland at a third of the instances,
 * because what closes a treeline is overlapping canopy rather than trunk
 * count. The neighbours are pushed back and scaled down so the card has depth
 * inside it, which also means the belt gains parallax it never paid for.
 */
function clump(template: Object3D, seed: number): Object3D {
  const group = new Group();
  const offsets: [number, number, number, number][] = [
    [0, 0, 0, 1],
    [-0.62, -0.5, 0.7, 0.78],
    [0.58, -0.34, -0.5, 0.66],
  ];

  offsets.forEach(([x, z, spin, scale], index) => {
    const tree = template.clone(true);
    const reach = Math.max(new Box3().setFromObject(tree).getSize(new Vector3()).x, 1);
    tree.position.add(new Vector3(x * reach, 0, z * reach));
    tree.rotateY(spin + seed + index);
    tree.scale.multiplyScalar(scale);
    group.add(tree);
  });

  return group;
}

/**
 * The distinct trees in an asset, tallest first, as drawable objects.
 *
 * Identifying them is `trees.ts`'s job — the belt and the park must agree on
 * what a tree is, or the treeline is one species and the park is another. What
 * is left here is turning a template back into something a scene can render.
 */
function findTemplates(source: Object3D, limit: number): Object3D[] {
  return findTrees(source)
    .filter((tree) => tree.height >= TREE_METRES)
    .slice(0, limit)
    .map((tree) => {
      const group = new Group();
      group.name = tree.name;
      for (const part of tree.parts) group.add(new Mesh(part.geometry, part.material));
      return group;
    });
}
