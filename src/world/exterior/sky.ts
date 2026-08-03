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
 * **It does not have to agree with the Blender bake.** That was believed for a
 * long time and it was wrong: the only thing `exterior_building.py` bakes is
 * ambient occlusion, and AO is sun-independent by construction. Nothing in the
 * exported textures carries a light direction, so the sun here can be moved
 * freely and the relight costs a constant, not a re-bake.
 *
 * A Nordic summer midday, per `work/act1_photo_ideas/`: a genuinely deep blue
 * zenith falling to a pale, slightly warm haze at the horizon. The saturation
 * at the top matters more than it looks — it is what the water reflects and
 * what the shaded faces of the building pick up through image-based lighting,
 * so a washed-out sky produces a washed-out building even in full sun.
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
  // The ground plane is 900 m across and the fog closes at 460 m, so every ray
  // that leaves the camera shallowly downward and clears the plane's edge shows
  // this texture instead of ground. From an elevated pose that is a band several
  // degrees deep sitting directly above the treeline, and with a green stop here
  // it rendered as a hard olive stripe across the sky. Anything past the fog
  // distance is fog by definition, so that is what the first few degrees are.
  [0.545, '#cfe0ee'],
  [0.63, '#8d9a76'],
  [1.0, '#55603f'],
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
