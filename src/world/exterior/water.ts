import { CanvasTexture, LinearMipmapLinearFilter, RepeatWrapping, type Texture } from 'three';

/**
 * Shared ripple detail for both water bodies: a tiling gradient map sampled at
 * two scales. Mipmaps average it to flat in the distance, which avoids moire.
 */

/**
 * Texture size, octave cell counts and per-octave amplitude falloff. At 0.5
 * every octave adds equal slope (whitecaps); 0.4 lets the long waves dominate.
 */
const SIZE = 256;
const GAIN = 0.4;
const OCTAVES = [4, 8, 16, 32] as const;

/** Tile size in metres per layer, and the coarse layer's weight (0 to 1). */
export const RIPPLE = { coarse: 14.2, fine: 4.6, blend: 0.75 } as const;

let cached: HTMLCanvasElement | null = null;

/**
 * Seamless gradient map of the wave field, built once and cached. R and G hold
 * the x and z slope; callers use them to tilt an up-facing normal.
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

  // Wrapped central differences, normalised to the peak so encoding never
  // clips. Callers set the slope strength.
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

/** Gradient map texture. Create one per material so each can dispose its own. */
export function createRippleTexture(): Texture {
  const texture = new CanvasTexture(rippleCanvas());
  texture.name = 'water-ripple';
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  // No anisotropy: it keeps ripples sharp at grazing angles, where they alias.
  texture.anisotropy = 1;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  return texture;
}

/**
 * `rippleAt(worldXZ, time)` returns the wave slope used to perturb a unit
 * normal. The two layers drift in different directions to avoid a visible
 * repeat.
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

/** Value noise that repeats every `cells`, so the map tiles. */
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
