/**
 * Shared helpers for the equirectangular canvas panoramas built at load (the
 * daylight sky and the cloud interior). Vertical axis is elevation, horizontal
 * is azimuth, so no dome geometry is needed.
 */

/** Panorama size. Wide enough to keep cloud edges smooth at 44° fov. */
export const WIDTH = 1024;
export const HEIGHT = 512;

/**
 * Adds one LSB of ordered noise to remove 8-bit banding in slow gradients.
 * Required on any mostly flat panorama, especially the near-white cloud
 * interior.
 */
export function dither(context: CanvasRenderingContext2D, width: number, height: number): void {
  const image = context.getImageData(0, 0, width, height);
  const { data } = image;

  for (let index = 0; index < data.length; index += 4) {
    const pixel = index >> 2;
    const step = (((pixel & 1) ^ ((pixel / width) & 1)) << 1) - 1;
    data[index] = clampByte(data[index]! + step);
    data[index + 1] = clampByte(data[index + 1]! - step);
    data[index + 2] = clampByte(data[index + 2]! + step);
  }

  context.putImageData(image, 0, 0);
}

export const clampByte = (value: number): number => (value < 0 ? 0 : value > 255 ? 255 : value);

/**
 * Fractal noise, 0 to 1. Five octaves by default for detail. Use fewer octaves
 * for soft, edgeless shapes.
 */
export function fbm(x: number, z: number, octaves = 5): number {
  let sum = 0;
  let amplitude = 0.5;
  let total = 0;
  let frequency = 1;

  for (let octave = 0; octave < octaves; octave += 1) {
    sum += noise(x * frequency, z * frequency) * amplitude;
    total += amplitude;
    amplitude *= 0.5;
    frequency *= 2.07;
  }

  return sum / total;
}

export function noise(x: number, z: number): number {
  const xi = Math.floor(x);
  const zi = Math.floor(z);
  const xf = x - xi;
  const zf = z - zi;

  const u = xf * xf * (3 - 2 * xf);
  const v = zf * zf * (3 - 2 * zf);

  const a = hash(xi, zi);
  const b = hash(xi + 1, zi);
  const c = hash(xi, zi + 1);
  const d = hash(xi + 1, zi + 1);

  return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
}

/**
 * Integer hash, 0 to 1. Used over a sine hash because it runs about 2.5
 * million times per panorama.
 */
export function hash(x: number, z: number): number {
  let value = Math.imul(x, 374761393) ^ Math.imul(z, 668265263);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
}

export function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** Paints a vertical gradient across the whole panorama. */
export function paintGradient(
  context: CanvasRenderingContext2D,
  stops: ReadonlyArray<readonly [number, string]>,
): void {
  const gradient = context.createLinearGradient(0, 0, 0, HEIGHT);
  for (const [offset, color] of stops) gradient.addColorStop(offset, color);
  context.fillStyle = gradient;
  context.fillRect(0, 0, WIDTH, HEIGHT);
}

/** Creates a panorama-sized canvas and its 2D context. Throws if no context. */
export function panoramaCanvas(
  width = WIDTH,
  height = HEIGHT,
): { canvas: HTMLCanvasElement; context: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');
  if (!context) throw new Error('A 2D context is required to build a panorama.');

  return { canvas, context };
}
