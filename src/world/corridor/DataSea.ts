import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  Points,
  ShaderMaterial,
} from 'three';
import { RUN, SECTION } from '@/config/corridor';

/**
 * Act III backdrop: a volume of small additive points around the camera, owned
 * by the zone so it persists across scenes. One draw call.
 *
 * Limits that keep text readable:
 * - `ceiling`: max brightness one point adds. Do not raise it.
 * - Points fade near the camera (so none grow over text) and far away (so they
 *   do not build into a bright plane).
 * - `wander` is small and slow.
 */
const SEA = {
  ceiling: 0.5,
  /** Reference diameter in device pixels, at the reference depth. */
  size: 4.6,
  count: 26_000,
  volume: { across: 300, along: RUN + 260, height: 130 },
  /** Metres. How far a point wanders from where it was placed. */
  wander: 1.6,
  /** Metres per second. */
  drift: 0.32,
  depth: { near: 12, rise: 30, fall: 86, far: 210 },
} as const;

/** Cool, near-neutral blue. */
const WATER = 0x9fc4e8;

const VERTEX = `
uniform float uTime;
uniform float uSize;
uniform float uPixelRatio;
uniform float uLevel;
uniform float uCeiling;
uniform float uWander;
uniform vec4 uDepth;
attribute float aSeed;
attribute float aScale;
varying float vAlpha;
void main() {
  float phase = aSeed * 6.283;
  vec3 wander = vec3(
    sin(uTime * 0.31 + phase),
    cos(uTime * 0.23 + phase * 1.7),
    sin(uTime * 0.19 + phase * 1.3)
  ) * uWander;

  vec4 seen = modelViewMatrix * vec4(position + wander, 1.0);
  float depth = -seen.z;

  float entering = smoothstep(uDepth.x, uDepth.x + uDepth.y, depth);
  float leaving = 1.0 - smoothstep(uDepth.z, uDepth.w, depth);
  vAlpha = uCeiling * entering * leaving * aScale * uLevel;

  gl_Position = projectionMatrix * seen;
  gl_PointSize = uSize * uPixelRatio * aScale * (44.0 / max(depth, 1.0));
}
`;

const FRAGMENT = `
uniform vec3 uColor;
varying float vAlpha;
void main() {
  float reach = length(gl_PointCoord - vec2(0.5));
  if (reach > 0.5) discard;
  float falloff = smoothstep(0.5, 0.0, reach);
  float alpha = falloff * vAlpha;
  if (alpha < 0.0015) discard;
  gl_FragColor = vec4(uColor, alpha);
}
`;

export interface DataSea {
  readonly object: Points;
  update(dt: number): void;
  /** 0 gone, 1 present. */
  setLevel(level: number): void;
  dispose(): void;
}

/**
 * Seeded LCG, so the sea is identical on every reload. Use one stream for all
 * axes: per-axis index hashes correlate and collapse points onto planes.
 */
const stream = (seed: number): (() => number) => {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
};

export function createDataSea(budget: number): DataSea {
  const count = Math.min(SEA.count, Math.max(1200, budget));

  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  const scales = new Float32Array(count);
  const next = stream(0x5eed_1a37);

  for (let index = 0; index < count; index += 1) {
    const at = index * 3;
    positions[at] = (next() - 0.5) * SEA.volume.across;
    // Denser near the floor, thinning upward.
    positions[at + 1] = SECTION.floor + next() ** 1.7 * SEA.volume.height;
    positions[at + 2] = -RUN / 2 + (next() - 0.5) * SEA.volume.along;

    seeds[index] = next();
    // Varied point sizes.
    scales[index] = 0.45 + next() ** 1.4 * 0.85;
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('aSeed', new BufferAttribute(seeds, 1));
  geometry.setAttribute('aScale', new BufferAttribute(scales, 1));
  geometry.computeBoundingSphere();

  const material = new ShaderMaterial({
    uniforms: {
      uColor: { value: new Color(WATER) },
      uTime: { value: 0 },
      uSize: { value: SEA.size },
      uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
      uLevel: { value: 0 },
      uCeiling: { value: SEA.ceiling },
      uWander: { value: SEA.wander },
      uDepth: {
        value: [SEA.depth.near, SEA.depth.rise, SEA.depth.fall, SEA.depth.far],
      },
    },
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
    fog: false,
  });

  const object = new Points(geometry, material);
  object.name = 'sea';
  object.visible = false;
  // The volume surrounds the camera, so culling by bounding sphere is useless.
  object.frustumCulled = false;
  object.renderOrder = -1;

  let clock = 0;

  return {
    object,

    update(dt) {
      if (!object.visible) return;
      clock += dt * SEA.drift;
      material.uniforms['uTime']!.value = clock;
    },

    setLevel(level) {
      object.visible = level > 0.004;
      material.uniforms['uLevel']!.value = level;
    },

    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}
