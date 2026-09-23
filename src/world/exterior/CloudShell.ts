import gsap from 'gsap';
import {
  BackSide,
  Color,
  GLSL3,
  Mesh,
  ShaderMaterial,
  SphereGeometry,
  Vector2,
  Vector3,
  type Data3DTexture,
  type PerspectiveCamera,
} from 'three';
import { seconds } from '@/animations/timing';
import type { QualitySettings } from '@/config/quality';
import type { Atmosphere } from '@/engine/render/atmosphere';
import { createCloudNoise } from './cloudNoise';

/** Any size works: depth testing is off, so it only has to surround the camera. */
const RADIUS = 50;
const RENDER_ORDER = 900;

/**
 * Linear gain so the cloud comes out white after ACES. Kept below the ~2.8x
 * clip point (learnings §59) so bright and dark parts stay distinct.
 */
const GAIN = 2.1;

/** World metres per noise texture repeat. Sets the size of a cloud mass. */
const TILE_METRES = 250;
/**
 * Max ray length. The march only samples the part of the ray inside the cloud
 * layer, so every step lands in cloud. Past this distance the haze takes over.
 */
const MAX_DISTANCE = 620;
/**
 * Max step length. Long steps are safe because each step samples a matching
 * mip level. Lowering this shortens the reach and the ground shows through.
 */
const MAX_STEP = 14;
const LIGHT_STEP_METRES = 20;
const EXTINCTION = 0.095;
const LIGHT_EXTINCTION = 0.14;
/**
 * The fixed noise slice that sets how tall each cloud column grows. Any value
 * works. It drifts with the wind's vertical component so the tops change shape.
 */
const SLICE = 0.31;
/** How strongly fine noise carves the cloud edges. */
const ERODE = 0.58;

/** Density threshold between clear air and cloud. */
const THRESHOLD = 0.33;

/**
 * Frequency of the carving noise relative to the main shape. Higher values
 * make detail finer than the ray step, which shows up as speckle.
 */
const DETAIL_SCALE = 1.5;

/** Edge of the noise texture, in voxels. Mirrors `cloudNoise.ts`. */
const NOISE_SIZE = 64;

/**
 * Henyey-Greenstein asymmetry. Cloud scatters light mostly forward, which gives
 * backlit edges their bright rim.
 */
const HG = 0.62;

/** Noise drift in texture units per second. Slowly reshapes the clouds so the frame never looks frozen. */
const WIND = { x: 0.0031, y: 0.0011, z: -0.0022 } as const;

/**
 * World heights of the cloud layer's base and top. The camera starts above the
 * layer so the cloud shapes are visible, then descends through it. The layer
 * also hides the edge of the world at shallow angles.
 */
const BAND = { base: 46, top: 262 } as const;

/** Extra depth below the base so the soft underside is included in the march. */
const FEATHER = 12;

/**
 * Clearing timing in seconds: delay before clearing, clearing duration, and
 * closing duration. It clears early so the descent shows the world.
 */
const OPENING = { holds: 0.35, over: 1.7, closes: 0.55 } as const;

/** Sunlight on the tops, and sky light filling the shaded sides. */
const SUN_COLOR = 0xfff2dc;
const AMBIENT_COLOR = 0x46566e;
/** Haze colour the cloud fades into with distance. */
const HAZE_COLOR = 0x9db2c9;
const HAZE = { near: 150, far: 780 } as const;

const VERTEX = /* glsl */ `
out vec3 vWorld;

void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const FRAGMENT = /* glsl */ `
precision highp float;
precision highp sampler3D;

in vec3 vWorld;

// GLSL3 materials must declare their output. Without it the shader compiles
// but writes nothing.
layout(location = 0) out highp vec4 fragColor;

uniform sampler3D uNoise;
uniform float uTime;
uniform float uCover;
uniform float uGain;
uniform vec3 uSun;
uniform vec3 uSunColor;
uniform vec3 uAmbient;
uniform vec3 uHaze;
uniform vec2 uBand;

const float SCALE = ${(1 / TILE_METRES).toFixed(7)};
const float MAX_DISTANCE = ${MAX_DISTANCE.toFixed(1)};
const float MAX_STEP = ${MAX_STEP.toFixed(2)};
const float HAZE_NEAR = ${HAZE.near.toFixed(1)};
const float HAZE_FAR = ${HAZE.far.toFixed(1)};
const float LIGHT_STEP = ${LIGHT_STEP_METRES.toFixed(2)};
const float EXTINCTION = ${EXTINCTION.toFixed(4)};
const float LIGHT_EXTINCTION = ${LIGHT_EXTINCTION.toFixed(4)};
const float ERODE = ${ERODE.toFixed(3)};
const float SLICE = ${SLICE.toFixed(3)};
const float THRESHOLD = ${THRESHOLD.toFixed(3)};
const float DETAIL_SCALE = ${DETAIL_SCALE.toFixed(2)};
const float DETAIL_LOD = ${Math.log2(DETAIL_SCALE).toFixed(4)};
const float VOXEL_METRES = ${(TILE_METRES / NOISE_SIZE).toFixed(4)};
const float HG_G2 = ${(HG * HG).toFixed(5)};
const float HG_2G = ${(2 * HG).toFixed(5)};
const float HG_K = ${((1 - HG * HG) / (4 * Math.PI)).toFixed(6)};
const float FEATHER = ${FEATHER.toFixed(1)};
const vec3 WIND = vec3(${WIND.x.toFixed(5)}, ${WIND.y.toFixed(5)}, ${WIND.z.toFixed(5)});

// Cloud density at p. The 3D noise gives the body shape, a horizontal slice
// sets each column's height, a vertical profile tapers the base and top, and
// fine noise is subtracted from the edges for the lumpy cumulus look.
float density(vec3 p, float lod, bool carve) {
  vec3 q = p * SCALE + WIND * uTime;

  float height = clamp((p.y - uBand.x) / (uBand.y - uBand.x), 0.0, 1.0);

  // Sampled in 3D so each height has its own outline.
  float shape = textureLod(uNoise, q, lod).r;

  // Varies column height so the tops are uneven.
  float reach = textureLod(uNoise, vec3(q.x, SLICE + WIND.y * uTime, q.z), lod).r;
  float ceiling = 0.24 + reach * 0.72;

  // Thin at the base, cut off sharply at the top.
  float profile = smoothstep(0.0, 0.17, height) * (1.0 - smoothstep(ceiling - 0.13, ceiling, height));
  if (profile <= 0.0) return 0.0;

  // A wide ramp avoids hard edges, which alias with a fixed step.
  float body = smoothstep(THRESHOLD, THRESHOLD + 0.3, shape * profile);
  if (body <= 0.0) return 0.0;

  // The light march skips carving. It averages out anyway and this halves the lookups.
  if (!carve) return body;

  vec4 fine = textureLod(uNoise, q * DETAIL_SCALE, lod + DETAIL_LOD);
  float detail = fine.g * 0.5 + fine.b * 0.5;

  // Remapped so the core stays solid and only the edges get carved.
  float bite = detail * ERODE;
  return clamp((body - bite) / max(1.0 - bite, 0.05), 0.0, 1.0);
}

void main() {
  vec3 origin = cameraPosition;
  vec3 direction = normalize(vWorld - cameraPosition);

  // Where the ray enters and leaves the cloud layer.
  float low = uBand.x - FEATHER;
  float high = uBand.y;

  float near = 0.0;
  float far = MAX_DISTANCE;

  if (abs(direction.y) < 0.0005) {
    // Horizontal ray: either inside the layer the whole way or never.
    if (origin.y < low || origin.y > high) discard;
  } else {
    float a = (low - origin.y) / direction.y;
    float b = (high - origin.y) / direction.y;
    near = max(min(a, b), 0.0);
    far = min(max(a, b), MAX_DISTANCE);
    if (far <= near) discard;
  }

  // Cap the step so long horizon rays do not undersample. Cloud past the cap
  // is left to the haze.
  float stepSize = min((far - near) / float(STEPS), MAX_STEP);
  far = min(far, near + stepSize * float(STEPS));

  // Mip level matching the step size.
  float lod = max(log2(stepSize / VOXEL_METRES), 0.0);

  // Jittered start to avoid banding.
  float jitter = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
  float t = near + jitter * stepSize;

  // Angle to the sun, for the phase function.
  float mu = dot(direction, uSun);

  vec3 accumulated = vec3(0.0);
  float transmittance = 1.0;

  for (int i = 0; i < STEPS; i++) {
    vec3 p = origin + direction * t;
    float d = density(p, lod, true);

    if (d > 0.002) {
      // Sunlight reaching this sample (Beer's law over a short march toward the sun).
      float occlusion = 0.0;
      for (int j = 1; j <= LIGHT_STEPS; j++) {
        occlusion += density(p + uSun * (float(j) * LIGHT_STEP), lod + 1.0, false);
      }
      float sunlight = exp(-occlusion * LIGHT_EXTINCTION * LIGHT_STEP);

      // Forward scattering gives backlit edges their bright rim. Distant
      // samples fade into haze to show scale.
      float phase = HG_K / pow(1.0 + HG_G2 - HG_2G * mu, 1.5);

      vec3 lit = uAmbient + uSunColor * sunlight * (0.35 + phase);
      lit = mix(lit, uHaze, smoothstep(HAZE_NEAR, HAZE_FAR, t));
      float alpha = 1.0 - exp(-d * EXTINCTION * stepSize);

      accumulated += transmittance * alpha * lit;
      transmittance *= 1.0 - alpha;

      if (transmittance < 0.012) break;
    }

    t += stepSize;
  }

  // Premultiplied colour, with alpha as the actual cloud coverage, so the
  // world shows through the gaps during the descent.
  float coverage = (1.0 - transmittance) * uCover;
  fragColor = vec4(accumulated * uGain * uCover, coverage);
}
`;

/**
 * The raymarched cloud layer the presentation opens in.
 *
 * A sphere around the camera acts as the canvas. Each fragment marches a ray
 * through a world-space 3D noise field, adding light front to back with a short
 * march toward the sun for shading. World-space sampling gives real parallax as
 * the camera descends.
 *
 * It draws on top of the world with depth testing off. `clouded()` in
 * `atmosphere.ts` thickens the fog underneath, so near objects appear before
 * far ones as the cloud clears.
 */
export class CloudShell {
  private readonly noise: Data3DTexture;
  private readonly geometry = new SphereGeometry(RADIUS, 24, 16);
  private readonly material: ShaderMaterial;
  readonly mesh: Mesh;

  private tween: gsap.core.Tween | null = null;
  private elapsed = 0;

  constructor(
    private readonly air: Atmosphere,
    quality: QualitySettings,
  ) {
    this.noise = createCloudNoise();

    this.material = new ShaderMaterial({
      glslVersion: GLSL3,
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      // Defines so the loops unroll, and so the quality ladder can lower them.
      defines: {
        STEPS: String(quality.cloudSteps),
        LIGHT_STEPS: String(quality.cloudLightSteps),
      },
      uniforms: {
        uNoise: { value: this.noise },
        uTime: { value: 0 },
        uCover: { value: 1 },
        uGain: { value: GAIN },
        uSun: { value: new Vector3() },
        uSunColor: { value: new Color(SUN_COLOR) },
        uAmbient: { value: new Color(AMBIENT_COLOR) },
        uHaze: { value: new Color(HAZE_COLOR) },
        uBand: { value: new Vector2(BAND.base, BAND.top) },
      },
      transparent: true,
      // The shader outputs premultiplied colour.
      premultipliedAlpha: true,
      depthTest: false,
      depthWrite: false,
      side: BackSide,
    });

    const sun = this.material.uniforms['uSun']?.value as Vector3;
    sun.set(air.keyOffset[0], air.keyOffset[1], air.keyOffset[2]).normalize();

    this.mesh = new Mesh(this.geometry, this.material);
    // Draw last so it covers the world.
    this.mesh.renderOrder = RENDER_ORDER;
    this.mesh.frustumCulled = false;
  }

  /** Cloud cover from 0 to 1. The mesh is hidden at 0 so it costs nothing once cleared. */
  setCover(cover: number, animate: boolean): void {
    this.tween?.kill();
    this.tween = null;

    const uniform = this.material.uniforms['uCover'];
    if (!uniform) return;

    if (!animate) {
      uniform.value = cover;
      this.mesh.visible = cover > 0;
      return;
    }

    this.mesh.visible = true;
    // Clearing is slow. Closing (jumping back to the title) is quick.
    const closing = cover > (uniform.value as number);

    this.tween = gsap.to(uniform, {
      value: cover,
      duration: seconds(closing ? OPENING.closes : OPENING.over),
      delay: closing ? 0 : seconds(OPENING.holds),
      // Linear when clearing, to avoid a long plateau or a sudden snap.
      ease: closing ? 'power2.out' : 'none',
      onComplete: () => {
        this.mesh.visible = (uniform.value as number) > 0;
      },
    });
  }

  update(dt: number, camera: PerspectiveCamera, exposure: number): void {
    if (!this.mesh.visible) return;

    this.elapsed += dt;
    this.mesh.position.copy(camera.position);
    // Convert to the zone group's local space, which is offset from world space.
    this.mesh.parent?.worldToLocal(this.mesh.position);

    const { uniforms } = this.material;
    if (uniforms['uTime']) uniforms['uTime'].value = this.elapsed;

    // Cancel out scene exposure changes so the cloud stays white. Tone mapping
    // applies to everything (learnings §59), so this is done in the gain.
    if (uniforms['uGain']) {
      uniforms['uGain'].value = GAIN * (this.air.exposure / Math.max(exposure, 0.05));
    }
  }

  dispose(): void {
    this.tween?.kill();
    this.geometry.dispose();
    this.material.dispose();
    this.noise.dispose();
  }
}
