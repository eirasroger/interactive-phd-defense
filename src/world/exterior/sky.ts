import { CanvasTexture, EquirectangularReflectionMapping, SRGBColorSpace, type Texture } from 'three';

/**
 * Dusk, as a two-pixel-wide equirectangular gradient.
 *
 * Mapped equirectangularly, the texture's vertical axis *is* elevation, so a
 * one-dimensional gradient produces a correct sky for any camera orientation
 * with no dome geometry, no draw call and no per-frame reposition. The same
 * texture drives image-based lighting, which is what makes the building's
 * shaded faces pick up sky colour rather than going flat black.
 *
 * Dusk is chosen for the reason the whole exterior is: at low light, realism
 * comes from silhouette and gradient rather than from surface detail nobody
 * has time to author.
 */
const STOPS: ReadonlyArray<readonly [number, string]> = [
  [0.0, '#03050a'],
  [0.3, '#070b13'],
  [0.44, '#0f1926'],
  [0.492, '#1c2836'],
  // The horizon sits at exactly v = 0.5, which is eye level.
  [0.5, '#26313d'],
  [0.508, '#1b212a'],
  [0.6, '#0b0e13'],
  [1.0, '#06070a'],
];

export function createSkyTexture(): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = 8;
  canvas.height = 1024;

  const context = canvas.getContext('2d');
  if (!context) throw new Error('A 2D context is required to build the sky gradient.');

  const gradient = context.createLinearGradient(0, 0, 0, canvas.height);
  for (const [offset, color] of STOPS) gradient.addColorStop(offset, color);
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);

  const texture = new CanvasTexture(canvas);
  texture.mapping = EquirectangularReflectionMapping;
  texture.colorSpace = SRGBColorSpace;
  return texture;
}
