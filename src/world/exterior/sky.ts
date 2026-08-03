import { CanvasTexture, EquirectangularReflectionMapping, SRGBColorSpace, type Texture } from 'three';

/**
 * Daylight, as a narrow equirectangular gradient.
 *
 * Mapped equirectangularly, the texture's vertical axis *is* elevation, so a
 * one-dimensional gradient produces a correct sky for any camera orientation
 * with no dome geometry, no draw call and no per-frame reposition. The same
 * texture drives image-based lighting, which is what makes the building's
 * shaded faces pick up sky colour rather than going flat black.
 *
 * It has to agree with the bake. `exterior_building.py` lights the building
 * under a physical daylight sky at a 28° sun; a dusk gradient here would put a
 * sunlit building under an evening sky, which reads instantly as wrong even
 * to someone who could not say why.
 */
const STOPS: ReadonlyArray<readonly [number, string]> = [
  [0.0, '#2f6ab0'],
  [0.26, '#4a88c6'],
  [0.42, '#7fadd8'],
  [0.485, '#b9d2e5'],
  // The horizon sits at exactly v = 0.5, which is eye level.
  [0.5, '#d3e2ee'],
  [0.512, '#8c9a7c'],
  [0.62, '#5f6d4c'],
  [1.0, '#47523a'],
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
