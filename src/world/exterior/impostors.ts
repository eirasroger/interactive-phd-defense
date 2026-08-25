import {
  Box3,
  BufferGeometry,
  DirectionalLight,
  Float32BufferAttribute,
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
import { findTrees, type TreeTemplate } from './trees';

export interface Impostor {
  readonly texture: Texture;
  /** Width over height of the source tree, so the card is never stretched. */
  readonly aspect: number;
  dispose(): void;
}

/** Texels across the tallest dimension of one tree. */
const SIZE = 512;

/**
 * Quads per card. Three at sixty degrees reads as a volume from any bearing.
 *
 * Shared by the belt and by the park's far rank rather than written twice: they
 * are the same construction seen at different distances, and two copies would
 * be two things to keep in agreement about what a tree card is.
 */
const BLADES = 3;

/**
 * A cross of quads carrying an impostor, one unit tall and `aspect` wide.
 *
 * Unit height rather than metres, so a caller scales the card by the finished
 * height it wants and the aspect keeps the width honest. That is what lets the
 * park reuse a placement's own position and yaw with nothing but the scale
 * changed.
 */
export function impostorCard(impostor: Impostor): BufferGeometry {
  const geometry = new BufferGeometry();
  const half = impostor.aspect / 2;

  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let blade = 0; blade < BLADES; blade += 1) {
    const angle = (blade / BLADES) * Math.PI;
    const dx = Math.cos(angle) * half;
    const dz = Math.sin(angle) * half;
    const base = blade * 4;

    positions.push(-dx, 0, -dz, dx, 0, dz, dx, 1, dz, -dx, 1, -dz);
    uvs.push(0, 0, 1, 0, 1, 1, 0, 1);
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/** Plants shorter than this are understorey and never stand in the far belt. */
const TREE_METRES = 5;

/**
 * How a card is lit when it is photographed.
 *
 * A parameter rather than a constant because **a card has to match whatever it
 * stands next to**, and the belt and the park stand next to different things.
 * The belt is seen from 96 m and beyond against sky, through enough fog to wash
 * it halfway to the horizon colour. The park's far rank is seen at 90 m against
 * a sunlit lawn with almost no fog on it at all — `fogNear` is 110 — so it is
 * read directly against modelled trees lit by a 6.2 key.
 *
 * Measured, the belt's levels put the park's cards at **49% of the luminance of
 * the same tree modelled**, with 63% of their pixels in the darkest eighth of
 * the range: not trees at a distance, silhouettes. `learnings.md` §29 is exactly
 * this — a new surface inherits none of the tuning around it.
 */
export interface ImpostorLight {
  readonly sky: number;
  readonly ground: number;
  readonly ambient: number;
  readonly key: number;
  readonly keyIntensity: number;
}

/**
 * Deliberately flat, and that is not the same as dim.
 *
 * These are **cross-cards rather than camera-facing billboards**, so whatever
 * modelling is baked in is fixed in the card's own space while its yaw is
 * random per instance. A strong key would give every tree a lit side pointing
 * somewhere different. Flat lighting at the right *level* is the trade: the
 * level is what has to match the neighbours, the modelling is what cannot.
 */
export const BELT_LIGHT: ImpostorLight = {
  sky: 0xdceaf6,
  ground: 0x4a5236,
  ambient: 2.1,
  key: 0xfff0dc,
  keyIntensity: 1.7,
};

export interface ImpostorOptions {
  /** Three jittered copies on one card. Closes a treeline; triples a single tree. */
  readonly clumped?: boolean;
  readonly light?: ImpostorLight;
}

/**
 * Exposure the photograph is taken at.
 *
 * Pinned rather than inherited. `toneMappingExposure` is driven by whichever
 * atmosphere the deck is currently easing through, so a card photographed
 * during zone construction would carry whatever the exposure happened to be at
 * that instant — which is a value that changes with navigation and is therefore
 * not reproducible between one run and the next.
 */
const PHOTOGRAPH_EXPOSURE = 1;

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
  return renderImpostorsFor(renderer, findTemplates(source, limit), { clumped: true });
}

/**
 * The same photograph, taken of templates the caller has already chosen.
 *
 * The park needs a card of **one** tree rather than the belt's clump, and it
 * needs the card to be of the exact template standing next to it: a far rank
 * photographed from a different species than the near rank is a treeline that
 * changes species at a distance, which is the one thing a level-of-detail swap
 * must never look like.
 */
export function renderImpostorsFor(
  renderer: WebGLRenderer,
  templates: readonly Object3D[],
  { clumped = false, light = BELT_LIGHT }: ImpostorOptions = {},
): Impostor[] {
  if (templates.length === 0) return [];

  const scene = new Scene();
  const sky = new HemisphereLight(light.sky, light.ground, light.ambient);
  const key = new DirectionalLight(light.key, light.keyIntensity);
  key.position.set(-4, 5, 6);
  scene.add(sky, key);

  const state = renderer.getRenderTarget();
  const alpha = renderer.getClearAlpha();
  const exposure = renderer.toneMappingExposure;
  renderer.setClearAlpha(0);
  renderer.toneMappingExposure = PHOTOGRAPH_EXPOSURE;

  const impostors = templates.map((template, index) => {
    const subject = clumped ? clump(template, index) : template;
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
  renderer.toneMappingExposure = exposure;
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
    .map(drawableTree);
}

/**
 * A template turned back into something a scene can render.
 *
 * Identifying what a tree *is* belongs to `trees.ts`, so the belt, the park and
 * the park's far rank cannot disagree about it.
 */
export function drawableTree(tree: TreeTemplate): Object3D {
  const group = new Group();
  group.name = tree.name;
  for (const part of tree.parts) group.add(new Mesh(part.geometry, part.material));
  return group;
}
