import {
  Data3DTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  RGBAFormat,
  RepeatWrapping,
  UnsignedByteType,
} from 'three';

/**
 * The cloud's density field, as a tiling 3D texture built at load.
 *
 * **Three bands in three channels, because erosion needs them separate.** A
 * single fractal field thresholded into cloud gives masses whose edges are the
 * same shape as the masses — round, and obviously a level set. Real cloud has
 * large soft bodies whose boundaries are chewed away at a much finer scale, and
 * the only way to get that is to keep the scales apart until the shader can
 * subtract one from the other.
 *
 * **Tiling is not optional.** The raymarch walks world space, so a field that
 * did not wrap would show its own edges as hard planes hanging in the air the
 * moment the camera moved past one. Every octave here is generated on a lattice
 * whose period divides the texture, which is what makes the whole thing
 * seamless in all three axes.
 *
 * 64³ of RGBA is a megabyte, built in a few milliseconds, and it is resident in
 * cache for the whole of the beat that reads it.
 */
export function createCloudNoise(): Data3DTexture {
  const voxels = SIZE * SIZE * SIZE;
  const bands = [
    build(voxels, BANDS.body, 4),
    build(voxels, BANDS.medium, 3),
    build(voxels, BANDS.fine, 2),
  ];

  const data = new Uint8Array(voxels * 4);
  for (let i = 0; i < voxels; i += 1) {
    data[i * 4] = bands[0]![i]!;
    data[i * 4 + 1] = bands[1]![i]!;
    data[i * 4 + 2] = bands[2]![i]!;
    data[i * 4 + 3] = 255;
  }

  const texture = new Data3DTexture(data, SIZE, SIZE, SIZE);
  texture.format = RGBAFormat;
  texture.type = UnsignedByteType;
  // **Mipmapped, which is the whole answer to the march's aliasing.** A ray
  // step is a length of the field averaged into one sample, and asking a
  // full-resolution field for that average gives whichever value happened to
  // sit at the sample point — noise, which the jitter then spreads into
  // stipple. Mip levels *are* the field pre-averaged at every scale, so a long
  // stride reads a correspondingly blurred one and the detail it could not
  // resolve is gone before it can alias.
  texture.minFilter = LinearMipmapLinearFilter;
  texture.magFilter = LinearFilter;
  texture.generateMipmaps = true;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.wrapR = RepeatWrapping;
  texture.needsUpdate = true;
  return texture;
}

/**
 * One band, normalised to its own range before it is quantised.
 *
 * **Averaging octaves concentrates the result around the middle.** Each one is
 * an independent field, so summing four of them is a small central-limit
 * machine: the raw values crowd into roughly 0.35 to 0.65 and almost never
 * reach either end. Left as they are, every threshold the shader applies has to
 * be hand-fitted to a distribution nobody measured — which is exactly how an
 * earlier version ended up with a coverage cut its field never crossed, and a
 * volume that raymarched to empty air.
 *
 * Rescaling to the full byte range makes the shader's constants mean what they
 * say, and costs one pass over a megabyte at load.
 */
function build(voxels: number, period: number, octaves: number): Uint8Array {
  const raw = new Float32Array(voxels);
  let low = Infinity;
  let high = -Infinity;

  let index = 0;
  for (let z = 0; z < SIZE; z += 1) {
    for (let y = 0; y < SIZE; y += 1) {
      for (let x = 0; x < SIZE; x += 1) {
        const value = fbm(x / SIZE, y / SIZE, z / SIZE, period, octaves);
        raw[index] = value;
        if (value < low) low = value;
        if (value > high) high = value;
        index += 1;
      }
    }
  }

  const span = high - low || 1;
  const out = new Uint8Array(voxels);
  for (let i = 0; i < voxels; i += 1) out[i] = byte((raw[i]! - low) / span);
  return out;
}

const SIZE = 64;

/** Lattice periods, in cells across the texture. Each must divide `SIZE`. */
const BANDS = { body: 4, medium: 8, fine: 16 } as const;

const byte = (value: number): number => {
  const scaled = Math.round(value * 255);
  return scaled < 0 ? 0 : scaled > 255 ? 255 : scaled;
};

/** Octaves on doubling lattices, so every one of them tiles with the texture. */
function fbm(x: number, y: number, z: number, period: number, octaves: number): number {
  let sum = 0;
  let amplitude = 0.5;
  let total = 0;
  let cells = period;

  for (let octave = 0; octave < octaves; octave += 1) {
    sum += noise(x * cells, y * cells, z * cells, cells) * amplitude;
    total += amplitude;
    amplitude *= 0.5;
    cells *= 2;
  }

  return sum / total;
}

/** Value noise on a wrapping lattice. */
function noise(x: number, y: number, z: number, period: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const zi = Math.floor(z);

  const xf = fade(x - xi);
  const yf = fade(y - yi);
  const zf = fade(z - zi);

  const x0 = wrap(xi, period);
  const x1 = wrap(xi + 1, period);
  const y0 = wrap(yi, period);
  const y1 = wrap(yi + 1, period);
  const z0 = wrap(zi, period);
  const z1 = wrap(zi + 1, period);

  const c000 = hash(x0, y0, z0);
  const c100 = hash(x1, y0, z0);
  const c010 = hash(x0, y1, z0);
  const c110 = hash(x1, y1, z0);
  const c001 = hash(x0, y0, z1);
  const c101 = hash(x1, y0, z1);
  const c011 = hash(x0, y1, z1);
  const c111 = hash(x1, y1, z1);

  const near = lerp(lerp(c000, c100, xf), lerp(c010, c110, xf), yf);
  const far = lerp(lerp(c001, c101, xf), lerp(c011, c111, xf), yf);
  return lerp(near, far, zf);
}

const wrap = (value: number, period: number): number => ((value % period) + period) % period;
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
/** Quintic rather than cubic: its second derivative vanishes at the lattice,
    so the field has no visible creases where cells meet. */
const fade = (t: number): number => t * t * t * (t * (t * 6 - 15) + 10);

function hash(x: number, y: number, z: number): number {
  let value = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 2147483647);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
}
