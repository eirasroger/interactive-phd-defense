import { CanvasTexture, EquirectangularReflectionMapping, SRGBColorSpace, type Texture } from 'three';
import type { Vec3 } from '@/engine/camera/types';

/**
 * Daylight, as an equirectangular panorama built at load.
 *
 * Mapped equirectangularly, the texture's vertical axis *is* elevation and its
 * horizontal axis *is* azimuth, so a canvas produces a correct sky for any
 * camera orientation with no dome geometry, no draw call and no per-frame
 * reposition. The same texture drives image-based lighting, which is what makes
 * the building's shaded faces pick up sky colour rather than going flat black.
 *
 * **It does not have to agree with the Blender bake.** That was believed for a
 * long time and it was wrong: the only thing `exterior_building.py` bakes is
 * ambient occlusion, and AO is sun-independent by construction. Nothing in the
 * exported textures carries a light direction, so the sun here can be moved
 * freely and the relight costs a constant, not a re-bake.
 *
 * A smooth ramp of blue with no sun, no cloud and nothing at any scale reads as
 * a background rather than as a sky, and with the fog back to being aerial
 * perspective (`ExteriorZone`) it fills the top half of every frame in the act.
 * The three things below are what make it a sky, all paid once at load.
 */

/**
 * A Nordic summer midday, per `work/act1_photo_ideas/`: a genuinely deep blue
 * zenith falling to a pale, slightly warm haze at the horizon.
 *
 * The saturation at the top matters more than it looks — it is what the water
 * reflects and what the shaded faces of the building pick up through image-based
 * lighting, so a washed-out sky produces a washed-out building even in full sun.
 */
const STOPS: ReadonlyArray<readonly [number, string]> = [
  [0.0, '#1f5fb4'],
  [0.22, '#3d7cc8'],
  [0.4, '#79aadb'],
  [0.475, '#b6d3ea'],
  // The horizon sits at exactly v = 0.5, which is eye level. This stop must
  // stay close to the zone's fog colour: distant ground fades to fog and then
  // gives way to sky, and any step between the two draws a hard line across
  // the far field exactly where the eye is looking for one.
  [0.5, '#d6e4f0'],
  // Held at the fog colour for the first few degrees *below* the horizon, which
  // is not cosmetic — it is load-bearing.
  //
  // The ground plane is 900 m across, so every ray that leaves the camera
  // shallowly downward and clears the plane's edge shows this texture instead of
  // ground. From an elevated pose that is a band several degrees deep sitting
  // directly above the treeline, and with a green stop here it rendered as a
  // hard olive stripe across the sky.
  [0.545, '#cfe0ee'],
  [0.63, '#8d9a76'],
  [1.0, '#55603f'],
];

/** Panorama size. Wide enough that a cloud edge is not a staircase at 44° fov. */
const WIDTH = 1024;
const HEIGHT = 512;

/**
 * The cloud deck, as a plane at unit height above the eye.
 *
 * The perspective is the entire point and it is why this is not a noise texture
 * pasted across the upper half. A flat deck seen from under it converges: clouds
 * are large and sparse overhead, and compress into a crowded band as they
 * approach the horizon. That convergence is the single strongest cue that the
 * sky is a *space* rather than a surface, and it costs one `tan` per row.
 *
 * `reach` clamps how far out the plane is sampled: untruncated, the ground
 * distance goes to infinity at the horizon and the noise coordinate with it, so
 * the last rows alias into a moire of themselves. `fade` closes the deck into
 * haze well before that.
 */
const DECK = {
  /** Metres of cloud per unit of deck height, as a noise wavelength. */
  scale: 0.62,
  /** Where the noise crosses into cloud. Higher is a clearer sky. */
  coverage: 0.53,
  /** How hard the cloud edge is. */
  softness: 0.13,
  /** Furthest the plane is sampled, in deck heights. */
  reach: 24,
  /**
   * Elevation band over which the deck dissolves into horizon haze, radians.
   *
   * Nine degrees to twenty-six, and it is set by the **water** rather than by
   * the sky.
   *
   * Convergence crowds the deck into a dense, high-contrast band just above the
   * horizon, and that band is exactly what a lake mirrors: every pose in the act
   * views the water at a grazing angle, so the reflected ray leaves at ten or
   * fifteen degrees. Carried down to two degrees the deck turned two hundred
   * metres of peat-dark water into swimming-pool cyan with every ripple train
   * visible as corduroy, because a near-mirror sampling a black-and-white
   * environment swings the full range on a normal perturbation of nothing.
   *
   * Real cloud that low is washed out by the air in front of it anyway, so
   * lifting the deck out of the mirrored band costs the sky nothing.
   */
  fade: [0.1, 0.3] as const,
  /** Peak opacity, so the deck is scattered summer cloud and not overcast. */
  opacity: 0.85,
} as const;

/** Cloud in its own shadow, cloud in full sun, and the haze both dissolve into. */
const SHADED = [0.62, 0.68, 0.76] as const;
const SUNLIT = [0.99, 0.98, 0.95] as const;
const HAZE = [0.81, 0.88, 0.93] as const;

/**
 * How wide the glow around the sun is, in radians of arc, and how strong.
 *
 * No disc. A summer sun through any haze at all is a bright region several
 * degrees across rather than an edge, and a hard disc in a background texture is
 * the one thing guaranteed to read as a sticker. This also keeps the panorama's
 * peak well under the point where the tone curve clips it flat.
 */
const GLOW = { inner: 0.06, outer: 0.62, strength: 0.85 } as const;

/**
 * @param sun Direction *towards* the sun, in world space. This is the zone's
 *   `keyOffset` and must stay that: a sky whose glow disagrees with the light
 *   casting the shadows is worse than no glow at all, so it is passed in rather
 *   than written down twice.
 */
export function createSkyTexture(sun: Vec3): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;

  const context = canvas.getContext('2d');
  if (!context) throw new Error('A 2D context is required to build the sky.');

  const gradient = context.createLinearGradient(0, 0, 0, HEIGHT);
  for (const [offset, color] of STOPS) gradient.addColorStop(offset, color);
  context.fillStyle = gradient;
  context.fillRect(0, 0, WIDTH, HEIGHT);

  const length = Math.hypot(sun[0], sun[1], sun[2]) || 1;
  const towards: Vec3 = [sun[0] / length, sun[1] / length, sun[2] / length];

  context.drawImage(clouds(towards), 0, 0, WIDTH, HEIGHT);
  glow(context, towards);
  dither(context);

  const texture = new CanvasTexture(canvas);
  texture.mapping = EquirectangularReflectionMapping;
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

/**
 * The deck, rendered at half the panorama's resolution and scaled up.
 *
 * Cloud is low-frequency by nature and the upscale is invisible, where the full
 * resolution is four times the noise evaluations for a layer that is then
 * blurred by its own alpha anyway.
 */
function clouds(sun: Vec3): HTMLCanvasElement {
  const width = WIDTH / 2;
  const height = HEIGHT / 2;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');
  if (!context) throw new Error('A 2D context is required to build the cloud deck.');

  const image = context.createImageData(width, height);
  const { data } = image;

  for (let row = 0; row < height; row += 1) {
    // The panorama's v axis is elevation directly: v = asin(dir.y) / π + ½.
    const v = 1 - (row + 0.5) / height;
    const elevation = (v - 0.5) * Math.PI;
    if (elevation <= DECK.fade[0]) continue;

    const closing = smoothstep(DECK.fade[0], DECK.fade[1], elevation);
    const ground = Math.min(1 / Math.tan(elevation), DECK.reach) / DECK.scale;
    const cosine = Math.cos(elevation);
    const sine = Math.sin(elevation);

    for (let column = 0; column < width; column += 1) {
      const azimuth = ((column + 0.5) / width - 0.5) * Math.PI * 2;
      const cos = Math.cos(azimuth);
      const sin = Math.sin(azimuth);

      const density = fbm(ground * cos, ground * sin);
      const cover = smoothstep(DECK.coverage, DECK.coverage + DECK.softness, density);
      if (cover <= 0) continue;

      // Lit from the sun's side rather than uniformly white. The thick parts of
      // the field take the light and the thin edges stay in their own shadow,
      // which is what gives a deck volume without a second noise lookup.
      const facing =
        cosine * cos * sun[0] + sine * sun[1] + cosine * sin * sun[2];
      const body = smoothstep(DECK.coverage + 0.03, DECK.coverage + 0.26, density);
      const lit = Math.min(1, body * 0.72 + Math.max(0, facing) ** 3 * 0.85);

      const index = (row * width + column) * 4;
      for (let channel = 0; channel < 3; channel += 1) {
        const tone = SHADED[channel]! + (SUNLIT[channel]! - SHADED[channel]!) * lit;
        data[index + channel] = Math.round(
          255 * (tone + (HAZE[channel]! - tone) * (1 - closing)),
        );
      }
      data[index + 3] = Math.round(255 * cover * closing * DECK.opacity);
    }
  }

  context.putImageData(image, 0, 0);
  return canvas;
}

/** The sun, as light added to the sky rather than as an object placed in it. */
function glow(context: CanvasRenderingContext2D, sun: Vec3): void {
  const azimuth = Math.atan2(sun[2], sun[0]);
  const elevation = Math.asin(Math.max(-1, Math.min(1, sun[1])));
  const x = (azimuth / (Math.PI * 2) + 0.5) * WIDTH;
  const y = (0.5 - elevation / Math.PI) * HEIGHT;
  const radius = (GLOW.outer / Math.PI) * HEIGHT;

  context.save();
  context.globalCompositeOperation = 'lighter';

  // Drawn three times, a panorama width apart, so the glow wraps the seam
  // instead of being clipped by it wherever the sun happens to stand.
  for (const offset of [-WIDTH, 0, WIDTH]) {
    const halo = context.createRadialGradient(x + offset, y, 0, x + offset, y, radius);
    halo.addColorStop(0, `rgba(255, 246, 224, ${GLOW.strength})`);
    halo.addColorStop(GLOW.inner / GLOW.outer, `rgba(255, 240, 208, ${GLOW.strength * 0.42})`);
    halo.addColorStop(0.42, 'rgba(255, 236, 202, 0.10)');
    halo.addColorStop(1, 'rgba(255, 236, 202, 0)');
    context.fillStyle = halo;
    context.fillRect(x + offset - radius, y - radius, radius * 2, radius * 2);
  }

  context.restore();
}

/**
 * A quarter-level of noise over the whole panorama.
 *
 * The zenith-to-horizon ramp crosses about forty 8-bit steps over four hundred
 * pixels, and a step that wide is a visible contour once the tone curve has
 * stretched it across a projector. One LSB of ordered noise costs nothing and
 * removes every band; it is the same trick a print driver uses and for exactly
 * the same reason.
 */
function dither(context: CanvasRenderingContext2D): void {
  const image = context.getImageData(0, 0, WIDTH, HEIGHT);
  const { data } = image;

  for (let index = 0; index < data.length; index += 4) {
    const pixel = index >> 2;
    const step = (((pixel & 1) ^ ((pixel / WIDTH) & 1)) << 1) - 1;
    data[index] = clampByte(data[index]! + step);
    data[index + 1] = clampByte(data[index + 1]! - step);
    data[index + 2] = clampByte(data[index + 2]! + step);
  }

  context.putImageData(image, 0, 0);
}

const clampByte = (value: number): number => (value < 0 ? 0 : value > 255 ? 255 : value);

/** Five octaves, which is one more than the eye needs and two fewer than it sees. */
function fbm(x: number, z: number): number {
  let sum = 0;
  let amplitude = 0.5;
  let total = 0;
  let frequency = 1;

  for (let octave = 0; octave < 5; octave += 1) {
    sum += noise(x * frequency, z * frequency) * amplitude;
    total += amplitude;
    amplitude *= 0.5;
    frequency *= 2.07;
  }

  return sum / total;
}

function noise(x: number, z: number): number {
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
function hash(x: number, z: number): number {
  let value = Math.imul(x, 374761393) ^ Math.imul(z, 668265263);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}
