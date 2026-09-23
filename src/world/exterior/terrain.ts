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
import type { CanopyField } from './canopy';
import {
  avenueAt,
  bankAt,
  bankReach,
  channelBed,
  freeboardAt,
  gradeAt,
  hillShare,
  lakeDepth,
  lakeReach,
  offAvenue,
  outcropAt,
  riverAcross,
  riverDepth,
  riverReach,
  smoothstep,
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
  readonly riverbed: Texture;
}

export interface TerrainInputs extends TerrainTextures {
  /** Tree canopy coverage, used to darken the ground under trees. */
  readonly canopy: CanopyField;
}

/**
 * Terrain quad size in metres, fine enough for the river valley (about 13
 * quads across). The bank colour bands are computed per pixel, so they stay
 * sharp at any mesh size.
 */
const QUAD = 2.5;

/** Metres of ground covered by one texture tile. */
const TILE = { grass: 2.4, soil: 3.1, riverbed: 1.3 } as const;

/**
 * A second, larger tiling of the same grass image. Mixing two unrelated scales
 * hides the repeat pattern. Applied relative to the image's mean colour so the
 * overall brightness stays the same.
 */
const MACRO = { metres: 17.3, depth: 0.55 } as const;

/**
 * Distance range in metres over which textures fade to their average colour.
 * Far away the tiles get too small and cause moire.
 */
const DETAIL = { near: 50, far: 210 } as const;

/** Grass colours stored per vertex: mown lawn, rough meadow, dry patches on high ground. */
const LAWN = new Color('#9cb45f');
const MEADOW = new Color('#869b4c');
const PARCHED = new Color('#b3ac68');

/**
 * River bank colours, applied per pixel by height above water: stone, a pale
 * silt line, dark wet grass, then normal grass. About three metres in total.
 */
const BANKSIDE = new Color('#5c7a3c');
const SILT = new Color('#9c9174');

/** Colour of the river bed in deeper water. */
const DEEP = new Color('#2c3733');

/**
 * Tint for exposed rock on the hills. The rock mixes the riverbed and soil
 * textures, whose different tile sizes hide repetition (§19).
 */
const BEDROCK = new Color('#918f88');

/**
 * Leaf litter colour under trees. Close to the grass colour, so the ground
 * mostly darkens. The slight hue shift keeps it from looking like cloud shadow.
 */
const DUFF = new Color('#69713f');

/** How far the grass shifts toward leaf litter under dense canopy. */
const SHADE = 0.7;

/**
 * The ground mesh. Height comes from `heightAt`, so water, paving and planting
 * all agree on it. Planting must be built first so the ground can darken under
 * the trees.
 */
export function createTerrain({ grass, soil, riverbed, canopy }: TerrainInputs): Terrain {
  const segments = Math.round(LAND.size / QUAD);
  const geometry = new PlaneGeometry(LAND.size, LAND.size, segments, segments);
  geometry.rotateX(-Math.PI / 2);

  const position = geometry.getAttribute('position');
  const bare = new Float32Array(position.count);
  const water = new Float32Array(position.count);
  const shade = new Float32Array(position.count);
  const rock = new Float32Array(position.count);
  const tint = new Float32Array(position.count * 3);
  const color = new Color();

  for (let index = 0; index < position.count; index += 1) {
    const x = position.getX(index);
    const z = position.getZ(index);
    const y = heightAt(x, z);
    position.setY(index, y);

    bare[index] = worn(x, z);
    water[index] = freeboardAt(x, z, y);
    shade[index] = canopy.sample(x, z);
    rock[index] = outcropAt(x, z);
    turf(color, x, z, y);

    tint[index * 3] = color.r;
    tint[index * 3 + 1] = color.g;
    tint[index * 3 + 2] = color.b;
  }

  geometry.setAttribute('aSoil', new BufferAttribute(bare, 1));
  geometry.setAttribute('aWater', new BufferAttribute(water, 1));
  geometry.setAttribute('aShade', new BufferAttribute(shade, 1));
  geometry.setAttribute('aRock', new BufferAttribute(rock, 1));
  geometry.setAttribute('aTint', new BufferAttribute(tint, 3));
  geometry.computeVertexNormals();

  const base = tiled(grass, TILE.grass);
  const dirt = tiled(soil, TILE.soil);
  const stones = tiled(riverbed, TILE.riverbed);

  // Average colour of each texture, for the macro layer and the distance fade.
  const grassMean = meanOf(base);
  const soilMean = meanOf(dirt);
  const bedMean = meanOf(stones);

  const material = new MeshStandardMaterial({
    map: base,
    roughness: 0.97,
    metalness: 0,
  });

  // Mixes grass, soil and riverbed per pixel. `aSoil` holds slow-varying bare
  // ground (slope, wear, patches). Water-related bands are computed here from
  // `aWater` (height above water), since they are too narrow for the mesh.
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uSoil = { value: dirt };
    shader.uniforms.uRiverbed = { value: stones };

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
         attribute float aSoil;
         attribute float aWater;
         attribute float aShade;
         attribute float aRock;
         attribute vec3 aTint;
         varying float vSoil;
         varying float vWater;
         varying float vShade;
         varying float vRock;
         varying vec3 vTint;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         vSoil = aSoil;
         vWater = aWater;
         vShade = aShade;
         vRock = aRock;
         vTint = aTint;`,
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
         uniform sampler2D uSoil;
         uniform sampler2D uRiverbed;
         varying float vSoil;
         varying float vWater;
         varying float vShade;
         varying float vRock;
         varying vec3 vTint;`,
      )
      .replace(
        '#include <map_fragment>',
        `vec3 turfTexel = texture2D( map, vMapUv ).rgb;
         vec3 soilTexel = texture2D( uSoil, vMapUv * ${(TILE.grass / TILE.soil).toFixed(4)} ).rgb;
         vec3 bedTexel = texture2D( uRiverbed, vMapUv * ${(TILE.grass / TILE.riverbed).toFixed(4)} ).rgb;

         // Large-scale variation. See MACRO.
         vec3 macro = texture2D( map, vMapUv * ${(TILE.grass / MACRO.metres).toFixed(4)} ).rgb;
         turfTexel *= mix( vec3( 1.0 ), macro / ${rgb(grassMean)}, ${MACRO.depth.toFixed(3)} );

         // Fade to the average colour with distance to avoid moire.
         float coarse = smoothstep( ${DETAIL.near.toFixed(1)}, ${DETAIL.far.toFixed(1)}, length( vViewPosition ) );
         turfTexel = mix( turfTexel, ${rgb(grassMean)}, coarse );
         soilTexel = mix( soilTexel, ${rgb(soilMean)}, coarse );
         bedTexel = mix( bedTexel, ${rgb(bedMean)}, coarse );

         // Bank bands going up from the water. Kept narrow so they read as a waterline.
         float stone = 1.0 - smoothstep( -0.30, 0.10, vWater );
         float silt = 1.0 - smoothstep( 0.02, 0.55, vWater );
         float damp = 1.0 - smoothstep( 0.25, 2.40, vWater );

         // Some bare ground under trees, so it reads as leaf litter and not a shadow.
         float duff = smoothstep( 0.2, 0.85, vShade );
         float bare = clamp( max( vSoil, max( silt * 0.8, duff * 0.5 ) ), 0.0, 1.0 );

         vec3 turf = vTint;
         turf = mix( turf, ${rgb(BANKSIDE)}, damp * 0.62 );
         turf = mix( turf, ${rgb(DUFF)}, vShade * ${SHADE.toFixed(3)} );

         vec3 grit = mix( turf, ${rgb(SILT)}, silt );

         // Darker in deeper water.
         vec3 bed = bedTexel * mix( vec3( 1.0 ), ${rgb(DEEP)} * 3.0, smoothstep( -0.05, -1.20, vWater ) );

         // Hill rock covers grass and soil, but water bands cover the rock.
         // Strong macro variation keeps it looking like rock at a distance,
         // where the detail textures have faded out.
         vec3 crag = mix( bedTexel, soilTexel, 0.14 ) * ${rgb(BEDROCK)};
         crag *= mix( vec3( 1.0 ), macro / ${rgb(grassMean)}, 1.25 );

         vec3 ground = mix( turfTexel * turf, soilTexel * grit, bare );
         ground = mix( ground, crag, vRock );
         ground = mix( ground, bed, stone );
         diffuseColor.rgb *= mix( ground, ground * ${rgb(DUFF)} * 2.4, vShade * 0.35 );`,
      );
  };

  const object = new Mesh(geometry, material);
  object.receiveShadow = true;

  console.info(
    `[terrain] ${position.count} vertices at ${QUAD} m, ${canopy.count} canopies in the shade field.`,
  );

  return {
    object,
    dispose() {
      geometry.dispose();
      material.dispose();
      base.dispose();
      dirt.dispose();
      stones.dispose();
    },
  };
}

/**
 * Ground height at any point. The step order matters: relief, river
 * floodplain, lake shore, lake basin, then the river channel last.
 */
export function heightAt(x: number, z: number): number {
  const { lake, river } = LAND;

  // Rolling ground, before water.
  let height = gradeAt(x, z);

  // Ease the ground toward the bank top near the river. This can raise or
  // lower it.
  const bankTop = bankReach(x);
  const plain = (1 - smoothstep(0, river.plain, riverAcross(x, z) - bankTop)) * riverReach(x);
  height += (bankAt(x) - height) * plain;

  // Same for the lake shore: flat out to `beach`, then eased over the apron.
  const beach = 1 - smoothstep(lake.beach, lake.apron, lakeReach(x, z));
  height += (lake.surface + lake.shore - height) * beach;

  // Bowl-shaped lake basin with wide, visible shallows.
  const basin = lakeDepth(x, z);
  if (basin > 0) {
    const under = -lakeReach(x, z);
    const bed =
      lake.surface -
      lake.depth * smoothstep(lake.shelf, lake.shelf + lake.slope, under) -
      lake.margin * smoothstep(0, lake.shelf, under);
    height = height * (1 - basin) + bed * basin;
  }

  // River channel. Takes the deeper of channel and basin, since blending them
  // leaves a bar across the outlet.
  const channel = riverDepth(x, z);
  return Math.min(height, height * (1 - channel) + channelBed(x) * channel);
}

/**
 * Height of the rendered mesh surface, which can differ from `heightAt`
 * between vertices. Interpolates over the same triangles `PlaneGeometry`
 * builds, so objects placed with this never float.
 */
export function surfaceAt(x: number, z: number): number {
  const half = LAND.size / 2;
  const gx = (x + half) / QUAD;
  const gz = (z + half) / QUAD;
  const ix = Math.floor(gx);
  const iz = Math.floor(gz);
  const fx = gx - ix;
  const fz = gz - iz;

  const x0 = ix * QUAD - half;
  const z0 = iz * QUAD - half;
  const x1 = x0 + QUAD;
  const z1 = z0 + QUAD;

  // The quad diagonal runs from (x0, z1) to (x1, z0), matching `PlaneGeometry`.
  if (fx + fz <= 1) {
    const corner = heightAt(x0, z0);
    return (
      corner + (heightAt(x1, z0) - corner) * fx + (heightAt(x0, z1) - corner) * fz
    );
  }
  const corner = heightAt(x1, z1);
  return (
    corner + (heightAt(x0, z1) - corner) * (1 - fx) + (heightAt(x1, z0) - corner) * (1 - fz)
  );
}

/** How far objects sink into the ground so there is never a visible gap. */
const BED = 0.05;

/**
 * Height to place an object with the given footprint radius. Uses the lowest
 * ground under the footprint so the downhill side never floats. A `spread` of
 * zero samples only the centre, for small objects.
 */
export function seatAt(x: number, z: number, spread = 0): number {
  const centre = surfaceAt(x, z);
  if (spread <= 0) return centre - BED;

  return (
    Math.min(
      centre,
      surfaceAt(x + spread, z),
      surfaceAt(x - spread, z),
      surfaceAt(x, z + spread),
      surfaceAt(x, z - spread),
    ) - BED
  );
}

/**
 * Bare ground from dry causes: steep slopes, wear beside the avenue, and
 * patches. Water-related bare ground is computed per pixel from `aWater`.
 */
function worn(x: number, z: number): number {
  // Skipped on the hills, which show rock instead of bare soil.
  const steep = slopeAt(x, z) * 2.2 * (1 - smoothstep(0.05, 0.35, hillShare(x, z)));

  const off = offAvenue(x, z);
  const scuffed = Number.isFinite(off) ? (1 - smoothstep(0.4, 4.5, off)) * 0.55 : 0;

  const patchy = Math.max(0, wave(x / 17 + 4.2, z / 17 - 9.6)) * 0.5;

  return Math.min(1, Math.max(steep, scuffed, patchy * steep * 3));
}

/**
 * Base grass colour before textures and water. Lawn near the building, meadow
 * further out, dry patches on high ground, and slow brightness variation so
 * the grass does not look like a carpet.
 */
function turf(target: Color, x: number, z: number, y: number): void {
  const wild = smoothstep(34, 120, Math.hypot(x, z - 20));
  target.copy(LAWN).lerp(MEADOW, wild);

  // Dry patches on high ground.
  const dryness = Math.max(0, wave(x / 62 - 17.3, z / 62 + 6.8)) * smoothstep(0.4, 4.5, y);
  target.lerp(PARCHED, Math.min(0.75, dryness) * wild);

  // Brightness variation. Each octave is rotated so the noise grids do not line up.
  let drift = 1;
  drift += turn(x, z, 96, 0.7, 51.4, -23.9) * 0.17;
  drift += turn(x, z, 29, 2.1, -3.3, 11.2) * 0.07;
  drift += turn(x, z, 11, 3.9, 17.6, 6.1) * 0.035;
  target.multiplyScalar(drift);
}

/** One octave of value noise on rotated axes. */
function turn(
  x: number,
  z: number,
  metres: number,
  angle: number,
  offsetX: number,
  offsetZ: number,
): number {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return wave((x * cos - z * sin) / metres + offsetX, (x * sin + z * cos) / metres + offsetZ);
}

/** Ground steepness, 0 flat to roughly 1 at 45 degrees. */
function slopeAt(x: number, z: number): number {
  const step = QUAD;
  const dx = heightAt(x + step, z) - heightAt(x - step, z);
  const dz = heightAt(x, z + step) - heightAt(x, z - step);
  return Math.hypot(dx, dz) / (2 * step);
}

/** Re-exported for convenience. */
export { avenueAt };

/** A colour as a GLSL vec3, in linear working space to match the vertex colours. */
function rgb(color: Color): string {
  return `vec3( ${color.r.toFixed(4)}, ${color.g.toFixed(4)}, ${color.b.toFixed(4)} )`;
}

/**
 * Average colour of a texture. Downscales to 8x8 and averages, since some
 * browsers point-sample when drawing straight to 1x1.
 */
function meanOf(texture: Texture): Color {
  const size = 8;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;

  const context = canvas.getContext('2d');
  if (!context) throw new Error('A 2D context is required to measure a ground texture.');

  context.drawImage(texture.image as CanvasImageSource, 0, 0, size, size);
  const { data } = context.getImageData(0, 0, size, size);

  let r = 0;
  let g = 0;
  let b = 0;
  for (let index = 0; index < data.length; index += 4) {
    r += data[index]!;
    g += data[index + 1]!;
    b += data[index + 2]!;
  }

  const samples = size * size * 255;
  return new Color().setRGB(r / samples, g / samples, b / samples, SRGBColorSpace);
}

function tiled(source: Texture, metres: number): Texture {
  const texture = source.clone();
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.colorSpace = SRGBColorSpace;
  texture.repeat.set(LAND.size / metres, LAND.size / metres);
  texture.needsUpdate = true;
  return texture;
}
