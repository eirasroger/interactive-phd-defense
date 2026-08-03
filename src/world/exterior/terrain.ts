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
  freeboardAt,
  gradeAt,
  lakeDepth,
  lakeReach,
  offAvenue,
  riverAcross,
  riverDepth,
  riverReach,
  riverSurface,
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
 * Quad size in metres.
 *
 * Set by the tightest form the ground has to carry, which is the river swale —
 * roughly 33 m from bank top to bank top, so 13 quads across it. The channel
 * bottom itself is deliberately under-resolved: the water ribbon sits over it
 * and boulders and reeds line it, so nothing ever sees the terrain down there.
 *
 * Note what this does *not* set any more. Every transition that used to be a
 * per-vertex colour was band-limited to this — the silt line at the water is
 * under a metre wide and simply could not exist on a 2.5 m grid. Those now live
 * in the fragment shader, keyed on interpolated *causes* rather than
 * interpolated effects, so their sharpness is independent of the mesh.
 */
const QUAD = 2.5;

/** How many metres of ground one tile of each texture covers. */
const TILE = { grass: 2.4, soil: 3.1, riverbed: 1.3 } as const;

/**
 * The turf palette, which is now the only thing the vertex colours carry.
 *
 * One green across 225 m reads as a carpet, and a lawn-to-meadow lerp is still
 * a single hue moving along a single axis. These are the tones a north-European
 * park actually holds in summer: mown amenity grass, unmown rough, and
 * sun-parched patches on the high ground.
 */
const LAWN = new Color('#9cb45f');
const MEADOW = new Color('#869b4c');
const PARCHED = new Color('#b3ac68');

/**
 * The bankside sequence, evaluated per pixel from the freeboard.
 *
 * This is what a stream edge is made of, working up from the water: stone, a
 * pale silt line the water has washed and dropped, a band of deep wet green
 * where the water table is at root depth, and then ordinary grass. Four steps
 * over about three metres, which no per-vertex scheme on a 2.5 m grid can hold.
 */
const BANKSIDE = new Color('#5c7a3c');
const SILT = new Color('#9c9174');

/** How dark the bed goes a metre or so under, where the light stops reaching. */
const DEEP = new Color('#2c3733');

/**
 * Leaf litter and shade under a canopy.
 *
 * Deliberately close to the grass rather than a brown: the ask is for the
 * ground to *thicken* under a tree, not for a ring of mulch around every trunk.
 * Most of the read is the darkening, and the small shift off green is what
 * stops it looking like a shadow that failed to move with the sun.
 */
const DUFF = new Color('#69713f');

/** How far the turf shifts toward litter at the densest part of a canopy. */
const SHADE = 0.7;

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
 *
 * The **planting is built before this**, which is a deliberate inversion. The
 * ground has to know what is standing on it — grass does not grow the same
 * under a tree — and the only honest way to know is to ask the trees that were
 * actually placed rather than to paint a second map that agrees with them until
 * the seed changes.
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

  const material = new MeshStandardMaterial({
    map: base,
    roughness: 0.97,
    metalness: 0,
  });

  // Three ground materials mixed per pixel rather than one tinted per vertex.
  //
  // The mixing weights are the point. `aSoil` is the dry causes of bare ground —
  // slope, wear, patchiness — which genuinely vary slowly and are happy being
  // interpolated. Everything the water governs is derived here from `aWater`,
  // the height above the surface, because the *cause* is near-linear across a
  // bank while the *effect* is a sequence of bands under a metre wide. Storing
  // the effect was why the stream met mown lawn at a hard edge: at 2.5 m the
  // grid cannot hold a silt line, so there was never one to see.
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

         // The section, working up from the water. Each band is narrow on
         // purpose: what the reference photographs show is a *line* of washed
         // stone and silt at the water's edge, a handspan of it, and then
         // vegetation. Widened to a metre it stops reading as a waterline and
         // starts reading as a beach, which turned the stream into a dry gully
         // and the lake into a desert.
         float stone = 1.0 - smoothstep( -0.30, 0.10, vWater );
         float silt = 1.0 - smoothstep( 0.02, 0.55, vWater );
         float damp = 1.0 - smoothstep( 0.25, 2.40, vWater );

         // Bare ground under a canopy is what separates *shade* from *shadow*.
         // A darker green in the same texture reads as a cloud passing; the
         // ground under a tree is a different surface — litter and thin, rooty
         // turf — and swapping some of the texture for it is most of what says
         // the tree has been standing there.
         float duff = smoothstep( 0.2, 0.85, vShade );
         float bare = clamp( max( vSoil, max( silt * 0.8, duff * 0.5 ) ), 0.0, 1.0 );

         vec3 turf = vTint;
         turf = mix( turf, ${rgb(BANKSIDE)}, damp * 0.62 );
         turf = mix( turf, ${rgb(DUFF)}, vShade * ${SHADE.toFixed(3)} );

         vec3 grit = mix( turf, ${rgb(SILT)}, silt );

         // Darkened by its own depth. A bed a metre under is not the same
         // brightness as one at the waterline, and shading it as though it were
         // is what makes shallow water look like a wet floor: the water gets
         // its depth cue from what it is over, not only from what it is.
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
 * Where the ground is *drawn*, which is not quite where `heightAt` says it is.
 *
 * The mesh is a triangulated grid, so what the camera sees between two vertices
 * is a chord across the height function rather than the function itself. Over a
 * rise the chord runs below it, and anything seated on `heightAt` there stands
 * on nothing — which, at the finest octave of the relief, is a wavelength of
 * about nine metres against a 2.5 m quad and a good ten centimetres of daylight
 * under a plant.
 *
 * Ten centimetres does not sound like much and is fatal, because the eye reads
 * contact rather than height: a shrub with a shadow gap under it is *floating*,
 * at any distance, and no amount of sinking things into the ground fixes it
 * everywhere at once — the same bias that closes a gap on a rise buries a plant
 * in a hollow.
 *
 * So this evaluates the drawn surface exactly, on the same two triangles
 * `PlaneGeometry` builds each quad from. Three samples instead of one, paid
 * once at load, and floating stops being possible rather than being tuned
 * against.
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

  // The quad's diagonal runs from (x0, z1) to (x1, z0), which is the split
  // `PlaneGeometry` writes. Getting the diagonal backwards would be invisible
  // on gentle ground and wrong by the full sagitta on a ridge.
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
 * The **lowest** ground under the footprint, not the ground under the origin.
 * A plant is a vertical object with a horizontal skirt, and on a slope the
 * skirt's downhill edge is what the eye checks: seat it on the centre height
 * and that edge hangs in the air by the radius times the gradient, which on the
 * river bank is a third of a metre. Seating on the minimum buries the uphill
 * side instead, which is what real planting does anyway.
 *
 * `spread` of zero skips the sampling, because ground cover is small enough
 * that the centre is the whole footprint and there are thousands of them.
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
 * The wet margin used to live here too and no longer does: it is a band under a
 * metre wide and this is a per-vertex value on a 2.5 m grid, so storing it here
 * was storing it at a resolution that cannot represent it. What is left are the
 * three slow causes — slopes too steep to hold turf, the worn ground either
 * side of a path where people cut the corner, and patchiness on the steep parts.
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
 * Built by asking what is true at the point rather than by blending toward a
 * distance. Mowing follows the building, roughness follows everything else and
 * parching follows the high dry ground — so the variation is *caused* and lands
 * where a groundsman would have put it.
 *
 * The last term is the one that actually kills the carpet read: a slow,
 * incoherent value drift at a wavelength longer than anything else here. Real
 * grass is never one value across a hundred metres, and no amount of hue
 * variation reads as natural while the lightness is constant.
 */
function turf(target: Color, x: number, z: number, y: number): void {
  const wild = smoothstep(34, 120, Math.hypot(x, z - 20));
  target.copy(LAWN).lerp(MEADOW, wild);

  // Parched high ground, in drifts rather than in bands.
  const dryness = Math.max(0, wave(x / 62 - 17.3, z / 62 + 6.8)) * smoothstep(0.4, 4.5, y);
  target.lerp(PARCHED, Math.min(0.75, dryness) * wild);

  // A slow, incoherent drift in value — and each octave is sampled on its own
  // rotated axes.
  //
  // `wave` is value noise on an integer lattice, so an octave read straight off
  // x and z carries that lattice's squares. Three octaves all read the same way
  // put their squares in register, and what came out was a visible quilt across
  // the whole park at the coarsest wavelength — the one thing this term exists
  // to prevent, arriving from its own construction. Turning each octave by an
  // arbitrary angle costs two multiplies and leaves nothing for the eye to lock
  // on to.
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
 * A palette entry as GLSL.
 *
 * `Color` holds working-space values, which is the space the shader mixes in,
 * so the constant a fragment sees and the constant a vertex colour carries are
 * the same number. Writing the hex into the shader instead would put one of the
 * two through the sRGB curve and not the other.
 */
function rgb(color: Color): string {
  return `vec3( ${color.r.toFixed(4)}, ${color.g.toFixed(4)}, ${color.b.toFixed(4)} )`;
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
