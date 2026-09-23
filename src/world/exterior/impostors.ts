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
  /** Width over height of the tree, so the card is not stretched. */
  readonly aspect: number;
  dispose(): void;
}

/** Texture height in texels. */
const SIZE = 512;

/** Quads per card. Three at 60° look solid from any angle. */
const BLADES = 3;

/** A cross of quads for an impostor, one unit tall and `aspect` wide. Scale it to the tree height. */
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

/** Plants shorter than this are excluded from the woodland. */
const TREE_METRES = 5;

/**
 * Lighting used when rendering a card. The woodland and the park need
 * different values because each must match its surroundings (see
 * `learnings.md` §29).
 */
export interface ImpostorLight {
  readonly sky: number;
  readonly ground: number;
  readonly ambient: number;
  readonly key: number;
  readonly keyIntensity: number;
}

/**
 * Flat lighting for the woodland. Cards have random rotations, so a strong key
 * light would put each tree's lit side in a different direction.
 */
export const BELT_LIGHT: ImpostorLight = {
  sky: 0xdceaf6,
  ground: 0x4a5236,
  ambient: 2.1,
  key: 0xfff0dc,
  keyIntensity: 1.7,
};

export interface ImpostorOptions {
  /** Three offset copies on one card. Good for a treeline, too much for one tree. */
  readonly clumped?: boolean;
  readonly light?: ImpostorLight;
}

/**
 * Fixed exposure for rendering cards. The live exposure changes with
 * navigation, which would make the result differ between runs.
 */
const PHOTOGRAPH_EXPOSURE = 1;

/**
 * Renders billboard textures at load from the tree models already in memory.
 * Nothing extra ships, and the woodland always matches the near trees.
 *
 * Lighting is baked into the texture, since flat quads have no useful normals
 * for real-time lighting.
 */
export function renderImpostors(
  renderer: WebGLRenderer,
  source: Object3D,
  limit = 4,
): Impostor[] {
  return renderImpostorsFor(renderer, findTemplates(source, limit), { clumped: true });
}

/**
 * Renders cards for specific templates. The park uses this to get a single-tree
 * card of the exact species it swaps out.
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

    // Orthographic, so the texture has no baked-in perspective.
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
 * Three copies of a tree, offset and scaled, rendered as one card. A single
 * sparse conifer is see-through, while a clump closes up the treeline.
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

/** The tallest trees in an asset, as renderable objects. Detection is in `trees.ts`. */
function findTemplates(source: Object3D, limit: number): Object3D[] {
  return findTrees(source)
    .filter((tree) => tree.height >= TREE_METRES)
    .slice(0, limit)
    .map(drawableTree);
}

/** Turns a tree template into a renderable group. */
export function drawableTree(tree: TreeTemplate): Object3D {
  const group = new Group();
  group.name = tree.name;
  for (const part of tree.parts) group.add(new Mesh(part.geometry, part.material));
  return group;
}
