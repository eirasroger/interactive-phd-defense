import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  Points,
  ShaderMaterial,
} from 'three';

export interface PointCloudOptions {
  readonly count: number;
  /** Target position for point `i`. Defines the resolved formation. */
  readonly formation: (index: number, total: number) => [number, number, number];
  readonly color: number;
  readonly size?: number;
  /** Radius of the scattered starting cloud. */
  readonly scatter?: number;
}

export interface PointCloud {
  readonly object: Points;
  /** 0 = scattered and uncertain, 1 = resolved into the formation. */
  setProgress(value: number): void;
  update(elapsed: number): void;
  dispose(): void;
}

const VERTEX = /* glsl */ `
  uniform float uProgress;
  uniform float uSize;
  uniform float uTime;
  uniform float uPixelRatio;

  attribute vec3 aScatter;
  attribute float aSeed;

  varying float vAlpha;

  void main() {
    // Points resolve at slightly different rates, so the formation assembles
    // as a gradient rather than snapping into place all at once.
    float stagger = smoothstep(0.0, 1.0, clamp(uProgress * 1.6 - aSeed * 0.6, 0.0, 1.0));

    vec3 drift = vec3(
      sin(uTime * 0.28 + aSeed * 6.283),
      cos(uTime * 0.21 + aSeed * 4.712),
      sin(uTime * 0.17 + aSeed * 2.094)
    ) * (1.0 - stagger) * 0.34;

    vec3 pos = mix(aScatter, position, stagger) + drift;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = uSize * uPixelRatio * (14.0 / -mvPosition.z);

    // Unresolved points read as dimmer: uncertainty is literally less defined.
    vAlpha = mix(0.18, 0.72, stagger);
  }
`;

const FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  varying float vAlpha;

  void main() {
    float d = length(gl_PointCoord - vec2(0.5));
    if (d > 0.5) discard;
    float falloff = smoothstep(0.5, 0.0, d);
    gl_FragColor = vec4(uColor, falloff * vAlpha);
  }
`;

/**
 * An instanced field of points that interpolates between a scattered cloud and
 * a declared formation.
 *
 * The interpolation happens on the GPU, so tens of thousands of points cost
 * one draw call and no per-frame CPU work. This is the visual vocabulary for
 * uncertainty becoming an informed result, so it is a shared primitive rather
 * than something each scene reimplements.
 */
export function createPointCloud(options: PointCloudOptions): PointCloud {
  const { count, formation, color, size = 9, scatter = 14 } = options;

  const positions = new Float32Array(count * 3);
  const scattered = new Float32Array(count * 3);
  const seeds = new Float32Array(count);

  for (let i = 0; i < count; i += 1) {
    const [x, y, z] = formation(i, count);
    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;

    // Uniform distribution inside a sphere, so the cloud has no visible seams.
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const radius = scatter * Math.cbrt(Math.random());
    scattered[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
    scattered[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta) * 0.5;
    scattered[i * 3 + 2] = radius * Math.cos(phi);

    seeds[i] = Math.random();
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('aScatter', new BufferAttribute(scattered, 3));
  geometry.setAttribute('aSeed', new BufferAttribute(seeds, 1));

  const material = new ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    uniforms: {
      uProgress: { value: 0 },
      uSize: { value: size },
      uTime: { value: 0 },
      uColor: { value: new Color(color) },
      uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
    },
  });

  const object = new Points(geometry, material);
  object.frustumCulled = false;

  return {
    object,
    setProgress(value) {
      material.uniforms['uProgress']!.value = value;
    },
    update(elapsed) {
      material.uniforms['uTime']!.value = elapsed;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}
