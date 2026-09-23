import {
  BufferGeometry,
  DoubleSide,
  Group,
  Matrix4,
  MeshBasicMaterial,
  Quaternion,
  Vector3,
  type InstancedMesh,
  type Object3D,
  type WebGLRenderer,
} from 'three';
import type { CanopyField } from './canopy';
import { chunkInstances, type Chunked } from './chunking';
import { impostorCard, renderImpostors } from './impostors';
import {
  HILL_PLOTS,
  hillShare,
  inReviewShot,
  offAvenue,
  offPavilion,
  offPromenade,
  offRiverside,
  outcropAt,
  pitch,
  smoothstep,
} from './paths';
import { LAND, WOODLAND } from './site';
import { surfaceAt } from './terrain';

export interface Woodland {
  readonly object: Group;
  update(dt: number): void;
  dispose(): void;
}

export interface WoodlandInputs {
  /** Trees register here so the ground under them darkens. */
  readonly canopy: CanopyField;
}

/** Conifer crown radius as a fraction of height. Used for ground shading only. */
const CROWN = 0.26;

/**
 * The woodland ring that closes off the site, so nothing beyond it needs to
 * exist. Eight rows deep with varied heights so it reads as a forest.
 *
 * Trees are fixed cross-shaped cards, which do not shear when the camera moves
 * like camera-facing billboards do.
 */
export function createWoodland(
  renderer: WebGLRenderer,
  source: Object3D,
  { canopy }: WoodlandInputs,
): Woodland {
  const impostors = renderImpostors(renderer, source);
  const object = new Group();
  object.name = 'woodland';

  if (impostors.length === 0) {
    console.warn('[exterior] no tree templates found; woodland belt is empty.');
    return { object, update() {}, dispose() {} };
  }

  const time = { value: 0 };
  const placements = scatter();

  // Register each tree so the ground under the woodland looks like forest floor.
  for (const placement of placements) {
    canopy.add(placement.x, placement.z, placement.height * CROWN);
  }
  const meshes: InstancedMesh[] = [];
  const materials: MeshBasicMaterial[] = [];
  const geometries: BufferGeometry[] = [];
  const chunks: Chunked[] = [];

  impostors.forEach((impostor, species) => {
    const mine = placements.filter((_, index) => index % impostors.length === species);
    if (mine.length === 0) return;

    const geometry = impostorCard(impostor);
    const material = new MeshBasicMaterial({
      map: impostor.texture,
      transparent: false,
      // Alpha test so no sorting is needed and depth is written.
      alphaTest: 0.45,
      side: DoubleSide,
      fog: true,
    });

    sway(material, time);

    const quaternion = new Quaternion();
    const axis = new Vector3(0, 1, 0);
    const scale = new Vector3();
    const position = new Vector3();

    const matrices = mine.map((placement) => {
      quaternion.setFromAxisAngle(axis, placement.yaw);
      scale.setScalar(placement.height);
      position.set(placement.x, placement.y, placement.z);
      return new Matrix4().compose(position, quaternion, scale);
    });

    // Split into cells so the part behind the camera is culled. The main cost
    // here is overdraw.
    const chunked = chunkInstances({ geometry, material, matrices }, 'woodland');
    chunks.push(chunked);

    for (const mesh of chunked.meshes) {
      // Too far away for shadows to matter.
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      object.add(mesh);
      meshes.push(mesh);
    }

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
      for (const chunk of chunks) chunk.dispose();
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

/** Tree positions. Seeded so the woodland is the same on every run. */
function scatter(): Placement[] {
  const placements: Placement[] = [];
  let seed = 0x2f6a35;

  const random = (): number => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0x100000000;
  };

  const admit = (
    x: number,
    z: number,
    rank: number,
    range: { min: number; max: number } = WOODLAND.height,
  ): boolean => {
    if (!plantable(x, z)) return false;
    // No trees on bare rock. Random rejection so the treeline thins out gradually.
    if (random() < outcropAt(x, z)) return false;

    placements.push({
      x,
      y: surfaceAt(x, z),
      z,
      yaw: random() * Math.PI * 2,
      // Taller toward the back, so the front rows do not hide the depth.
      height: range.min + (range.max - range.min) * rank * (0.55 + random() * 0.75),
    });
    return true;
  };

  const belt = WOODLAND.count;
  for (let tries = 0; placements.length < belt && tries < belt * 10; tries += 1) {
    const angle = random() * Math.PI * 2;
    const span = WOODLAND.far - WOODLAND.near;

    // Placed in rows with jitter, so the edge is ragged.
    const rank = Math.floor(random() * WOODLAND.ranks);
    const radius = WOODLAND.near + (span * (rank + random() * 1.4)) / WOODLAND.ranks;

    const x = Math.sin(angle) * radius;
    const z = Math.cos(angle) * radius * 0.92;

    // Keep the camera's approach corridor clear.
    if (Math.abs(x) < WOODLAND.corridor.halfWidth && z > 0 && radius < WOODLAND.corridor.clear) continue;

    admit(x, z, rank / WOODLAND.ranks);
  }

  const { bank } = WOODLAND;
  for (let tries = 0; tries < bank.count * 10 && placements.length < belt + bank.count; tries += 1) {
    const x = bank.x[0] + random() * (bank.x[1] - bank.x[0]);
    const z = bank.z[0] + random() * (bank.z[1] - bank.z[0]);
    admit(x, z, (z - bank.z[0]) / (bank.z[1] - bank.z[0]));
  }

  scatterHills(random, admit);
  return placements;
}

type Admit = (
  x: number,
  z: number,
  rank: number,
  range?: { min: number; max: number },
) => boolean;

/**
 * Trees on the hills: grass at the foot, trees on the slopes, bare rock at the
 * top (handled by `admit`). Kept sparse so the hill shape stays visible. The
 * tree count per hill comes from its area.
 */
function scatterHills(random: () => number, admit: Admit): void {
  for (const plot of HILL_PLOTS) {
    const [cx, cz] = plot.centre;
    const target = Math.round((plot.area / 10000) * WOODLAND.hills.perHectare);

    let grown = 0;
    for (let tries = 0; grown < target && tries < target * 24; tries += 1) {
      const x = cx + (random() * 2 - 1) * plot.reach;
      const z = cz + (random() * 2 - 1) * plot.reach;

      const rise = hillShare(x, z);
      if (rise <= 0.06 || random() > smoothstep(0.06, 0.32, rise)) continue;
      if (admit(x, z, 0.3 + random() * 0.6, WOODLAND.hills.height)) grown += 1;
    }
  }
}

/**
 * Whether a woodland tree can go here: above the water, clear of paths, the
 * pavilion, the playground and the building core, and out of the review shot.
 */
function plantable(x: number, z: number): boolean {
  if (surfaceAt(x, z) < LAND.lake.surface + 0.35) return false;

  // Far enough from paths that canopies do not overhang them.
  if (offPromenade(x, z) < 9 || offAvenue(x, z) < 9 || offRiverside(x, z) < 7) return false;
  if (offPavilion(x, z) < 4) return false;

  if (pitch(x, z) > 0.01) return false;

  const { core } = LAND;
  if (Math.abs(x) < core.halfWidth + 10 && z > core.far - 10 && z < core.near + 10) return false;

  return !inReviewShot(x, z);
}

/** A slow sway. Simpler than the near planting's wind, since detail is invisible this far out. */
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
