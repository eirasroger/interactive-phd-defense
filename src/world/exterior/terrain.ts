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
  lakeDepth,
  lakeReach,
  offAvenue,
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
  /** Where the planting stands, so the ground can know it is under something. */
  readonly canopy: CanopyField;
}

/**
 * Quad size in metres, set by the tightest form the ground carries — the river
 * swale, about 33 m bank to bank, so 13 quads across it.
 *
 * It does not limit the bankside bands: those live in the fragment shader, keyed
 * on interpolated *causes* rather than interpolated effects, so their sharpness
 * is independent of the mesh.
 */
const QUAD = 2.5;

/** How many metres of ground one tile of each texture covers. */
const TILE = { grass: 2.4, soil: 3.1, riverbed: 1.3 } as const;

/**
 * A second, much longer tile of the *same* grass image, in metres.
 *
 * One 2.4 m image repeated across 900 m has exactly one period in it, and a
 * single period reads as a lattice wherever it is resolvable and beats against
 * the pixel grid everywhere it is not. A second, incommensurable scale costs one
 * fetch and cannot line up with the first. Applied as a ratio against the
 * image's own mean, so it modulates the tile rather than replacing it and the
 * ground's level is unchanged.
 */
const MACRO = { metres: 17.3, depth: 0.55 } as const;

/**
 * Where tiled detail stops being detail, in metres from the camera. A 2.4 m tile
 * is about three pixels across at 150 m, and what a three-pixel period draws is
 * a moire of itself. Past `far` the texture gives way to its own average.
 */
const DETAIL = { near: 50, far: 210 } as const;

/**
 * The turf palette — the only thing the vertex colours carry. Mown amenity
 * grass, unmown rough, and sun-parched patches on the high ground.
 */
const LAWN = new Color('#9cb45f');
const MEADOW = new Color('#869b4c');
const PARCHED = new Color('#b3ac68');

/**
 * The bankside sequence, evaluated per pixel from the freeboard: stone, a pale
 * silt line, deep wet green where the water table is at root depth, then grass.
 * Four steps over about three metres.
 */
const BANKSIDE = new Color('#5c7a3c');
const SILT = new Color('#9c9174');

/** How dark the bed goes a metre or so under, where the light stops reaching. */
const DEEP = new Color('#2c3733');

/**
 * Leaf litter under a canopy. Close to the grass rather than a brown — the
 * ground should *thicken* under a tree, not wear a ring of mulch. Most of the
 * read is the darkening; the small shift off green is what stops it looking like
 * a cloud shadow.
 */
const DUFF = new Color('#69713f');

/** How far the turf shifts toward litter at the densest part of a canopy. */
const SHADE = 0.7;

/**
 * The ground, with landform.
 *
 * Height is a pure function of position so the water, paving, planting and
 * furniture can ask where the ground is rather than each carrying its own copy
 * of the plan.
 *
 * The **planting is built before this**, deliberately: the ground has to know
 * what is standing on it, and the only honest way to know is to ask the trees
 * that were actually placed rather than paint a second map beside them.
 */
export function createTerrain({ grass, soil, riverbed, canopy }: TerrainInputs): Terrain {
  const segments = Math.round(LAND.size / QUAD);
  const geometry = new PlaneGeometry(LAND.size, LAND.size, segments, segments);
  geometry.rotateX(-Math.PI / 2);

  const position = geometry.getAttribute('position');
  const bare = new Float32Array(position.count);
  const water = new Float32Array(position.count);
  const shade = new Float32Array(position.count);
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
    turf(color, x, z, y);

    tint[index * 3] = color.r;
    tint[index * 3 + 1] = color.g;
    tint[index * 3 + 2] = color.b;
  }

  geometry.setAttribute('aSoil', new BufferAttribute(bare, 1));
  geometry.setAttribute('aWater', new BufferAttribute(water, 1));
  geometry.setAttribute('aShade', new BufferAttribute(shade, 1));
  geometry.setAttribute('aTint', new BufferAttribute(tint, 3));
  geometry.computeVertexNormals();

  const base = tiled(grass, TILE.grass);
  const dirt = tiled(soil, TILE.soil);
  const stones = tiled(riverbed, TILE.riverbed);

  // Measured, not chosen: the macro layer modulates around each image's own
  // average so the level is unchanged, and the distance fade has to fade *to* it
  // or the far ground shifts value as the detail leaves.
  const grassMean = meanOf(base);
  const soilMean = meanOf(dirt);
  const bedMean = meanOf(stones);

  const material = new MeshStandardMaterial({
    map: base,
    roughness: 0.97,
    metalness: 0,
  });

  // Three ground materials mixed per pixel rather than one tinted per vertex.
  //
  // The mixing weights are the point. `aSoil` carries the dry causes of bare
  // ground — slope, wear, patchiness — which vary slowly and interpolate happily.
  // Everything the water governs is derived here from `aWater`, the height above
  // the surface, because the *cause* is near-linear across a bank while the
  // *effect* is a sequence of bands under a metre wide.
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
         attribute vec3 aTint;
         varying float vSoil;
         varying float vWater;
         varying float vShade;
         varying vec3 vTint;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         vSoil = aSoil;
         vWater = aWater;
         vShade = aShade;
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
         varying vec3 vTint;`,
      )
      .replace(
        '#include <map_fragment>',
        `vec3 turfTexel = texture2D( map, vMapUv ).rgb;
         vec3 soilTexel = texture2D( uSoil, vMapUv * ${(TILE.grass / TILE.soil).toFixed(4)} ).rgb;
         vec3 bedTexel = texture2D( uRiverbed, vMapUv * ${(TILE.grass / TILE.riverbed).toFixed(4)} ).rgb;

         // The macro layer — see MACRO.
         vec3 macro = texture2D( map, vMapUv * ${(TILE.grass / MACRO.metres).toFixed(4)} ).rgb;
         turfTexel *= mix( vec3( 1.0 ), macro / ${rgb(grassMean)}, ${MACRO.depth.toFixed(3)} );

         // Below the resolution of the pose there is no detail to carry, only
         // its beat against the pixel grid.
         float coarse = smoothstep( ${DETAIL.near.toFixed(1)}, ${DETAIL.far.toFixed(1)}, length( vViewPosition ) );
         turfTexel = mix( turfTexel, ${rgb(grassMean)}, coarse );
         soilTexel = mix( soilTexel, ${rgb(soilMean)}, coarse );
         bedTexel = mix( bedTexel, ${rgb(bedMean)}, coarse );

         // The section, working up from the water. Each band is narrow on
         // purpose: the reference shows a *line* of washed stone and silt at the
         // water's edge, a handspan of it. Widened to a metre it stops reading as
         // a waterline and starts reading as a beach.
         float stone = 1.0 - smoothstep( -0.30, 0.10, vWater );
         float silt = 1.0 - smoothstep( 0.02, 0.55, vWater );
         float damp = 1.0 - smoothstep( 0.25, 2.40, vWater );

         // Bare ground under a canopy separates *shade* from *shadow*: a darker
         // green reads as a cloud passing, a different surface reads as a tree
         // that has been standing there.
         float duff = smoothstep( 0.2, 0.85, vShade );
         float bare = clamp( max( vSoil, max( silt * 0.8, duff * 0.5 ) ), 0.0, 1.0 );

         vec3 turf = vTint;
         turf = mix( turf, ${rgb(BANKSIDE)}, damp * 0.62 );
         turf = mix( turf, ${rgb(DUFF)}, vShade * ${SHADE.toFixed(3)} );

         vec3 grit = mix( turf, ${rgb(SILT)}, silt );

         // Darkened by its own depth: the water gets its depth cue from what it
         // is over, not only from what it is.
         vec3 bed = bedTexel * mix( vec3( 1.0 ), ${rgb(DEEP)} * 3.0, smoothstep( -0.05, -1.20, vWater ) );

         vec3 ground = mix( turfTexel * turf, soilTexel * grit, bare );
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
 * Where the ground is, at any point on the site.
 *
 * Composed rather than sampled from a heightmap, so every feature stays within
 * reach of the constants that describe it.
 *
 * **The order of the steps is load-bearing**: relief, then the stream's
 * floodplain, then the lake's shore, then the basin, and the channel cut into
 * the basin last.
 */
export function heightAt(x: number, z: number): number {
  const { lake, river } = LAND;

  // Rolling park, knowing nothing about the water.
  let height = gradeAt(x, z);

  // The stream's floodplain, eased to a bank top a freeboard above the water so
  // the valley is a property of the construction rather than a coincidence of
  // the noise. It works in both directions — a third of the corridor needs
  // *raising* out of the water, not cutting into.
  const bankTop = bankReach(x);
  const plain = (1 - smoothstep(0, river.plain, riverAcross(x, z) - bankTop)) * riverReach(x);
  height += (bankAt(x) - height) * plain;

  // The lake's shore, on the same principle. Held at full lift out to `beach`
  // and only then eased away across the apron: the apron is a constraint on
  // where the ground may go, the beach is a statement about what it looks like,
  // and easing over the apron instead grades 0.75 m over 34 m.
  const beach = 1 - smoothstep(lake.beach, lake.apron, lakeReach(x, z));
  height += (lake.surface + lake.shore - height) * beach;

  // The basin, cut as a bowl rather than as a pan. The water is read *through*
  // where it is shallow, so the shallows have to be wide enough to be seen.
  const basin = lakeDepth(x, z);
  if (basin > 0) {
    const under = -lakeReach(x, z);
    const bed =
      lake.surface -
      lake.depth * smoothstep(lake.shelf, lake.shelf + lake.slope, under) -
      lake.margin * smoothstep(0, lake.shelf, under);
    height = height * (1 - basin) + bed * basin;
  }

  // The channel, taking the **deeper** of itself and the bowl rather than a
  // blend. The bowl is authored downward from the water surface and the channel
  // from its own bed, so just inside the shore the bowl is shallower than the
  // stream feeding it; averaging the two there is a bar across the mouth.
  const channel = riverDepth(x, z);
  return Math.min(height, height * (1 - channel) + channelBed(x) * channel);
}

/**
 * Where the ground is *drawn*, which is not quite where `heightAt` says it is.
 *
 * The mesh is a triangulated grid, so between two vertices the camera sees a
 * chord across the height function. Over a rise the chord runs below it and
 * anything seated on `heightAt` floats — about ten centimetres at the finest
 * relief octave, which the eye reads as a shadow gap at any distance.
 *
 * Evaluated on the same two triangles `PlaneGeometry` builds each quad from, so
 * floating stops being possible rather than being tuned against.
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

  // The quad's diagonal runs from (x0, z1) to (x1, z0) — the split
  // `PlaneGeometry` writes. Backwards it is invisible on gentle ground and wrong
  // by the full sagitta on a ridge.
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

/** How far into the ground a placement is pushed, so contact is never a gap. */
const BED = 0.05;

/**
 * Where to stand something of this footprint radius so no part of it floats.
 *
 * The **lowest** ground under the footprint, not the ground under the origin: on
 * a slope the skirt's downhill edge is what the eye checks, and seated on the
 * centre it hangs by the radius times the gradient — a third of a metre on the
 * river bank. Seating on the minimum buries the uphill side, which is what real
 * planting does anyway.
 *
 * `spread` of zero skips the sampling: ground cover is small enough that the
 * centre is the whole footprint, and there are thousands of them.
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
 * How much bare ground shows through the grass, for reasons that are not water.
 *
 * Three slow causes only — slopes too steep to hold turf, worn ground either
 * side of a path, and patchiness on the steep parts. The wet margin is a band
 * under a metre wide and cannot be represented on a 2.5 m grid, so it is derived
 * per pixel from `aWater` instead.
 */
function worn(x: number, z: number): number {
  const steep = slopeAt(x, z) * 2.2;

  const off = offAvenue(x, z);
  const scuffed = Number.isFinite(off) ? (1 - smoothstep(0.4, 4.5, off)) * 0.55 : 0;

  const patchy = Math.max(0, wave(x / 17 + 4.2, z / 17 - 9.6)) * 0.5;

  return Math.min(1, Math.max(steep, scuffed, patchy * steep * 3));
}

/**
 * The turf's own colour, before any texture and before any water.
 *
 * Built from what is true at the point rather than by blending toward a
 * distance: mowing follows the building, roughness everything else, parching the
 * high dry ground. The final drift term is what kills the carpet read — real
 * grass is never one *value* across a hundred metres, and hue variation alone
 * does not read as natural while the lightness is constant.
 */
function turf(target: Color, x: number, z: number, y: number): void {
  const wild = smoothstep(34, 120, Math.hypot(x, z - 20));
  target.copy(LAWN).lerp(MEADOW, wild);

  // Parched high ground, in drifts rather than in bands.
  const dryness = Math.max(0, wave(x / 62 - 17.3, z / 62 + 6.8)) * smoothstep(0.4, 4.5, y);
  target.lerp(PARCHED, Math.min(0.75, dryness) * wild);

  // A slow drift in value, each octave on its own rotated axes. `wave` is value
  // noise on an integer lattice, so octaves read straight off x and z put their
  // squares in register and draw a quilt at the coarsest wavelength.
  let drift = 1;
  drift += turn(x, z, 96, 0.7, 51.4, -23.9) * 0.17;
  drift += turn(x, z, 29, 2.1, -3.3, 11.2) * 0.07;
  drift += turn(x, z, 11, 3.9, 17.6, 6.1) * 0.035;
  target.multiplyScalar(drift);
}

/** One octave of value noise, on axes turned so its lattice never lines up. */
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

/** Where the avenue's centre is. Re-exported so callers need one import, not two. */
export { avenueAt };

/**
 * A palette entry as GLSL. `Color` holds working-space values, which is the
 * space the shader mixes in — writing the hex in directly would put the constant
 * through the sRGB curve and the matching vertex colour not.
 */
function rgb(color: Color): string {
  return `vec3( ${color.r.toFixed(4)}, ${color.g.toFixed(4)}, ${color.b.toFixed(4)} )`;
}

/**
 * The average colour of a ground texture, in the space the shader mixes in.
 *
 * Drawn to an 8 × 8 and averaged rather than straight to 1 × 1: the 2D canvas
 * picks its own downscaling filter, and reducing a 1024 to one pixel in one step
 * is a point sample on some browsers.
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
