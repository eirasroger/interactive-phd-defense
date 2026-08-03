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

/**
 * Which way the wind crosses the site, and how fast a gust front travels.
 *
 * A single direction for the whole park: real wind is coherent over far more
 * than a hundred metres, and plants leaning independently is the thing that
 * reads as "each of these is animated" rather than as weather.
 */
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
 * Three bands, deliberately not one.
 *
 * Amplitude is expressed as a fraction of each plant's height rather than in
 * metres, so it stays correct across a 0.3 m grass tuft and a 10 m pine
 * without either being tuned separately — the same reasoning as
 * `learnings.md` §7f, where a size in metres replaced a multiplier that
 * silently carried an assumption about the asset.
 *
 * The speeds matter as much as the amplitudes. Grass ripples visibly faster
 * than a canopy rolls, and driving every layer at one rate is the tell that
 * separates procedural foliage from filmed foliage — the eye reads the shared
 * frequency long before it can name it.
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

  // Subtracting distance downwind makes a gust travel across the site instead
  // of every plant pulsing on the same clock. This is most of what sells it:
  // a front crossing a meadow is instantly recognisable, and a field breathing
  // in unison is instantly not.
  float windPhase = uWindTime * uWindSpeed - dot(windAt.xz, uWindDirection) * ${WAVE.toFixed(4)};
  float windSeed = dot(windAt.xz, vec2(0.137, 0.219));

  // Two incommensurable frequencies, so the loop never lands on itself.
  float windSway = sin(windPhase + windSeed) * 0.72
                 + sin(windPhase * 1.71 + windSeed * 2.3) * 0.28;
  float windGust = 0.62 + 0.38 * sin(windPhase * 0.21 + windSeed * 0.11);

  // aWind.y is height squared over plant height — the lever arm of a stem
  // anchored at the base. It carries the stiffness curve and the plant's scale
  // together, which is what lets one dimensionless uniform drive every bucket
  // of a species whose primitives have wildly different bounding boxes.
  float windThrow = windSway * windGust * uWindSway * aWind.y;

  // The wind blows one way across the park, so its direction is taken into
  // each instance's own frame. Skip this and every yaw-rotated plant leans a
  // different way — the field looks stirred rather than blown.
  transformed.xz += vec2(dot(uWindDirection, windAxisX), dot(uWindDirection, windAxisZ)) * windThrow;
  // Bending shortens a stem. Without it the canopy stretches off the trunk at
  // the extremes of the sway, which on a tree is the whole illusion gone.
  transformed.y -= abs(windThrow) * aWind.x * 0.28;

  // Sway alone swings the canopy as one mass, which is a tree bending in wind
  // but is not leaves moving in it — and leaves are what the eye actually reads
  // at this distance. Flutter runs an order of magnitude faster, is seeded per
  // vertex so neighbouring cards are never in step, and pushes along the normal
  // so each leaf turns rather than slides.
  float windFlutter = sin(uWindTime * uWindSpeed * 5.3 + dot(position, vec3(3.1, 2.3, 4.7)));
  transformed += normal * windFlutter * windGust * uWindFlutter * aWind.y;
`;

/**
 * Moves the planting, which is most of what separates a live site from a dead one.
 *
 * Nothing on this site moved. A static plant reads as scenery however good it
 * is, and thirteen hundred static plants read as thirteen hundred props — the
 * density was never going to fix that on its own, because stillness is not a
 * quantity problem.
 *
 * The sway is a vertex-shader displacement on geometry that is already on the
 * GPU, so the whole park costs one uniform update per frame and no CPU work at
 * all. It is applied through `onBeforeCompile` rather than a custom material so
 * the foliage keeps standard lighting, shadows and fog.
 *
 * **The shadow pass is patched to match.** Foliage casts shadows here, and a
 * swaying canopy over a shadow that holds still is worse than no motion at
 * all — the eye catches the disagreement immediately even at distance.
 */
export function applyWind(meshes: readonly InstancedMesh[]): Wind {
  const time = { value: 0 };
  const direction = { value: DIRECTION };
  const bands = new Map<Material, Band>();
  const patched = new Set<Material>();
  const depths: MeshDepthMaterial[] = [];

  // Band first, across every bucket, because a material is shared between
  // buckets and the band has to be one answer per material rather than
  // whichever bucket happened to be visited last.
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

    // Shadows are cast from a depth material three.js builds itself, which
    // knows nothing about the displacement above. Foliage is alpha-cut, so the
    // map and its threshold have to come across as well or every canopy casts
    // the shadow of a solid quad.
    const depth = new MeshDepthMaterial({
      depthPacking: RGBADepthPacking,
      map: material.map,
      alphaTest: material.alphaTest,
    });
    patch(depth, band, time, direction);
    mesh.customDepthMaterial = depth;
    depths.push(depth);
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

  // Two materials patched for different bands must not share a compiled
  // program, or whichever compiled first silently supplies the other's speed.
  material.customProgramCacheKey = () => `wind:${band.name}`;
  material.needsUpdate = true;
}

/**
 * Bakes the stiffness curve into the geometry, once.
 *
 * `x` is height up the plant, 0 to 1. `y` is that height squared over the
 * plant's height — the lever arm, which is what the displacement scales by.
 *
 * Both are written against the height of the *plant*, taken from
 * `instancing.ts`, never the primitive's own bounding box. A tree exports as
 * bark, twig, dead branches and trunk, and normalising each against itself
 * would give the twig mesh full throw at the height where the bark mesh has
 * none. The canopy would shear off the trunk on every gust.
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

/** The plant's height in metres, which is local height times instance scale. */
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
