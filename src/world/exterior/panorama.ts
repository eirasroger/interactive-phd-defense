/**
 * Shared machinery for the equirectangular panoramas this zone builds at load.
 *
 * Mapped equirectangularly, a texture's vertical axis *is* elevation and its
 * horizontal axis *is* azimuth, so a canvas produces a correct backdrop for any
 * camera orientation with no dome geometry and no per-frame reposition. Both
 * the daylight sky and the cloud interior are that same trick with different
 * paint, so the noise, the dither and the size live here rather than being
 * written twice and drifting apart.
 */

/** Panorama size. Wide enough that a cloud edge is not a staircase at 44° fov. */
export const WIDTH = 1024;
export const HEIGHT = 512;

/**
 * A quarter-level of noise over the whole panorama.
 *
 * A slow ramp between near neighbours crosses only a few 8-bit steps over
 * hundreds of pixels, and a step that wide is a visible contour once the tone
 * curve has stretched it across a projector. One LSB of ordered noise costs
 * nothing and removes every band; it is the same trick a print driver uses and
 * for exactly the same reason.
 *
 * Mandatory on any panorama that is mostly one value. The cloud interior is the
 * worst case in the deck: a near-flat near-white field is where banding is most
 * visible and it is the first thing the audience sees.
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
 * Fractal noise. Five octaves is one more than the eye needs and two fewer than
 * it sees, which is right for a field being read as detail.
 *
 * `octaves` exists for fields being read as *form*. Every octave added is
 * higher frequency at lower amplitude, so a surface that has to be soft — one
 * whose whole character is that it has no edges — is asking for fewer of them,
 * and no amount of blurring afterwards recovers the smoothness of simply not
 * having generated the detail.
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
 * Integer hash, not `sin(dot(...))`.
 *
 * `paths.ts` hashes with a sine because it is called a few hundred thousand
 * times at load and legibility wins. This one runs five octaves over a hundred
 * and thirty thousand pixels — two and a half million lookups — and a
 * transcendental in that loop is the difference between a frame and a stutter.
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

/** A vertical ramp of colour stops, painted across the whole panorama. */
export function paintGradient(
  context: CanvasRenderingContext2D,
  stops: ReadonlyArray<readonly [number, string]>,
): void {
  const gradient = context.createLinearGradient(0, 0, 0, HEIGHT);
  for (const [offset, color] of stops) gradient.addColorStop(offset, color);
  context.fillStyle = gradient;
  context.fillRect(0, 0, WIDTH, HEIGHT);
}

/** A panorama-sized canvas and its context, or a thrown error rather than a null. */
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
