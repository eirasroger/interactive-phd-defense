import {
  DoubleSide,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  Quaternion,
  Vector3,
  type BufferGeometry,
  type Material,
  type MeshStandardMaterial,
  type Object3D,
  type PerspectiveCamera,
} from 'three';
import type { CanopyField } from './canopy';
import { chunkInstances, type Chunked } from './chunking';
import {
  drawableTree,
  impostorCard,
  renderImpostorsFor,
  type ImpostorLight,
} from './impostors';
import {
  avenueAt,
  CROSSING,
  inReviewShot,
  plantable,
  riverAt,
  riverSlope,
  riversideAt,
  SPAN,
} from './paths';
import { AVENUE, LAND, PARK, REALM, RIVERSIDE } from './site';
import { seatAt } from './terrain';
import { findTrees, type TreeTemplate } from './trees';
import { applyWind, type Wind } from './wind';

export interface Parkland {
  readonly object: Group;
  update(dt: number): void;
  dispose(): void;
}

export interface ParklandInputs {
  /** Each planted tree registers here so the ground can darken under it. */
  readonly canopy: CanopyField;
  /** Read each frame to pick model or billboard per cell. See `FAR`. */
  readonly camera: PerspectiveCamera;
  /** Renders the billboard textures. */
  readonly renderer: import('three').WebGLRenderer;
}

/**
 * Distance in metres past which a tree is drawn as a billboard. Wide shots
 * see the whole park, so frustum culling cannot help and each full tree costs
 * about 43k triangles. The avenue trees near the camera stay within this range.
 */
const FAR = 90;

/**
 * Park cell size in metres. Cells are both the culling unit and the unit that
 * switches between model and billboard, so they are smaller than the default.
 * Larger cells kept too many trees at full detail.
 */
const LOD_CELL = 40;

/**
 * Lighting for the park billboards. Uses the exterior colours from
 * `ExteriorZone`, brightened until a billboard matches its full model in
 * measured luminance.
 */
const CARD_LIGHT: ImpostorLight = {
  sky: 0x9fc4ea,
  ground: 0x6a7a4e,
  // Much higher than the woodland's values because the capture is tone-mapped.
  // Tuned across five Act I poses to a billboard/model ratio of 0.81 to 1.23.
  ambient: 10.5,
  key: 0xfff4e4,
  keyIntensity: 8.1,
};

/**
 * Park trees, lamps and benches. Tree templates come from `trees.ts`. This
 * decides where they go and how big they are. Trees keep clear of paths by a
 * fraction of their crown radius, so canopies overhang the paths but trunks
 * stay off them.
 */
export function createParkland(
  planting: Object3D,
  props: Object3D,
  { canopy, camera, renderer }: ParklandInputs,
): Parkland {
  const object = new Group();
  object.name = 'parkland';

  const trees = findTrees(planting).filter((tree) => tree.triangles <= PARK.budget);
  const furniture = collectProps(props);

  const placements = new Map<string, Matrix4[]>();
  const parts = new Map<string, { geometry: BufferGeometry; material: Material }>();
  const heights = new Map<string, number>();

  /**
   * Billboard instance matrices per species. Billboards are one unit tall, so
   * they need their own scale, but share position and rotation with the model
   * so nothing moves on swap.
   */
  const cards = new Map<string, { template: TreeTemplate; matrices: Matrix4[] }>();

  let seed = 0x3ad91f;
  const random = (): number => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0x100000000;
  };

  const matrix = new Matrix4();
  const spin = new Quaternion();
  const up = new Vector3(0, 1, 0);
  const scale = new Vector3();
  const seat = new Vector3();

  const emit = (key: string, part: { geometry: BufferGeometry; material: Material }, height: number): void => {
    if (!parts.has(key)) {
      parts.set(key, part);
      heights.set(key, height);
      placements.set(key, []);
    }
    placements.get(key)!.push(matrix.clone());
  };

  let planted = 0;
  let refused = 0;

  /** Plants one tree of the given height in metres. Returns false if the spot is not allowed. */
  const tree = (species: TreeTemplate, x: number, z: number, metres: number): boolean => {
    const unit = metres / species.height;
    const crown = species.radius * unit;
    if (!standable(x, z, crown)) {
      refused += 1;
      return false;
    }
    planted += 1;

    spin.setFromAxisAngle(up, random() * Math.PI * 2);
    // Random width variation so repeated trees look different.
    scale.set(unit * (0.9 + random() * 0.22), unit, unit * (0.9 + random() * 0.22));
    // Seat on the lowest ground under the trunk so it never floats.
    seat.set(x, seatAt(x, z, Math.min(crown * 0.22, 1.4)), z);
    matrix.compose(seat, spin, scale);

    canopy.add(x, z, crown);
    species.parts.forEach((part, index) => emit(`${species.name}#${index}`, part, species.height));

    const card = cards.get(species.name) ?? { template: species, matrices: [] };
    // Uniform scale. The billboard already has its own aspect ratio.
    card.matrices.push(new Matrix4().compose(seat, spin, new Vector3(metres, metres, metres)));
    cards.set(species.name, card);

    return true;
  };

  const prop = (kind: string, x: number, z: number, metres: number): void => {
    const template = furniture.get(kind);
    if (!template) return;
    spin.setFromAxisAngle(up, random() * Math.PI * 2);
    scale.setScalar(metres / template.height);
    // Seat on the lowest ground under the footprint.
    seat.set(x, seatAt(x, z, 0.7) + 0.02, z);
    matrix.compose(seat, spin, scale);
    emit(kind, template, template.height);
  };

  /** Picks a species close to the requested height, to avoid heavy scaling. */
  const species = (metres: number): TreeTemplate | undefined => {
    if (trees.length === 0) return undefined;
    const sorted = [...trees].sort(
      (a, b) => Math.abs(a.height - metres) - Math.abs(b.height - metres),
    );
    return sorted[Math.min(sorted.length - 1, Math.floor(random() * 2))];
  };

  if (trees.length === 0) {
    console.warn('[parkland] no tree templates in the planting asset; the park has no trees.');
  }

  plan(random, tree, prop, species);

  const meshes: InstancedMesh[] = [];
  const swaying: InstancedMesh[] = [];

  const chunks: Chunked[] = [];
  /** Model and billboard meshes per cell. See `Rank`. */
  const ranks = new Map<string, Rank>();

  const rankFor = (key: string): Rank => {
    const existing = ranks.get(key);
    if (existing) return existing;
    const rank: Rank = { near: [], far: [], centre: new Vector3(), radius: 0, modelled: true };
    ranks.set(key, rank);
    return rank;
  };

  for (const [key, list] of placements) {
    const part = parts.get(key)!;
    // Split into cells so they can be culled. See `chunking.ts`.
    const chunked = chunkInstances(
      { geometry: part.geometry, material: part.material, matrices: list },
      key,
      { plantHeight: heights.get(key)! },
      LOD_CELL,
    );
    chunks.push(chunked);

    const tree = !furniture.has(key);

    for (const chunk of chunked.chunks) {
      const { mesh } = chunk;
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      object.add(mesh);
      meshes.push(mesh);
      // Only trees sway.
      if (tree) {
        swaying.push(mesh);
        rankFor(chunk.key).near.push(mesh);
      }
    }
  }

  const wind: Wind = applyWind(swaying);

  // Billboards, rendered from the same templates as the models.
  const impostors = buildCards(renderer, cards);
  const time = { value: 0 };

  for (const { key, mesh } of impostors.chunks) {
    mesh.castShadow = false;
    // No useful normals, and too far away for shadows.
    mesh.receiveShadow = false;
    mesh.visible = false;
    object.add(mesh);
    rankFor(key).far.push(mesh);
  }

  sway(impostors.materials, time);

  // Cell centre and radius from the chunk bounding spheres, so the swap test
  // runs once per cell.
  for (const rank of ranks.values()) {
    const source = rank.near[0] ?? rank.far[0];
    if (!source?.boundingSphere) continue;
    rank.centre.copy(source.boundingSphere.center);
    for (const mesh of [...rank.near, ...rank.far]) {
      if (mesh.boundingSphere) rank.radius = Math.max(rank.radius, mesh.boundingSphere.radius);
    }
  }

  const eye = new Vector3();

  /**
   * Picks model or billboard per cell from the current camera position only.
   * No hysteresis, so jumping to any slide always gives the same picture.
   * Cells may switch during camera moves.
   */
  const swap = (): void => {
    // Bounding spheres are in local space, so move the camera into it. The
    // zone is offset from the world origin.
    object.updateWorldMatrix(true, false);
    eye.copy(camera.position);
    object.worldToLocal(eye);

    for (const rank of ranks.values()) {
      if (rank.far.length === 0) continue;

      // Measure to the cell's near edge, so any tree close to the camera stays a model.
      const modelled = rank.centre.distanceTo(eye) - rank.radius < FAR;
      if (modelled === rank.modelled) continue;

      rank.modelled = modelled;
      for (const mesh of rank.near) mesh.visible = modelled;
      for (const mesh of rank.far) mesh.visible = !modelled;
    }
  };

  swap();

  // Log the refusal rate to catch clearance rules that empty the park.
  const drawn = [...placements.values()].reduce((sum, list) => sum + list.length, 0);
  const average = trees.reduce((sum, entry) => sum + entry.triangles, 0) / (trees.length || 1);
  console.info(
    `[parkland] ${planted} trees planted, ${refused} refused; ` +
      `${drawn} instances in ${meshes.length} draws from ${trees.length} templates ` +
      `(~${((planted * average) / 1e6).toFixed(1)}M tris).`,
  );

  const far = [...ranks.values()].filter((rank) => rank.far.length > 0).length;
  console.info(
    `[parkland] ${ranks.size} tree cells, ${far} with a card rank, ` +
      `swapping beyond ${FAR} m.`,
  );

  return {
    object,
    update(dt: number) {
      wind.update(dt);
      time.value += dt;
      swap();
    },
    dispose() {
      wind.dispose();
      for (const chunk of chunks) chunk.dispose();
      impostors.dispose();
      for (const part of parts.values()) part.geometry.dispose();
    },
  };
}

/**
 * One park cell with its model and billboard meshes. Swapping per cell is cheap
 * and never rewrites instance buffers.
 */
interface Rank {
  readonly near: InstancedMesh[];
  readonly far: InstancedMesh[];
  readonly centre: Vector3;
  /** Cell radius, so the test can measure to the nearest tree. */
  radius: number;
  modelled: boolean;
}

interface Cards {
  readonly chunks: readonly { key: string; mesh: InstancedMesh }[];
  readonly materials: readonly MeshBasicMaterial[];
  dispose(): void;
}

/**
 * Billboards: one rendered image per species, instanced at the same positions.
 * Uses alpha test so no sorting is needed and depth is written.
 */
function buildCards(
  renderer: import('three').WebGLRenderer,
  plan: Map<string, { template: TreeTemplate; matrices: Matrix4[] }>,
): Cards {
  const entries = [...plan.values()];
  const impostors = renderImpostorsFor(
    renderer,
    entries.map((entry) => drawableTree(entry.template)),
    {
      // One tree per billboard, to match the model it replaces.
      clumped: false,
      light: CARD_LIGHT,
    },
  );

  const chunks: { key: string; mesh: InstancedMesh }[] = [];
  const materials: MeshBasicMaterial[] = [];
  const geometries: BufferGeometry[] = [];
  const built: Chunked[] = [];

  impostors.forEach((impostor, index) => {
    const entry = entries[index];
    if (!entry) return;

    const geometry = impostorCard(impostor);
    const material = new MeshBasicMaterial({
      map: impostor.texture,
      transparent: false,
      alphaTest: 0.45,
      side: DoubleSide,
      fog: true,
    });

    const chunked = chunkInstances(
      { geometry, material, matrices: entry.matrices },
      `${entry.template.name}:card`,
      {},
      LOD_CELL,
    );
    built.push(chunked);
    chunks.push(...chunked.chunks);
    materials.push(material);
    geometries.push(geometry);
  });

  return {
    chunks,
    materials,
    dispose() {
      for (const chunk of built) chunk.dispose();
      for (const material of materials) material.dispose();
      for (const geometry of geometries) geometry.dispose();
      for (const impostor of impostors) impostor.dispose();
    },
  };
}

/**
 * Gentle sway for billboards so they move like the models. Weaker than the
 * model wind, since distant trees should move less.
 */
function sway(materials: readonly MeshBasicMaterial[], time: { value: number }): void {
  for (const material of materials) {
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = time;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>
         uniform float uTime;`)
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
           float lean = position.y * position.y;
           float phase = uTime * 0.42 + instanceMatrix[3][0] * 0.06 + instanceMatrix[3][2] * 0.04;
           transformed.x += sin(phase) * lean * 0.030;
           transformed.z += cos(phase * 0.83) * lean * 0.022;`,
        );
    };
  }
}

type Plant = (species: TreeTemplate, x: number, z: number, metres: number) => boolean;
type Prop = (kind: string, x: number, z: number, metres: number) => void;
type Pick = (metres: number) => TreeTemplate | undefined;

/** Whether a tree with this crown radius fits here. Uses `plantable` and `inReviewShot`. */
function standable(x: number, z: number, radius: number): boolean {
  return plantable(x, z, radius * 0.55) && !inReviewShot(x, z);
}

/** The planting plan: regular rows along the avenue, informal groups elsewhere. */
function plan(random: () => number, tree: Plant, prop: Prop, pick: Pick): void {
  const nearBridge = CROSSING.z - SPAN / 2 - 3;

  // Avenue rows, paired on both sides.
  for (let z = AVENUE.from + 5; z < nearBridge; z += PARK.avenue.pitch) {
    for (const side of [-1, 1]) {
      const metres = PARK.avenue.height + random() * 3.4;
      const chosen = pick(metres);
      if (!chosen) break;
      const stand = AVENUE.halfWidth + PARK.avenue.standback + random() * 1.1;
      tree(chosen, avenueAt(z) + side * stand, z, metres);
    }
  }

  // Avenue lamps, closer together than the trees.
  for (let z = AVENUE.from + 2; z < nearBridge; z += 15) {
    for (const side of [-1, 1]) {
      prop('lamp', avenueAt(z) + side * (AVENUE.halfWidth + 1.4), z, 4.4);
    }
  }

  const promenade = (REALM.forecourtFar + REALM.promenadeFar) / 2;
  const verge = (REALM.promenadeFar - REALM.forecourtFar) / 2 + 1.8;
  for (let x = -REALM.run / 2 + 10; x < REALM.run / 2 - 10; x += 18) {
    if (Math.abs(x) < 10) continue;
    prop('lamp', x, promenade + verge, 4.4);
    if (random() < 0.5) prop('bench', x + 6, promenade - verge, 0.95);
    if (random() < 0.55) {
      const metres = 9 + random() * 4;
      const chosen = pick(metres);
      if (chosen) tree(chosen, x + 9, promenade + verge + 5, metres);
    }
  }

  // Groups of two to four trees in the open grass.
  for (let group = 0; group < PARK.groups; group += 1) {
    const gx = -REALM.run / 2 + random() * REALM.run;
    const gz = 36 + random() * 48;

    for (let i = 0; i < 2 + Math.floor(random() * 3); i += 1) {
      const metres = 8 + random() * 6;
      const chosen = pick(metres);
      if (!chosen) break;
      tree(chosen, gx + (random() - 0.5) * 14, gz + (random() - 0.5) * 11, metres);
    }
  }

  // Far river bank, on the flat ground above the channel.
  const top = LAND.river.halfWidth + LAND.river.swale;
  for (let x = RIVERSIDE.to - 4; x > RIVERSIDE.from - 30; x -= 5.5) {
    if (random() > 0.62) continue;
    const slope = riverSlope(x);
    const across = 1 / Math.hypot(1, slope);
    const offset = top + 1.5 + random() * 7;
    const metres = 9 + random() * 6;
    const chosen = pick(metres);
    if (!chosen) break;
    tree(chosen, x - offset * slope * across, riverAt(x) + offset * across, metres);
  }

  // Near side of the riverside walk, sparse to keep the view of the water open.
  for (let x = RIVERSIDE.from; x < RIVERSIDE.to; x += 9) {
    if (random() > 0.4) continue;
    const metres = 7 + random() * 4;
    const chosen = pick(metres);
    if (!chosen) break;
    tree(chosen, x, riversideAt(x) - 6 - random() * 7, metres);
  }
}

interface Furniture {
  readonly geometry: BufferGeometry;
  readonly material: Material;
  readonly height: number;
}

/** Lamp post and bench templates from the props asset. */
function collectProps(source: Object3D): Map<string, Furniture> {
  const props = new Map<string, Furniture>();
  const world = new Matrix4();

  source.updateMatrixWorld(true);
  source.traverse((node) => {
    const mesh = node as Mesh;
    if (!mesh.isMesh || Array.isArray(mesh.material)) return;

    const kind = (mesh.name || '').replace(/\.\d+$/, '').replace(/_part\d+$/, '');
    if (!kind || props.has(kind)) return;

    mesh.updateWorldMatrix(true, false);
    world.copy(mesh.matrixWorld).setPosition(0, 0, 0);

    const geometry = mesh.geometry.clone();
    geometry.applyMatrix4(world);
    geometry.computeBoundingBox();
    const box = geometry.boundingBox;
    if (!box) return;

    geometry.translate(0, -box.min.y, 0);
    geometry.computeBoundingSphere();

    const material = mesh.material as MeshStandardMaterial;
    material.alphaTest = Math.max(material.alphaTest, 0.35);
    material.transparent = false;
    material.depthWrite = true;
    material.needsUpdate = true;

    props.set(kind, { geometry, material, height: Math.max(0.05, box.max.y - box.min.y) });
  });

  if (props.size === 0) console.warn('[parkland] no furniture templates in park-assets.');
  return props;
}
