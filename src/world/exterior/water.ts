import { CanvasTexture, LinearMipmapLinearFilter, RepeatWrapping, type Texture } from 'three';

/**
 * The surface detail both water bodies share.
 *
 * A handful of analytic wave trains is a *lattice*: four sinusoids at fixed
 * headings repeat across two hundred and fifty metres of lake and read as woven
 * cloth. A tiling gradient map sampled at two incommensurable scales is
 * broadband instead, and brings what sinusoids cannot have — **mipmaps**. Below
 * a pixel the hardware averages the field toward flat, which is what the surface
 * integrates to anyway, so the far field stops moireing with no distance fade.
 */

/**
 * Texture size, the lattices it wraps on, and how fast the spectrum falls.
 *
 * `GAIN` decides how the water reads. Slope is amplitude times frequency, so
 * halving amplitude per octave leaves every octave contributing the same slope —
 * which draws whitecaps. At 0.4 the longest terms carry the field.
 */
const SIZE = 256;
const GAIN = 0.4;
const OCTAVES = [4, 8, 16, 32] as const;

/** Metres one tile of each layer covers, and how the two are weighted. */
export const RIPPLE = { coarse: 14.2, fine: 4.6, blend: 0.75 } as const;

let cached: HTMLCanvasElement | null = null;

/**
 * A seamless gradient map of the wave field, built once.
 *
 * The two horizontal components of the surface gradient rather than an encoded
 * normal: callers perturb an up-facing normal by them, so a third channel would
 * only restate what the first two say.
 */
function rippleCanvas(): HTMLCanvasElement {
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;

  const context = canvas.getContext('2d');
  if (!context) throw new Error('A 2D context is required to build the water ripples.');

  const field = new Float32Array(SIZE * SIZE);
  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      let height = 0;
      let amplitude = 1;
      for (const cells of OCTAVES) {
        height += periodic((x / SIZE) * cells, (y / SIZE) * cells, cells) * amplitude;
        amplitude *= GAIN;
      }
      field[y * SIZE + x] = height;
    }
  }

  // Central differences over the wrapped field, normalised to their own extreme
  // so the encoding never clips. What the field is worth as slope is the
  // caller's to say; here it only has to be a shape.
  const gradient = new Float32Array(SIZE * SIZE * 2);
  let peak = 1e-6;
  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      const dx = field[y * SIZE + wrap(x + 1)]! - field[y * SIZE + wrap(x - 1)]!;
      const dy = field[wrap(y + 1) * SIZE + x]! - field[wrap(y - 1) * SIZE + x]!;
      gradient[(y * SIZE + x) * 2] = dx;
      gradient[(y * SIZE + x) * 2 + 1] = dy;
      peak = Math.max(peak, Math.abs(dx), Math.abs(dy));
    }
  }

  const image = context.createImageData(SIZE, SIZE);
  for (let index = 0; index < SIZE * SIZE; index += 1) {
    image.data[index * 4] = encode(gradient[index * 2]! / peak);
    image.data[index * 4 + 1] = encode(gradient[index * 2 + 1]! / peak);
    image.data[index * 4 + 2] = 128;
    image.data[index * 4 + 3] = 255;
  }

  context.putImageData(image, 0, 0);
  cached = canvas;
  return canvas;
}

/** The gradient map as a texture. One per material, so each owns its disposal. */
export function createRippleTexture(): Texture {
  const texture = new CanvasTexture(rippleCanvas());
  texture.name = 'water-ripple';
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  // Isotropic on purpose. Anisotropy keeps detail alive at grazing angles, and a
  // grazing angle is exactly where a sub-pixel ripple aliases into corduroy.
  texture.anisotropy = 1;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  return texture;
}

/**
 * `rippleAt(worldXZ, time)` — the wave field's slope, in the units a unit normal
 * is perturbed by. The two layers drift on different headings, so their beat
 * never settles into a pattern.
 */
export const RIPPLE_GLSL = `
uniform sampler2D uRipple;

vec2 rippleAt(vec2 p, float t) {
  vec2 coarse = texture2D(uRipple, (p + vec2(0.21, 0.13) * t) / ${RIPPLE.coarse.toFixed(2)}).rg;
  vec2 fine = texture2D(uRipple, (p + vec2(-0.17, 0.29) * t) / ${RIPPLE.fine.toFixed(2)}).rg;
  return mix(fine * 2.0 - 1.0, coarse * 2.0 - 1.0, ${RIPPLE.blend.toFixed(2)});
}
`;

function encode(value: number): number {
  return Math.round(Math.min(Math.max(value * 0.5 + 0.5, 0), 1) * 255);
}

function wrap(index: number): number {
  return (index + SIZE) % SIZE;
}

/** Value noise on a lattice that repeats every `cells`, so the map tiles. */
function periodic(x: number, y: number, cells: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const u = ease(x - xi);
  const v = ease(y - yi);

  const a = hash(xi % cells, yi % cells);
  const b = hash((xi + 1) % cells, yi % cells);
  const c = hash(xi % cells, (yi + 1) % cells);
  const d = hash((xi + 1) % cells, (yi + 1) % cells);

  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}

function ease(t: number): number {
  return t * t * (3 - 2 * t);
}

function hash(x: number, y: number): number {
  const value = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return value - Math.floor(value);
}
