import {
  BufferGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  Quaternion,
  Vector3,
  type Object3D,
  type WebGLRenderer,
} from 'three';
import { renderImpostors, type Impostor } from './impostors';
import { offAvenue, offPromenade, pitch } from './paths';
import { LAND, WOODLAND } from './site';
import { heightAt } from './terrain';

export interface Woodland {
  readonly object: Group;
  update(dt: number): void;
  dispose(): void;
}

/** Quads per card. Three at sixty degrees reads as a volume from any bearing. */
const BLADES = 3;

/**
 * The belt of woodland that closes the site.
 *
 * This is the piece that fixes the emptiness, and it fixes it by **bounding the
 * world rather than filling it**. Three hundred metres of open ground cannot be
 * populated at any price worth paying for a live presentation; it can be ended,
 * at 96 m, for eight hundred billboards and one draw call per species. Nothing
 * beyond the canopy line has to exist, because nothing beyond it can be seen —
 * which is the entire reason this is affordable.
 *
 * **Depth, not height, is what makes it read as a wood.** One rank of trees is
 * a row with a horizon behind it and fools nobody. Six ranks between 96 m and
 * 168 m, jittered, at graded heights, on ground that is itself rising, present
 * an interior that the eye cannot see through and therefore stops trying to.
 * The ranks cost nothing extra — the instance count is what it is regardless of
 * how deep the band it occupies is.
 *
 * Cross-cards rather than camera-facing billboards. A quad that turns to face
 * the camera shears visibly whenever the camera moves, and Act I's camera moves
 * between every station; three fixed quads never do, and at this distance the
 * silhouette is the entire read.
 */
export function createWoodland(renderer: WebGLRenderer, source: Object3D): Woodland {
  const impostors = renderImpostors(renderer, source);
  const object = new Group();
  object.name = 'woodland';

  if (impostors.length === 0) {
    console.warn('[exterior] no tree templates found; woodland belt is empty.');
    return { object, update() {}, dispose() {} };
  }

  const time = { value: 0 };
  const placements = scatter();
  const meshes: InstancedMesh[] = [];
  const materials: MeshBasicMaterial[] = [];
  const geometries: BufferGeometry[] = [];

  impostors.forEach((impostor, species) => {
    const mine = placements.filter((_, index) => index % impostors.length === species);
    if (mine.length === 0) return;

    const geometry = card(impostor);
    const material = new MeshBasicMaterial({
      map: impostor.texture,
      transparent: false,
      // Cut, not blended. Eight hundred overlapping transparent cards would
      // need sorting every frame and would still be wrong; a hard cut needs
      // neither and writes depth, so the belt occludes itself correctly.
      alphaTest: 0.45,
      side: DoubleSide,
      fog: true,
    });

    sway(material, time);

    const mesh = new InstancedMesh(geometry, material, mine.length);
    const matrix = new Matrix4();
    const quaternion = new Quaternion();
    const axis = new Vector3(0, 1, 0);
    const scale = new Vector3();
    const position = new Vector3();

    mine.forEach((placement, index) => {
      quaternion.setFromAxisAngle(axis, placement.yaw);
      scale.setScalar(placement.height);
      position.set(placement.x, placement.y, placement.z);
      mesh.setMatrixAt(index, matrix.compose(position, quaternion, scale));
    });

    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    // A belt this far out neither receives a shadow worth the map space nor
    // casts one that lands anywhere the camera looks.
    mesh.castShadow = false;
    mesh.receiveShadow = false;

    object.add(mesh);
    meshes.push(mesh);
    materials.push(material);
    geometries.push(geometry);
  });

  console.info(
    `[exterior] woodland: ${placements.length} trees, ${impostors.length} species, ${meshes.length} draws.`,
  );

  return {
    object,
    update(dt: number) {
      time.value += dt;
    },
    dispose() {
      for (const mesh of meshes) mesh.dispose();
      for (const material of materials) material.dispose();
      for (const geometry of geometries) geometry.dispose();
      for (const impostor of impostors) impostor.dispose();
    },
  };
}

interface Placement {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly yaw: number;
  readonly height: number;
}

/**
 * Where the belt stands.
 *
 * Deterministic, from a seeded sequence rather than `Math.random`: a defence is
 * rehearsed, and a treeline that reshuffles between run-throughs is a thing the
 * speaker has to notice mid-sentence.
 */
function scatter(): Placement[] {
  const placements: Placement[] = [];
  let seed = 0x2f6a35;

  const random = (): number => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0x100000000;
  };

  const admit = (x: number, z: number, rank: number): void => {
    if (!plantable(x, z)) return;
    placements.push({
      x,
      y: heightAt(x, z),
      z,
      yaw: random() * Math.PI * 2,
      // Taller at the back, so the belt builds upward away from the viewer and
      // the front rank never hides the depth behind it.
      height:
        WOODLAND.height.min +
        (WOODLAND.height.max - WOODLAND.height.min) * rank * (0.55 + random() * 0.75),
    });
  };

  const belt = WOODLAND.count;
  for (let tries = 0; placements.length < belt && tries < belt * 10; tries += 1) {
    const angle = random() * Math.PI * 2;
    const span = WOODLAND.far - WOODLAND.near;

    // Ranks rather than a uniform annulus: real woodland edges are ragged in
    // depth, and a uniform ring reads as a fence at a fixed radius.
    const rank = Math.floor(random() * WOODLAND.ranks);
    const radius = WOODLAND.near + (span * (rank + random() * 1.4)) / WOODLAND.ranks;

    const x = Math.sin(angle) * radius;
    const z = Math.cos(angle) * radius * 0.92;

    // The approach corridor is held open well past the belt. Only the wedge the
    // camera occupies, though — pushing the whole near side back strips the far
    // bank of the river, which is the treeline two separate scenes look at.
    if (Math.abs(x) < WOODLAND.corridor.halfWidth && z > 0 && radius < WOODLAND.corridor.clear) continue;

    admit(x, z, rank / WOODLAND.ranks);
  }

  const { bank } = WOODLAND;
  for (let tries = 0; tries < bank.count * 10 && placements.length < belt + bank.count; tries += 1) {
    const x = bank.x[0] + random() * (bank.x[1] - bank.x[0]);
    const z = bank.z[0] + random() * (bank.z[1] - bank.z[0]);
    admit(x, z, (z - bank.z[0]) / (bank.z[1] - bank.z[0]));
  }

  return placements;
}

/**
 * Whether a tree can stand here.
 *
 * Three refusals, and all three are the plan answering rather than a list of
 * boxes to avoid. Nothing grows below the water line. Nothing stands in the
 * park, because the core is where the paving and the building are. And nothing
 * stands in the wedge the review row's camera looks through, because a tree
 * there is not a small defect — it is planted in front of an option the
 * audience is being asked to choose between.
 */
function plantable(x: number, z: number): boolean {
  if (heightAt(x, z) < LAND.lake.surface + 0.35) return false;

  // Off the paving, and off it by enough that a canopy does not overhang the
  // route. Asked of the path network rather than of a bounding rectangle: the
  // promenade runs 250 m and the avenue bends, and a box big enough to contain
  // both would exclude most of the site.
  if (offPromenade(x, z) < 9 || offAvenue(x, z) < 9) return false;

  // Nothing stands in the playground, which is levelled ground with a fence
  // round it and the one place on site where a tree would be actively wrong.
  if (pitch(x, z) > 0.01) return false;

  const { core } = LAND;
  if (Math.abs(x) < core.halfWidth + 10 && z > core.far - 10 && z < core.near + 10) return false;

  const { clear } = WOODLAND;
  return !(x > clear.x[0] && x < clear.x[1] && z > clear.z[0] && z < clear.z[1]);
}

/**
 * A unit-height cross of quads, origin at the base so height is a scale factor.
 */
function card(impostor: Impostor): BufferGeometry {
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

/**
 * A slow lean, so the belt is not the one dead thing in a moving landscape.
 *
 * Much simpler than the planting's wind and deliberately so: at 96 m the only
 * perceptible component is the top of the canopy drifting, and the flutter and
 * gust structure that matter at 20 m are invisible here and not worth the
 * fragment cost across eight hundred cards.
 */
function sway(material: MeshBasicMaterial, time: { value: number }): void {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = time;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         float lean = position.y * position.y;
         float phase = uTime * 0.42 + instanceMatrix[3][0] * 0.06 + instanceMatrix[3][2] * 0.04;
         transformed.x += sin(phase) * lean * 0.035;
         transformed.z += cos(phase * 0.83) * lean * 0.026;`,
      );
  };
}
