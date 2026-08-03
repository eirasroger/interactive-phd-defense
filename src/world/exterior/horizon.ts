import {
  BackSide,
  CanvasTexture,
  CylinderGeometry,
  LinearFilter,
  Mesh,
  MeshBasicMaterial,
  SRGBColorSpace,
} from 'three';

export interface Horizon {
  readonly object: Mesh;
  dispose(): void;
}

const RADIUS = 420;
const HEIGHT = 150;
/** Where the ground line falls in the band, as a fraction from the top. */
const GROUND_LINE = 0.72;

const HAZE = '#c3d5e4';
const MASSING = '#8ea6bd';

/**
 * The far field, drawn rather than modelled.
 *
 * Four sibling blocks were built and baked here first. At the distance they
 * were seen from they contributed nothing but silhouette, and a real building
 * seen only as silhouette looks like a worse building rather than like depth —
 * every simplification made to keep them cheap was legible.
 *
 * This is the same information for none of the payload: soft massing shapes
 * dissolving upward into haze, on a cylinder that surrounds the site. It reads
 * as a settlement continuing past the park without ever inviting the eye to
 * examine a facade, which is exactly what the far field should do.
 *
 * Unlit, unfogged and depth-write disabled, so it sits behind everything and
 * takes no part in the depth buffer that the real geometry uses.
 */
export function createHorizon(): Horizon {
  const texture = new CanvasTexture(paint());
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.generateMipmaps = false;

  const geometry = new CylinderGeometry(RADIUS, RADIUS, HEIGHT, 96, 1, true);
  const material = new MeshBasicMaterial({
    map: texture,
    side: BackSide,
    transparent: true,
    depthWrite: false,
    fog: false,
  });

  const object = new Mesh(geometry, material);
  // The band straddles the ground line, so the cylinder is lifted until the
  // painted horizon sits at eye level rather than at the camera's feet.
  object.position.y = HEIGHT * (0.5 - (1 - GROUND_LINE));
  object.renderOrder = -1;

  return {
    object,
    dispose() {
      geometry.dispose();
      material.dispose();
      texture.dispose();
    },
  };
}

/**
 * A strip of soft massing fading up into haze.
 *
 * Deterministic rather than random: the far field must look identical every
 * time the act is walked, because a defence is rehearsed and anything that
 * differs between run-throughs is a distraction the speaker has to absorb.
 */
function paint(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 512;

  const context = canvas.getContext('2d');
  if (!context) throw new Error('A 2D context is required to build the horizon.');

  const ground = canvas.height * GROUND_LINE;
  let seed = 0x5f3a71;
  const random = (): number => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0xffffffff;
  };

  // Two ranks, the further one lighter and lower, so the band has depth of its
  // own rather than reading as one cut-out strip.
  //
  // Blocks are narrow and closely spaced on purpose. The canvas wraps a 420 m
  // cylinder, so a 96 px block is 124 m across and subtends seventeen degrees —
  // at that size the far field stopped reading as a settlement and became two
  // pale slabs sitting in the sky, which is worse than having no horizon at
  // all. Many small shapes read as distance; few large ones read as objects.
  for (const rank of [
    { alpha: 0.20, scale: 0.62, drop: 6 },
    { alpha: 0.32, scale: 1.0, drop: 0 },
  ]) {
    context.fillStyle = MASSING;
    context.globalAlpha = rank.alpha;

    let x = -60;
    while (x < canvas.width + 60) {
      const width = (7 + random() * 26) * rank.scale;
      const height = (9 + random() * 40) * rank.scale;
      const gap = (3 + random() * 15) * rank.scale;
      context.fillRect(x, ground - height + rank.drop, width, height + 40);
      x += width + gap;
    }
  }

  context.globalAlpha = 1;

  // Haze lightens the massing from the top down, so each shape dissolves
  // upward instead of ending on a hard roofline. `source-atop` keeps it inside
  // the shapes already drawn rather than laying a wash over the whole strip.
  context.globalCompositeOperation = 'source-atop';
  const wash = context.createLinearGradient(0, ground - 90, 0, ground);
  wash.addColorStop(0.0, HAZE);
  wash.addColorStop(1.0, `${HAZE}00`);
  context.fillStyle = wash;
  context.fillRect(0, 0, canvas.width, canvas.height);

  // Everything outside a narrow band around the horizon is erased. Without
  // this the strip is an opaque wall across the sky rather than a suggestion at
  // eye level — the texture covers a 150-unit-tall cylinder, and only the few
  // units either side of the ground line should carry anything at all.
  context.globalCompositeOperation = 'destination-out';
  const mask = context.createLinearGradient(0, 0, 0, canvas.height);
  mask.addColorStop(0.0, 'rgba(0,0,0,1)');
  mask.addColorStop(GROUND_LINE - 0.19, 'rgba(0,0,0,1)');
  mask.addColorStop(GROUND_LINE - 0.10, 'rgba(0,0,0,0)');
  mask.addColorStop(GROUND_LINE, 'rgba(0,0,0,0)');
  mask.addColorStop(GROUND_LINE + 0.03, 'rgba(0,0,0,1)');
  mask.addColorStop(1.0, 'rgba(0,0,0,1)');
  context.fillStyle = mask;
  context.fillRect(0, 0, canvas.width, canvas.height);

  return canvas;
}
