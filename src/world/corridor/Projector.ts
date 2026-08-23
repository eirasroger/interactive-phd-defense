import gsap from 'gsap';
import {
  AdditiveBlending,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshStandardMaterial,
  ShaderMaterial,
  UniformsLib,
  UniformsUtils,
  Vector3,
} from 'three';
import { SCREENS, SHOT_DISTANCE, stationProgress, type Screen } from '@/config/corridor';

const RIG = {
  behind: 1.3,
  clearance: 0.62,
  body: { width: 0.34, height: 0.17, depth: 0.26 },
  stem: { radius: 0.022 },
  lens: { radius: 0.052, depth: 0.04 },
  mouth: 0.05,
  // Stops short of the wall so it never draws over the image.
  stopShort: 0.34,
  beam: { level: 0.22, tint: 0xdbe6f2 },
} as const;

const BODY = { color: 0x14171c, roughness: 0.42, metalness: 0.55 } as const;
const LENS = { color: 0x0a0c0f, roughness: 0.12, metalness: 0.2 } as const;

const BEAM_VERTEX = `
attribute float aU;
attribute float aV;
varying float vU;
varying float vV;
varying float vDepth;
void main() {
  vU = aU;
  vV = aV;
  vec4 seen = modelViewMatrix * vec4(position, 1.0);
  vDepth = -seen.z;
  gl_Position = projectionMatrix * seen;
}
`;

const BEAM_FRAGMENT = `
uniform vec3 uTint;
uniform float uLevel;
uniform vec3 fogColor;
uniform float fogNear;
uniform float fogFar;
varying float vU;
varying float vV;
varying float vDepth;
void main() {
  float across = 1.0 - vU * vU;
  float along = smoothstep(0.0, 0.3, vV) * (1.0 - smoothstep(0.55, 1.0, vV));
  float haze = 1.0 - smoothstep(fogNear, fogFar, vDepth);
  float level = uLevel * across * across * along * haze;
  if (level < 0.002) discard;
  gl_FragColor = vec4(uTint * level, 1.0);
}
`;

export interface Projector {
  readonly object: Group;
  setProgress(progress: number, animate: boolean): void;
  setLevel(level: number): void;
  dispose(): void;
}

function shaft(width: number, height: number, reach: number, lift: number): BufferGeometry {
  const mouth = { x: (width * RIG.mouth) / 2, y: (height * RIG.mouth) / 2 };

  const t = 1 - RIG.stopShort;
  const lerp = (a: number, b: number): number => a + (b - a) * t;
  const far = {
    x: lerp(mouth.x, width / 2),
    y: lerp(lift - mouth.y, -height / 2),
    z: reach * RIG.stopShort,
  };

  const positions = new Float32Array([
    -mouth.x, lift - mouth.y, reach,
    mouth.x, lift - mouth.y, reach,
    -far.x, far.y, far.z,
    far.x, far.y, far.z,
  ]);

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('aU', new BufferAttribute(new Float32Array([-1, 1, -1, 1]), 1));
  geometry.setAttribute('aV', new BufferAttribute(new Float32Array([0, 0, 1, 1]), 1));
  geometry.setIndex([0, 2, 1, 1, 2, 3]);
  geometry.computeBoundingSphere();
  return geometry;
}

// lookAt puts local +z on the target, so +z is the wall normal.
function seat(object: Mesh, screen: Screen, out: number, up: number): void {
  const [cx, cy, cz] = screen.centre;
  const [nx, ny, nz] = screen.normal;
  object.position.set(cx + nx * out, cy + ny * out + up, cz + nz * out);
  object.lookAt(object.position.clone().add(new Vector3(nx, ny, nz)));
}

export function createProjector(): Projector {
  const object = new Group();
  object.name = 'projectors';

  const geometries: BufferGeometry[] = [];
  const beams: ShaderMaterial[] = [];
  const lit = SCREENS.map(() => ({ level: 0 }));
  let drain = 1;

  const body = new MeshStandardMaterial(BODY);
  const glass = new MeshStandardMaterial(LENS);
  const materials: (MeshStandardMaterial | ShaderMaterial)[] = [body, glass];

  const reach = SHOT_DISTANCE + RIG.behind;

  for (const screen of SCREENS) {
    const lift = screen.height / 2 + RIG.clearance;

    const housing = new Mesh(new BoxGeometry(RIG.body.width, RIG.body.height, RIG.body.depth), body);
    housing.name = `projector:${screen.key}`;
    seat(housing, screen, reach, lift);
    geometries.push(housing.geometry);

    const barrel = new Mesh(
      new CylinderGeometry(RIG.lens.radius, RIG.lens.radius, RIG.lens.depth, 12),
      glass,
    );
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0, -(RIG.body.depth / 2 + RIG.lens.depth / 2));
    housing.add(barrel);
    geometries.push(barrel.geometry);

    const drop = screen.ceiling - (screen.centre[1] + lift) - RIG.body.height / 2;
    if (drop > 0.02) {
      const rod = new Mesh(new CylinderGeometry(RIG.stem.radius, RIG.stem.radius, drop, 8), body);
      rod.position.set(0, RIG.body.height / 2 + drop / 2, 0);
      housing.add(rod);
      geometries.push(rod.geometry);
    }

    const air = new ShaderMaterial({
      uniforms: UniformsUtils.merge([
        UniformsLib.fog,
        { uTint: { value: new Color(RIG.beam.tint) }, uLevel: { value: 0 } },
      ]),
      vertexShader: BEAM_VERTEX,
      fragmentShader: BEAM_FRAGMENT,
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
      side: DoubleSide,
      fog: true,
    });
    beams.push(air);
    materials.push(air);

    const geometry = shaft(screen.width, screen.height, reach, lift);
    const beam = new Mesh(geometry, air);
    beam.name = `projector:${screen.key}:beam`;
    beam.renderOrder = 0;
    seat(beam, screen, 0, 0);
    geometries.push(geometry);

    object.add(housing, beam);
  }

  const apply = (): void => {
    beams.forEach((air, index) => {
      const uniform = air.uniforms['uLevel'];
      if (uniform) uniform.value = RIG.beam.level * (lit[index]?.level ?? 0) * drain;
    });
  };

  return {
    object,

    setProgress(progress, animate) {
      lit.forEach((beam, index) => {
        const on = progress >= stationProgress(index) - 1e-6 ? 1 : 0;
        gsap.killTweensOf(beam);
        if (!animate || on === 0) {
          beam.level = on;
          apply();
          return;
        }
        if (beam.level === 1) return;
        gsap.to(beam, { level: 1, duration: 0.9, ease: 'power2.out', onUpdate: apply });
      });
    },

    setLevel(level) {
      drain = level;
      object.visible = level > 0.02;
      apply();
    },

    dispose() {
      for (const beam of lit) gsap.killTweensOf(beam);
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
    },
  };
}
