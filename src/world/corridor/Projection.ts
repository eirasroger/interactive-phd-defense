import gsap from 'gsap';
import {
  AdditiveBlending,
  Color,
  Group,
  Mesh,
  PlaneGeometry,
  ShaderMaterial,
  UniformsLib,
  UniformsUtils,
  Vector2,
  Vector3,
} from 'three';
import { SCREENS, type Screen } from '@/config/corridor';

const THROW = {
  spread: 1.5,
  standoff: 0.02,
  soft: 0.05,
  halo: 0.62,
  spill: 0.3,
  gain: 2.8,
  white: 0xf4f6f9,
} as const;

const STRIKE = { seconds: 0.9, ease: 'power2.out' } as const;

const VERTEX = `
varying vec2 vUv;
varying float vDepth;
void main() {
  vUv = uv;
  vec4 seen = modelViewMatrix * vec4(position, 1.0);
  vDepth = -seen.z;
  gl_Position = projectionMatrix * seen;
}
`;

const HALO_FRAGMENT = `
uniform vec3 uTint;
uniform float uLevel;
uniform vec2 uFit;
uniform vec2 uSize;
uniform float uHalo;
uniform float uSpill;
uniform vec3 fogColor;
uniform float fogNear;
uniform float fogFar;
varying vec2 vUv;
varying float vDepth;
void main() {
  vec2 d = (abs(vUv - 0.5) - uFit * 0.5) * uSize;
  float outside = length(max(d, vec2(0.0)));
  float haze = 1.0 - smoothstep(fogNear, fogFar, vDepth);
  float level = uLevel * uSpill * exp(-outside / uHalo) * haze;
  if (level < 0.002) discard;
  gl_FragColor = vec4(uTint * level, 1.0);
}
`;

const IMAGE_FRAGMENT = `
uniform vec3 uWhite;
uniform float uLevel;
uniform vec2 uSize;
uniform float uSoft;
uniform vec3 fogColor;
uniform float fogNear;
uniform float fogFar;
varying vec2 vUv;
varying float vDepth;
void main() {
  vec2 d = (abs(vUv - 0.5) - 0.5) * uSize;
  float edge = 1.0 - smoothstep(-uSoft, 0.0, max(d.x, d.y));
  float bloom = 1.0 - 0.09 * length(vUv - 0.5);
  float haze = 1.0 - smoothstep(fogNear, fogFar, vDepth);
  float alpha = edge * uLevel * haze;
  if (alpha < 0.004) discard;
  gl_FragColor = vec4(uWhite * bloom, alpha);
}
`;

export interface Projection {
  readonly object: Group;
  setProgress(progress: number, animate: boolean): void;
  setLevel(level: number): void;
  dispose(): void;
}

interface Lamp {
  readonly materials: readonly ShaderMaterial[];
  readonly lit: { level: number };
}

function place(mesh: Mesh, screen: Screen, standoff: number): void {
  const [x, y, z] = screen.centre;
  const [nx, ny, nz] = screen.normal;
  mesh.position.set(x + nx * standoff, y + ny * standoff, z + nz * standoff);
  mesh.lookAt(mesh.position.clone().add(new Vector3(nx, ny, nz)));
}

function surface(screen: Screen): { meshes: Mesh[]; lamp: Lamp } {
  const spread = new Vector2(screen.width * THROW.spread, screen.height * THROW.spread);
  const size = new Vector2(screen.width, screen.height);

  const halo = new ShaderMaterial({
    uniforms: UniformsUtils.merge([
      UniformsLib.fog,
      {
        uTint: { value: new Color(THROW.white).multiplyScalar(THROW.gain) },
        uLevel: { value: 0 },
        uFit: { value: new Vector2(1 / THROW.spread, 1 / THROW.spread) },
        uSize: { value: spread },
        uHalo: { value: THROW.halo },
        uSpill: { value: THROW.spill },
      },
    ]),
    vertexShader: VERTEX,
    fragmentShader: HALO_FRAGMENT,
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
    fog: true,
  });

  const face = new ShaderMaterial({
    uniforms: UniformsUtils.merge([
      UniformsLib.fog,
      {
        uWhite: { value: new Color(THROW.white).multiplyScalar(THROW.gain) },
        uLevel: { value: 0 },
        uSize: { value: size },
        uSoft: { value: THROW.soft },
      },
    ]),
    vertexShader: VERTEX,
    fragmentShader: IMAGE_FRAGMENT,
    transparent: true,
    depthWrite: false,
    fog: true,
  });

  const glow = new Mesh(new PlaneGeometry(spread.x, spread.y), halo);
  glow.name = `projection:${screen.key}:spill`;
  glow.renderOrder = 1;
  place(glow, screen, THROW.standoff);

  const lit = new Mesh(new PlaneGeometry(size.x, size.y), face);
  lit.name = `projection:${screen.key}`;
  lit.renderOrder = 2;
  place(lit, screen, THROW.standoff * 2);

  return { meshes: [glow, lit], lamp: { materials: [halo, face], lit: { level: 0 } } };
}

export function createProjection(): Projection {
  const object = new Group();
  object.name = 'projections';

  const lamps: Lamp[] = [];
  for (const screen of SCREENS) {
    const { meshes, lamp } = surface(screen);
    lamps.push(lamp);
    object.add(...meshes);
  }

  let drain = 1;

  const applyLevel = (): void => {
    for (const lamp of lamps) {
      for (const material of lamp.materials) {
        const uniform = material.uniforms['uLevel'];
        if (uniform) uniform.value = lamp.lit.level * drain;
      }
    }
  };

  return {
    object,

    // Dark until the deck reaches its own gallery.
    setProgress(progress, animate) {
      lamps.forEach((lamp, index) => {
        const on = progress >= index / SCREENS.length - 1e-6 ? 1 : 0;
        gsap.killTweensOf(lamp.lit);
        if (!animate || on === 0) {
          lamp.lit.level = on;
          applyLevel();
          return;
        }
        if (lamp.lit.level === 1) return;
        gsap.to(lamp.lit, {
          level: 1,
          duration: STRIKE.seconds,
          ease: STRIKE.ease,
          onUpdate: applyLevel,
        });
      });
    },

    setLevel(level) {
      drain = level;
      applyLevel();
    },

    dispose() {
      for (const lamp of lamps) {
        gsap.killTweensOf(lamp.lit);
        for (const material of lamp.materials) material.dispose();
      }
      for (const child of object.children) {
        const mesh = child as Mesh;
        if (mesh.isMesh) mesh.geometry.dispose();
      }
    },
  };
}
