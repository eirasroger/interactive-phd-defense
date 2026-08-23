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
 * The volume Act III is argued inside.
 *
 * Once the plan has cleared there is nothing in the frame, and a composition set
 * on nothing reads as a slide rather than as a place. What replaces the corridor
 * is the thing the corridor was always moving: data, as a volume the camera is
 * standing in. It belongs to the zone rather than to a scene, so the themes that
 * follow can travel through it and it will be where they left it.
 *
 * **Many and small, at the density the engine demos already run at.** A few
 * hundred large sprites is a screensaver: every one of them is an object, and an
 * object behind a word is something the eye keeps trying to resolve. Tens of
 * thousands of small points is a medium, and a medium is what text sits in front
 * of. It is one draw call either way.
 *
 * **Readability is bounded in code, not tuned by eye.** A field behind text is
 * the classic way to make a slide unreadable, so every lever that could do that
 * has a limit here:
 *
 * - `ceiling` is the most any one point may add to the ground. Nothing in this
 *   file may raise it to make the sea more visible. If the sea cannot be seen
 *   under the ceiling it should be removed.
 * - Points fade out both very near the camera and far from it. Near is what
 *   keeps the dive readable: a point the camera is about to pass is gone before
 *   it is large enough to sit over a word. Far stops the sea building into a
 *   bright plane behind the heading, which at the overlook is the top of frame.
 * - The wander is bounded in metres and slow enough that a still frame and a
 *   live one agree.
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

/** Cool and almost colourless: the sea is depth, and depth is not a hue. */
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
 * A repeatable stream, drawn from in order.
 *
 * The first version hashed the point index once per axis, with the three seeds
 * one apart. A hash that cheap correlates at that spacing, so the coordinates
 * moved together and the whole field came out lying on a few diagonal planes
 * that happened to miss the frustum. On screen that read as empty, with a full
 * buffer, a visible object and a shader that compiled.
 *
 * One generator advanced per value cannot correlate with itself, and seeding it
 * from a constant keeps the sea the same sea on every reload: a presenter who
 * rehearses against one frame and defends against another has been handed a
 * different slide.
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
    // Denser low and thinning upward, so the volume reads as something the
    // camera is looking down into rather than as a cube of confetti.
    positions[at + 1] = SECTION.floor + next() ** 1.7 * SEA.volume.height;
    positions[at + 2] = -RUN / 2 + (next() - 0.5) * SEA.volume.along;

    seeds[index] = next();
    // A spread of weights rather than one size, so the field has grain.
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
  // The volume surrounds the camera during the dive, so its bounding sphere is
  // a poor proxy for whether any of it is in shot.
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
