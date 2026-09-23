import {
  BufferAttribute,
  Matrix4,
  MeshDepthMaterial,
  RGBADepthPacking,
  Vector2,
  type InstancedMesh,
  type Material,
  type MeshStandardMaterial,
} from 'three';
import type { PlantMetrics } from './instancing';

export interface Wind {
  update(dt: number): void;
  dispose(): void;
}

/** Wind direction on the ground plane, shared by the whole park. */
const DIRECTION = new Vector2(0.82, 0.57).normalize();

/** Radians of gust phase per metre travelled downwind. */
const WAVE = 0.021;

interface Band {
  readonly name: string;
  /** Tip displacement as a fraction of the plant's own height. */
  readonly sway: number;
  /** Leaf rustle along the normal, as a fraction of the plant's own height. */
  readonly flutter: number;
  readonly speed: number;
  /** Ascending, so a material shared across bands resolves to the tallest. */
  readonly rank: number;
}

/**
 * Motion bands by plant size. Amplitudes are fractions of plant height, so one
 * value fits a 0.3 m tuft and a 10 m pine. Grass moves faster than canopy.
 */
const GROUND: Band = { name: 'ground', sway: 0.15, flutter: 0.03, speed: 1.9, rank: 0 };
const SHRUB: Band = { name: 'shrub', sway: 0.08, flutter: 0.022, speed: 1.15, rank: 1 };
const CANOPY: Band = { name: 'canopy', sway: 0.06, flutter: 0.014, speed: 0.6, rank: 2 };

/** Plant height in metres above which each band starts. */
const SHRUB_ABOVE = 1.2;
const CANOPY_ABOVE = 4.5;

const CHUNK = /* glsl */ `
  #ifdef USE_INSTANCING
    vec3 windAt = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
    vec2 windAxisX = normalize(vec2(instanceMatrix[0][0], instanceMatrix[0][2]));
    vec2 windAxisZ = normalize(vec2(instanceMatrix[2][0], instanceMatrix[2][2]));
  #else
    vec3 windAt = vec3(0.0);
    vec2 windAxisX = vec2(1.0, 0.0);
    vec2 windAxisZ = vec2(0.0, 1.0);
  #endif

  // Phase shifts with distance downwind, so gusts travel across the site.
  float windPhase = uWindTime * uWindSpeed - dot(windAt.xz, uWindDirection) * ${WAVE.toFixed(4)};
  float windSeed = dot(windAt.xz, vec2(0.137, 0.219));

  // Two incommensurable frequencies, so the motion never visibly repeats.
  float windSway = sin(windPhase + windSeed) * 0.72
                 + sin(windPhase * 1.71 + windSeed * 2.3) * 0.28;
  float windGust = 0.62 + 0.38 * sin(windPhase * 0.21 + windSeed * 0.11);

  // aWind.y is height squared over plant height (the lever arm). It holds both
  // stiffness and scale, so one uniform works for every primitive of a species.
  float windThrow = windSway * windGust * uWindSway * aWind.y;

  // Wind direction in the instance's own frame, so yaw-rotated plants all lean the same way.
  transformed.xz += vec2(dot(uWindDirection, windAxisX), dot(uWindDirection, windAxisZ)) * windThrow;
  // Bending shortens the stem, which keeps the canopy on the trunk.
  transformed.y -= abs(windThrow) * aWind.x * 0.28;

  // Leaf flutter: faster than sway, seeded per vertex, pushed along the normal.
  float windFlutter = sin(uWindTime * uWindSpeed * 5.3 + dot(position, vec3(3.1, 2.3, 4.7)));
  transformed += normal * windFlutter * windGust * uWindFlutter * aWind.y;
`;

/**
 * Animates foliage with a vertex-shader sway. Costs one uniform update per
 * frame. Patched through `onBeforeCompile` so standard lighting, shadows and
 * fog still apply. The shadow pass gets the same patch so shadows move too.
 */
export function applyWind(meshes: readonly InstancedMesh[]): Wind {
  const time = { value: 0 };
  const direction = { value: DIRECTION };
  const bands = new Map<Material, Band>();
  const patched = new Set<Material>();
  const shadows = new Map<Material, MeshDepthMaterial>();
  const depths: MeshDepthMaterial[] = [];

  // Materials are shared between buckets, so pick one band per material (the tallest) first.
  for (const mesh of meshes) {
    const band = bandFor(worldHeight(mesh));
    const existing = bands.get(mesh.material as Material);
    if (!existing || band.rank > existing.rank) {
      bands.set(mesh.material as Material, band);
    }
  }

  for (const mesh of meshes) {
    writeWindAttribute(mesh);

    const material = mesh.material as MeshStandardMaterial;
    const band = bands.get(material) ?? GROUND;

    if (!patched.has(material)) {
      patch(material, band, time, direction);
      patched.add(material);
    }

    // Custom depth material so shadows sway too. It copies the alpha map and
    // threshold so leaf cards cast cut-out shadows. One per source material,
    // since everything it depends on comes from the material.
    let depth = shadows.get(material);
    if (!depth) {
      depth = new MeshDepthMaterial({
        depthPacking: RGBADepthPacking,
        map: material.map,
        alphaTest: material.alphaTest,
      });
      patch(depth, band, time, direction);
      shadows.set(material, depth);
      depths.push(depth);
    }
    mesh.customDepthMaterial = depth;
  }

  return {
    update(dt: number) {
      time.value += dt;
    },
    dispose() {
      for (const depth of depths) depth.dispose();
    },
  };
}

function patch(
  material: Material,
  band: Band,
  time: { value: number },
  direction: { value: Vector2 },
): void {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uWindTime = time;
    shader.uniforms.uWindDirection = direction;
    shader.uniforms.uWindSway = { value: band.sway };
    shader.uniforms.uWindFlutter = { value: band.flutter };
    shader.uniforms.uWindSpeed = { value: band.speed };

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
         attribute vec2 aWind;
         uniform float uWindTime;
         uniform float uWindSway;
         uniform float uWindFlutter;
         uniform float uWindSpeed;
         uniform vec2 uWindDirection;`,
      )
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${CHUNK}`);
  };

  // Separate program per band, so bands never share compiled uniforms.
  material.customProgramCacheKey = () => `wind:${band.name}`;
  material.needsUpdate = true;
}

/**
 * Writes the `aWind` attribute once. `x` is height up the plant (0 to 1), `y`
 * is that squared times plant height (the lever arm). Both use the whole
 * plant's height from `instancing.ts` so all primitives of a tree bend together.
 */
function writeWindAttribute(mesh: InstancedMesh): void {
  const { geometry } = mesh;
  if (geometry.getAttribute('aWind')) return;

  const height = (mesh.userData as PlantMetrics).plantHeight || 1;
  const position = geometry.getAttribute('position');
  const wind = new Float32Array(position.count * 2);

  for (let index = 0; index < position.count; index += 1) {
    const normalised = Math.min(Math.max(position.getY(index) / height, 0), 1);
    wind[index * 2] = normalised;
    wind[index * 2 + 1] = normalised * normalised * height;
  }

  geometry.setAttribute('aWind', new BufferAttribute(wind, 2));
}

const SCRATCH = new Matrix4();

/** Plant height in metres: local height times instance scale. */
function worldHeight(mesh: InstancedMesh): number {
  if (mesh.count === 0) return 0;
  mesh.getMatrixAt(0, SCRATCH);
  return ((mesh.userData as PlantMetrics).plantHeight || 0) * SCRATCH.getMaxScaleOnAxis();
}

function bandFor(metres: number): Band {
  if (metres >= CANOPY_ABOVE) return CANOPY;
  if (metres >= SHRUB_ABOVE) return SHRUB;
  return GROUND;
}
