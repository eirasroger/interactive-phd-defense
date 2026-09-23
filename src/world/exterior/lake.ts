import {
  BufferAttribute,
  BufferGeometry,
  Float32BufferAttribute,
  Mesh,
  MeshStandardMaterial,
} from 'three';
import { lakeDepth, riverAt, riverDepth, smoothstep, streamShare } from './paths';
import { LAND } from './site';
import { surfaceAt } from './terrain';
import { createRippleTexture, RIPPLE_GLSL } from './water';

export interface Lake {
  readonly object: Mesh;
  update(dt: number): void;
  dispose(): void;
}

/** Margin past the nominal rectangle, sized to the shoreline noise in `lakeReach`. */
const OVERLAP = 40;

/**
 * Metres per cell. Sized to resolve the depth gradient at the near margin
 * (0 to 0.5 m over about 10 m).
 */
const CELL = 3.5;

/** Light extinction depth in metres. Four times the stream's value. */
const EXTINCTION = 0.7;

/** Alpha at grazing angles, 0 to 1. Keeps the sky reflection visible. */
const SHEEN = 0.88;

/** Ripple strength on the surface normal. */
const CHOP = 0.09;

/**
 * Stream outlet and its plume: a fan of rougher surface that spreads and decays
 * over `reach`. `mouth` is the half-width at the shoreline and matches the
 * flared channel, so the plume does not look like a jet.
 */
const OUTLET = { x: LAND.lake.west, z: riverAt(LAND.lake.west) } as const;
const PLUME = { reach: 95, mouth: 15, spread: 0.45, tilt: 0.08 } as const;

/** Plume strength at a point: 1 inside the plume, 0 outside. */
function plumeAt(x: number, z: number): number {
  const along = Math.max(0, x - OUTLET.x);
  const width = PLUME.mouth + along * PLUME.spread;
  const fan = 1 - smoothstep(width * 0.4, width, Math.abs(z - OUTLET.z));
  const carry = 1 - smoothstep(0, PLUME.reach, along);
  return fan * carry * carry;
}

/**
 * The lake east of the site. Each vertex stores water depth, and Beer's law
 * over it makes the margin clear and the middle reflective.
 *
 * Uses its own material: the lake is seen at grazing angles and the stream from
 * above. Reflections come from the environment map (no planar pass). Ripples
 * are in the normal only, see `water.ts`.
 */
export function createLake(): Lake {
  const { lake } = LAND;

  const west = lake.west - OVERLAP;
  const east = lake.east + OVERLAP;
  const far = lake.far - OVERLAP;
  const near = lake.near + OVERLAP;

  const columns = Math.ceil((east - west) / CELL) + 1;
  const rows = Math.ceil((near - far) / CELL) + 1;

  const positions: number[] = [];
  const wet: number[] = [];
  const depths: number[] = [];
  const plumes: number[] = [];
  const shares: number[] = [];
  const indices: number[] = [];

  for (let column = 0; column < columns; column += 1) {
    const x = west + column * CELL;
    for (let row = 0; row < rows; row += 1) {
      const z = far + row * CELL;
      positions.push(x, lake.surface, z);
      wet.push(lakeDepth(x, z));
      // Stream share scaled by channel depth, so only the outlet blends into the stream.
      shares.push(streamShare(x, z) * riverDepth(x, z));
      plumes.push(plumeAt(x, z));
      // Measured against the drawn terrain so the margin matches the visible shore.
      depths.push(Math.max(0, lake.surface - surfaceAt(x, z)));
    }
  }

  // Winding keeps the surface facing up. The order (a, b, a+1) would face -Y
  // and `FrontSide` would cull the whole lake.
  for (let column = 0; column < columns - 1; column += 1) {
    for (let row = 0; row < rows - 1; row += 1) {
      const a = column * rows + row;
      const b = a + rows;
      indices.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('aWet', new BufferAttribute(new Float32Array(wet), 1));
  geometry.setAttribute('aDepth', new BufferAttribute(new Float32Array(depths), 1));
  geometry.setAttribute('aPlume', new BufferAttribute(new Float32Array(plumes), 1));
  geometry.setAttribute('aShare', new BufferAttribute(new Float32Array(shares), 1));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();

  // Log the mean normal: a flipped winding just shows the lake bed and is easy to miss.
  const normals = geometry.getAttribute('normal');
  let facing = 0;
  for (let index = 0; index < normals.count; index += 1) facing += normals.getY(index);
  const wetted = wet.filter((value) => value > 0.02);
  console.info(
    `[exterior] lake: ${indices.length / 3} triangles, ` +
      `${wetted.length}/${wet.length} vertices wet, ` +
      `mean normal y ${(facing / normals.count).toFixed(2)}, ` +
      `deepest ${Math.max(...depths).toFixed(2)} m.`,
  );

  const ripples = createRippleTexture();

  const material = new MeshStandardMaterial({
    // Water colour, blended over the bed by depth (0 to 5 m). Peaty green; the
    // blue comes from the reflected sky.
    color: 0x1b3a34,
    roughness: 0.07,
    metalness: 0,
    envMapIntensity: 1,
    transparent: true,
    depthWrite: true,
  });

  const time = { value: 0 };

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = time;
    shader.uniforms.uRipple = { value: ripples };

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
         attribute float aWet;
         attribute float aDepth;
         attribute float aPlume;
         attribute float aShare;
         varying float vWet;
         varying float vDeep;
         varying float vPlume;
         varying float vShare;
         varying vec2 vRipple;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         vWet = aWet;
         vDeep = aDepth;
         vPlume = aPlume;
         vShare = aShare;
         vRipple = position.xz;`,
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
         uniform float uTime;
         varying float vWet;
         varying float vDeep;
         varying float vPlume;
         varying float vShare;
         varying vec2 vRipple;
         ${RIPPLE_GLSL}`,
      )
      .replace(
        '#include <normal_fragment_begin>',
        `#include <normal_fragment_begin>
         // Ripples are damped in the shallows.
         float open = 0.3 + 0.7 * smoothstep(0.05, 0.9, vDeep);
         vec2 ripple = rippleAt(vRipple, uTime) * open * ${CHOP.toFixed(2)};
         normal = normalize(normal + vec3(ripple.x, 0.0, ripple.y));

         // Outlet plume. Phase is distance from the mouth, so crests radiate outward.
         vec2 wake = vRipple - vec2(${OUTLET.x.toFixed(1)}, ${OUTLET.z.toFixed(1)});
         float away = length(wake);
         vec2 push = wake / max(away, 0.001);
         float train =
           cos(away * 0.58 - uTime * 1.35) * 0.60 +
           cos(away * 1.19 - uTime * 2.15) * 0.30;
         normal = normalize(
           normal + vec3(push.x, 0.0, push.y) * train * vPlume * ${PLUME.tilt.toFixed(2)}
         );

         // The code below needs the rippled normal, so it lives after this include.

         // Water column opacity (Beer's law).
         float column = 1.0 - exp(-vDeep / ${EXTINCTION.toFixed(3)});

         // Fresnel. Alpha scales the reflection, so raising it at grazing angles
         // keeps the sky visible in the lake.
         float facing = saturate(dot(normal, normalize(vViewPosition)));
         float glance = pow(1.0 - facing, 5.0);

         // Shore edge, feathered over the last few centimetres of depth.
         if (vWet < 0.02) discard;
         float edge = smoothstep(0.0, 0.05, vDeep) * smoothstep(0.02, 0.09, vWet);

         // Blend into the stream at the outlet. Stacked alpha covers
         // 1 - (1-a)(1-b), so the lake alpha solves 1 - (1-a*s)(1-x) = a. Exact
         // when the stream is about as opaque as the lake here.
         float water = saturate(mix(column, 1.0, glance * ${SHEEN.toFixed(2)})) * edge;
         diffuseColor.a = water * (1.0 - vShare) / max(1.0 - water * vShare, 0.02);
         if (diffuseColor.a < 0.01) discard;`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
         // Shallows are rougher; open water stays sharp.
         roughnessFactor = mix(0.42, roughnessFactor, smoothstep(0.05, 1.1, vDeep));

         // Slightly rougher at grazing angles. The view vector is rotated to
         // world space first (vector * mat3(viewMatrix) applies the transpose).
         vec3 toEye = normalize(vViewPosition) * mat3(viewMatrix);
         roughnessFactor = mix(roughnessFactor, 0.24, pow(1.0 - abs(toEye.y), 2.5));

         // The plume is matt: at viewing distance its crests are only a few pixels.
         roughnessFactor = mix(roughnessFactor, 0.30, vPlume * 0.55);`,
      );
  };

  const object = new Mesh(geometry, material);
  object.name = 'lake';
  // No shadows: a shadow map on a mirror surface shows as a hard stain.
  object.receiveShadow = false;
  object.castShadow = false;
  object.renderOrder = 1;

  return {
    object,
    update(dt: number) {
      time.value += dt;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
      ripples.dispose();
    },
  };
}
