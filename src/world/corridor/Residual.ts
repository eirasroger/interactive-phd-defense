import { AdditiveBlending, Color, Group, Mesh, PlaneGeometry, ShaderMaterial } from 'three';
import { RUN, SECTION } from '@/config/corridor';

/**
 * Cool, and barely a colour at all.
 *
 * The flow's teal at any visible strength washes the whole frame green, which
 * is a tint on the composition rather than depth behind it. What the field is
 * for is the sense that the slide is standing in a place, and that survives the
 * colour being taken almost all the way out.
 */
const FIELD_TINT = 0x8fb6c8;

/**
 * What the frame keeps once the figure has gone.
 *
 * Act III's remaining themes are argued in an abstract space, and a page set on
 * nothing is a page. What carries across the dissolve is the one element that
 * has been continuous since C1: the signal moving through the pipeline, with
 * the pipeline taken away from underneath it. The corridor's layout goes and
 * the movement stays, which is the difference between a backdrop that says
 * *same world, different altitude* and a backdrop that says *the 3D was
 * switched off*.
 *
 * **The ceiling is the design, not a tuning.** Drifting light is exactly where
 * cheap lives, and what makes it cheap is nameable: elements an eye can pick
 * out and follow, contrast against the ground, speed, and a loop short enough
 * to catch. Every one of those is bounded here rather than dialled in by eye —
 * two wavelengths that are each a large fraction of the frame, so there is no
 * element to follow; a hard cap on what the field may add to the ground; and
 * two drifts whose periods do not divide, so the pattern does not return inside
 * a talk. Nothing in this file may be raised past the cap to make the field
 * more visible. If it cannot be seen under the cap it should be removed.
 */
const FIELD = {
  /** The most this may add to the ground, before exposure. */
  ceiling: 0.035,
  /** Metres. Both are a large fraction of a frame ~100 m across. */
  wavelength: { long: 96, short: 37 },
  /** Metres per second. Slow enough that a still frame and a live one agree. */
  drift: { long: 1.05, short: 0.42 },
  /** How far the short layer leans across the run, so the two never align. */
  shear: 0.013,
} as const;

/** Comfortably past the frame at the overlook's distance, on both axes. */
const EXTENT = { across: 210, along: RUN + 210 } as const;

const VERTEX = `
varying float vRun;
varying float vAcross;
void main() {
  vRun = -position.z;
  vAcross = position.x;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

/** The two drifts are `wide` and `tight`: long and short are GLSL keywords. */
const FRAGMENT = `
uniform vec3 uColor;
uniform float uTime;
uniform float uLevel;
uniform float uCeiling;
uniform vec2 uWave;
uniform vec2 uDrift;
uniform float uShear;
uniform vec2 uHalf;
uniform float uMid;
varying float vRun;
varying float vAcross;
void main() {
  float wide = sin(vRun * uWave.x - uTime * uDrift.x) * 0.5 + 0.5;
  float tight = sin(vRun * uWave.y + vAcross * uShear - uTime * uDrift.y) * 0.5 + 0.5;
  float field = pow(wide * 0.58 + tight * 0.42, 1.7);
  float reach = length(vec2(vAcross / uHalf.x, (vRun - uMid) / uHalf.y));
  float held = smoothstep(1.0, 0.1, reach);
  float alpha = uCeiling * field * held * uLevel;
  if (alpha < 0.002) discard;
  gl_FragColor = vec4(uColor, alpha);
}
`;

export interface Residual {
  readonly object: Group;
  update(dt: number): void;
  /** 0 gone, 1 present. */
  setLevel(level: number): void;
  dispose(): void;
}

export function createResidual(): Residual {
  const object = new Group();
  object.name = 'residual';
  object.visible = false;

  const wave = (metres: number): number => (Math.PI * 2) / metres;

  const material = new ShaderMaterial({
    uniforms: {
      uColor: { value: new Color(FIELD_TINT) },
      uTime: { value: 0 },
      uLevel: { value: 0 },
      uCeiling: { value: FIELD.ceiling },
      uWave: { value: [wave(FIELD.wavelength.long), wave(FIELD.wavelength.short)] },
      uDrift: {
        value: [
          wave(FIELD.wavelength.long) * FIELD.drift.long,
          wave(FIELD.wavelength.short) * FIELD.drift.short,
        ],
      },
      uShear: { value: FIELD.shear },
      uHalf: { value: [EXTENT.across / 2, EXTENT.along / 2] },
      uMid: { value: RUN / 2 },
    },
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
    // Fog is sized for a corridor and this is the field the corridor left. It
    // would be hazed out by air that no longer describes anything on screen.
    fog: false,
  });

  // Baked into the vertices rather than set on the mesh: the shader reads the
  // run off `position`, and a transform held on the object leaves that
  // attribute lying flat in XY with nothing to read.
  const plane = new PlaneGeometry(EXTENT.across, EXTENT.along);
  plane.rotateX(-Math.PI / 2);
  plane.translate(0, SECTION.floor + 0.01, -RUN / 2);

  const mesh = new Mesh(plane, material);
  mesh.renderOrder = -1;
  object.add(mesh);

  let clock = 0;

  return {
    object,

    update(dt) {
      if (!object.visible) return;
      clock += dt;
      material.uniforms['uTime']!.value = clock;
    },

    setLevel(level) {
      object.visible = level > 0.004;
      material.uniforms['uLevel']!.value = level;
    },

    dispose() {
      plane.dispose();
      material.dispose();
    },
  };
}
