import { CanvasTexture, EquirectangularReflectionMapping, SRGBColorSpace, type Texture } from 'three';
import type { Vec3 } from '@/engine/camera/types';
import { HEIGHT, WIDTH, dither, fbm, paintGradient, panoramaCanvas, smoothstep } from './panorama';

/**
 * Daylight sky as an equirectangular panorama, built once at load. Vertical
 * axis is elevation, horizontal is azimuth, so no dome geometry is needed.
 * The same texture drives image-based lighting.
 *
 * The Blender bake is AO only, so the sun direction here can change freely.
 */

/**
 * Nordic summer midday (`work/act1_photo_ideas/`): deep blue zenith to pale,
 * slightly warm horizon haze. Zenith saturation matters: the water and the
 * building's shaded faces pick it up through IBL.
 */
const STOPS: ReadonlyArray<readonly [number, string]> = [
  [0.0, '#1f5fb4'],
  [0.22, '#3d7cc8'],
  [0.4, '#79aadb'],
  [0.475, '#b6d3ea'],
  // Horizon (v = 0.5). Keep close to the zone's fog colour so distant ground
  // blends into sky without a visible line.
  [0.5, '#d6e4f0'],
  // Fog colour continues a few degrees below the horizon. Shallow downward rays
  // miss the 900 m ground plane and sample here, just above the treeline.
  [0.545, '#cfe0ee'],
  [0.63, '#8d9a76'],
  [1.0, '#55603f'],
];

/**
 * Cloud deck, projected as a flat plane at unit height above the eye, so clouds
 * shrink and crowd toward the horizon. `reach` caps the sample distance to
 * avoid aliasing near the horizon; `fade` blends the deck into haze before that.
 */
const DECK = {
  /** Metres of cloud per unit of deck height, as a noise wavelength. */
  scale: 0.62,
  /** Where the noise crosses into cloud. Higher is a clearer sky. */
  coverage: 0.53,
  /** Width of the cloud edge falloff. */
  softness: 0.13,
  /** Furthest the plane is sampled, in deck heights. */
  reach: 24,
  /**
   * Elevation band where the deck fades into haze, in radians (about 6-17
   * degrees). Kept above the angles the lake reflects, so low cloud does not
   * show up as high-contrast ripples on the water.
   */
  fade: [0.1, 0.3] as const,
  /** Peak opacity, for scattered summer cloud. */
  opacity: 0.85,
} as const;

/** Cloud colours (RGB, 0 to 1): shaded, sunlit, and the horizon haze. */
const SHADED = [0.62, 0.68, 0.76] as const;
const SUNLIT = [0.99, 0.98, 0.95] as const;
const HAZE = [0.81, 0.88, 0.93] as const;

/**
 * Sun glow radii in radians of arc, and its strength. A soft glow with no
 * disc, which also keeps the peak below tone-curve clipping.
 */
const GLOW = { inner: 0.06, outer: 0.62, strength: 0.85 } as const;

/**
 * @param sun Direction towards the sun, in world space. Pass the zone's
 *   `keyOffset` so the glow matches the shadow-casting light.
 */
export function createSkyTexture(sun: Vec3): Texture {
  const { canvas, context } = panoramaCanvas();
  paintGradient(context, STOPS);

  const length = Math.hypot(sun[0], sun[1], sun[2]) || 1;
  const towards: Vec3 = [sun[0] / length, sun[1] / length, sun[2] / length];

  context.drawImage(clouds(towards), 0, 0, WIDTH, HEIGHT);
  glow(context, towards);
  dither(context, WIDTH, HEIGHT);

  const texture = new CanvasTexture(canvas);
  texture.mapping = EquirectangularReflectionMapping;
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

/**
 * Renders the deck at half the panorama's resolution, then scales it up.
 * Cloud is low-frequency, so the upscale is invisible and saves 4x noise work.
 */
function clouds(sun: Vec3): HTMLCanvasElement {
  const width = WIDTH / 2;
  const height = HEIGHT / 2;

  const { canvas, context } = panoramaCanvas(width, height);

  const image = context.createImageData(width, height);
  const { data } = image;

  for (let row = 0; row < height; row += 1) {
    // v maps to elevation: v = asin(dir.y) / π + ½.
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

      // Dense cloud and the sun-facing side are lit; thin edges stay shaded.
      // This gives volume without a second noise lookup.
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

/** Adds the sun glow to the sky additively. */
function glow(context: CanvasRenderingContext2D, sun: Vec3): void {
  const azimuth = Math.atan2(sun[2], sun[0]);
  const elevation = Math.asin(Math.max(-1, Math.min(1, sun[1])));
  const x = (azimuth / (Math.PI * 2) + 0.5) * WIDTH;
  const y = (0.5 - elevation / Math.PI) * HEIGHT;
  const radius = (GLOW.outer / Math.PI) * HEIGHT;

  context.save();
  context.globalCompositeOperation = 'lighter';

  // Drawn three times, one panorama width apart, so the glow wraps the seam.
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
