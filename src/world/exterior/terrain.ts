import {
  BufferAttribute,
  Color,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  RepeatWrapping,
  SRGBColorSpace,
  type Texture,
} from 'three';
import {
  avenueAt,
  bankAt,
  gradeAt,
  lakeDepth,
  lakeReach,
  offAvenue,
  riverAcross,
  riverDepth,
  riverReach,
  riverSurface,
  smoothstep,
  waterLevel,
  wave,
} from './paths';
import { LAND } from './site';

export interface Terrain {
  readonly object: Mesh;
  dispose(): void;
}

export interface TerrainTextures {
  readonly grass: Texture;
  readonly soil: Texture;
}

/**
 * Quad size in metres.
 *
 * Set by the tightest form the ground has to carry, which is the river swale —
 * roughly 33 m from bank top to bank top, so 13 quads across it. The channel
 * bottom itself is deliberately under-resolved: the water ribbon sits over it
 * and boulders and reeds line it, so nothing ever sees the terrain down there.
 */
const QUAD = 2.5;

/** How many metres of ground one tile of each texture covers. */
const TILE = { grass: 2.4, soil: 3.1 } as const;

/**
 * The ground palette.
 *
 * Five values rather than two. One green across 225 m reads as a carpet, and
 * the previous lawn-to-meadow lerp was still a single hue moving along a single
 * axis — the ground got darker with distance and did nothing else, which is not
 * variation, it is a gradient.
 *
 * These are chosen as the tones a north-European park actually holds in summer:
 * mown amenity grass, unmown rough, sun-parched patches on the high ground, and
 * the deep wet green that only ever appears where the water table is close.
 */
const LAWN = new Color('#9cb45f');
const MEADOW = new Color('#869b4c');
const PARCHED = new Color('#b3ac68');
const BANKSIDE = new Color('#5c7a3c');
const SILT = new Color('#7d7358');

/**
 * The ground, with landform.
 *
 * It was a perfectly flat 900 m plane, and a flat plane is a stage: there is no
 * distance in it, nothing occludes anything else, and the eye runs straight out
 * to wherever the world stops. Every plant added to it was a prop standing on a
 * table.
 *
 * The landform does three jobs that planting cannot. It **closes the sightline**
 * — the far ridge rises above eye level so there is no "past the site" to look
 * at. It gives the woodland **somewhere to stand** where the canopy mass sits
 * higher than the camera rather than fringing the horizon. And it puts ground
 * at different distances in the same frame, which is what the eye reads as
 * depth.
 *
 * Height is a pure function of position so the water, the paving, the planting
 * and the furniture can ask it where the ground is rather than each carrying
 * their own copy of the plan.
 */
export function createTerrain({ grass, soil }: TerrainTextures): Terrain {
  const segments = Math.round(LAND.size / QUAD);
  const geometry = new PlaneGeometry(LAND.size, LAND.size, segments, segments);
  geometry.rotateX(-Math.PI / 2);

  const position = geometry.getAttribute('position');
  const blend = new Float32Array(position.count);
  const tint = new Float32Array(position.count * 3);
  const color = new Color();

  for (let index = 0; index < position.count; index += 1) {
    const x = position.getX(index);
    const z = position.getZ(index);
    const y = heightAt(x, z);
    position.setY(index, y);

    blend[index] = bareness(x, z, y);
    ground(color, x, z, y);

    tint[index * 3] = color.r;
    tint[index * 3 + 1] = color.g;
    tint[index * 3 + 2] = color.b;
  }

  geometry.setAttribute('aSoil', new BufferAttribute(blend, 1));
  geometry.setAttribute('color', new BufferAttribute(tint, 3));
  geometry.computeVertexNormals();

  const base = tiled(grass, TILE.grass);
  const bare = tiled(soil, TILE.soil);

  const material = new MeshStandardMaterial({
    map: base,
    vertexColors: true,
    roughness: 0.97,
    metalness: 0,
  });

  // Two ground materials rather than one, mixed per vertex. A second texture at
  // a different tile size also breaks the repeat of the first, which is the
  // problem the old two-layer plane existed to solve — for one draw call
  // instead of two and without a transparent surface hovering over the ground.
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uSoil = { value: bare };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aSoil;\nvarying float vSoil;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSoil = aSoil;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D uSoil;\nvarying float vSoil;')
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
         vec4 soilColor = texture2D(uSoil, vMapUv * ${(TILE.grass / TILE.soil).toFixed(4)});
         diffuseColor.rgb = mix(diffuseColor.rgb, soilColor.rgb, vSoil);`,
      );
  };

  const object = new Mesh(geometry, material);
  object.receiveShadow = true;

  return {
    object,
    dispose() {
      geometry.dispose();
      material.dispose();
      base.dispose();
      bare.dispose();
    },
  };
}

/**
 * Where the ground is, at any point on the site.
 *
 * Composed rather than sampled from a heightmap, because every feature here is
 * a designed one — the flat the building stands on, the swale, the ridge that
 * closes the view — and a painted heightmap would put all three beyond reach of
 * the constants that describe them.
 *
 * Order matters at the joins. Relief is laid down first, the stream is cut into
 * whatever grade it finds, and the lake is cut last — so where the two meet,
 * the basin wins and the channel reads as issuing from it rather than as a
 * trench running through it.
 */
export function heightAt(x: number, z: number): number {
  const { lake, river } = LAND;

  // Rolling park, knowing nothing about the water.
  let height = gradeAt(x, z);

  // The stream's floodplain. **This is the step that was missing**, and its
  // absence is why the channel read as a stripe painted on the lawn: the old
  // version blended straight from free relief to the river bed, so wherever the
  // relief happened to be near bed level there was no bank to see and the water
  // surface came out above the ground either side of it.
  //
  // Easing the ground to a bank top a fixed freeboard above the water makes the
  // valley a property of the construction rather than a coincidence of the
  // noise. It works in both directions, which matters: a third of the corridor
  // needed *raising* out of the water, not cutting into.
  const bankTop = river.halfWidth + river.swale;
  const plain = (1 - smoothstep(0, river.plain, riverAcross(x, z) - bankTop)) * riverReach(x);
  height += (bankAt(x) - height) * plain;

  // The lake's shore, on the same principle and for the same failure: a basin
  // cut to an absolute level into ground free to roll below it had a third of
  // its shoreline under its own water.
  const beach = 1 - smoothstep(0, lake.apron, lakeReach(x, z));
  height += (lake.surface + lake.shore - height) * beach;

  const channel = riverDepth(x, z);
  height = height * (1 - channel) + (riverSurface(x) - river.depth) * channel;

  const basin = lakeDepth(x, z);
  return height * (1 - basin) + -lake.depth * basin;
}

/**
 * How much bare ground shows through the grass.
 *
 * Three causes, all of which fall out of the plan rather than needing to be
 * painted: the wet margin where a bank meets water, slopes too steep to hold
 * turf, and the worn ground either side of a path where people cut the corner.
 */
function bareness(x: number, z: number, y: number): number {
  // Held to the bottom of the bank. At 2.2 m this reached the whole swale once
  // the valley was cut, and turned both banks of the stream into open soil for
  // their full height — the opposite of the reference, where bare ground is a
  // silt line at the waterline and everything above it is tussock.
  const shore = 1 - smoothstep(0.25, 1.1, Math.abs(y - waterLevel(x, z)));
  const steep = slopeAt(x, z) * 2.2;

  const off = offAvenue(x, z);
  const worn = Number.isFinite(off) ? (1 - smoothstep(0.4, 4.5, off)) * 0.55 : 0;

  const patchy = Math.max(0, wave(x / 17 + 4.2, z / 17 - 9.6)) * 0.5;

  return Math.min(1, Math.max(shore, steep, worn, patchy * steep * 3));
}

/**
 * The ground's own colour, before any texture.
 *
 * Built by asking what is true at the point rather than by blending toward a
 * distance. Mowing follows the building, roughness follows everything else,
 * parching follows the high dry ground, and the wet green follows the water —
 * so the variation is *caused* and lands where a groundsman would have put it.
 *
 * The last term is the one that actually kills the carpet read: a slow,
 * incoherent value drift at a wavelength longer than anything else here. Real
 * grass is never one value across a hundred metres, and no amount of hue
 * variation reads as natural while the lightness is constant.
 */
function ground(target: Color, x: number, z: number, y: number): void {
  const wild = smoothstep(34, 120, Math.hypot(x, z - 20));
  target.copy(LAWN).lerp(MEADOW, wild);

  // Parched high ground, in drifts rather than in bands.
  const dryness = Math.max(0, wave(x / 62 - 17.3, z / 62 + 6.8)) * smoothstep(0.4, 4.5, y);
  target.lerp(PARCHED, Math.min(0.75, dryness) * wild);

  // Lush where the water table is close, and silty right at the margin. Held
  // well back from full strength: at 0.85 the whole river corridor went to one
  // dark value and read as a shadow lying across the park rather than as a
  // wetter, greener strip of it.
  const wet = Math.max(riverDepth(x, z), lakeDepth(x, z));
  target.lerp(BANKSIDE, smoothstep(0.4, 0.92, wet) * 0.55);
  target.lerp(SILT, (1 - smoothstep(0.0, 1.4, Math.abs(y - waterLevel(x, z)))) * 0.5);

  const drift = 1 + wave(x / 96 + 51.4, z / 96 - 23.9) * 0.17 + wave(x / 29 - 3.3, z / 29 + 11.2) * 0.07;
  target.multiplyScalar(drift);
}

/** Ground steepness, 0 flat to roughly 1 at 45 degrees. */
function slopeAt(x: number, z: number): number {
  const step = QUAD;
  const dx = heightAt(x + step, z) - heightAt(x - step, z);
  const dz = heightAt(x, z + step) - heightAt(x, z - step);
  return Math.hypot(dx, dz) / (2 * step);
}

/** Where the avenue's centre is. Re-exported so callers need one import, not two. */
export { avenueAt };

function tiled(source: Texture, metres: number): Texture {
  const texture = source.clone();
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.colorSpace = SRGBColorSpace;
  texture.repeat.set(LAND.size / metres, LAND.size / metres);
  texture.needsUpdate = true;
  return texture;
}

