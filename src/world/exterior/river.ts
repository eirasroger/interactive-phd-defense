import {
  BufferAttribute,
  BufferGeometry,
  Float32BufferAttribute,
  Mesh,
  MeshStandardMaterial,
} from 'three';
import { bankReach, riverAt, riverSlope, riverSurface, streamShare } from './paths';
import { LAND } from './site';
import { surfaceAt } from './terrain';
import { createRippleTexture, RIPPLE_GLSL } from './water';

export interface River {
  readonly object: Mesh;
  update(dt: number): void;
  dispose(): void;
}

/**
 * Metres between sections along the stream, and quads across it. `ACROSS`
 * sets how fine the faded waterline edge can be.
 */
const STEP = 1.0;
const ACROSS = 34;

/**
 * Light absorption depth in metres (Beer's law). Clear at the edges, dark in
 * the channel. At the 0.55 m bottom about three quarters is absorbed.
 */
const EXTINCTION = 0.34;

/**
 * How far alpha rises toward 1 at grazing angles, so reflections survive when
 * seen along the bank while the water stays clear from the bridge.
 */
const SHEEN = 0.82;

/** Compression of the shared wave field for a channel about four metres wide. */
const CHANNEL_SCALE = 2.6;

/**
 * Ribbon extent along x. The east end reaches well into the lake so the fade
 * into the basin completes before the geometry ends.
 */
const FROM = LAND.lake.west + 50;
const TO = -320;

/**
 * The stream running west out of the lake. Each vertex stores the water depth
 * above the terrain, which drives opacity, roughness and ripple strength.
 * Uses its own material, separate from the lake's (see `lake.ts`).
 */
export function createRiver(): River {
  /**
   * The ribbon spans the whole swale (`bankReach`) and is masked by depth. The
   * waterline sits partway up the bank, past `halfWidth`, and the swale widens
   * to 12 m at the outlet.
   */
  const columns = Math.ceil((FROM - TO) / STEP) + 1;
  const positions: number[] = [];
  const uvs: number[] = [];
  const depths: number[] = [];
  const mouths: number[] = [];
  const channel: number[] = [];
  const indices: number[] = [];

  let arc = 0;
  let previous: [number, number] | null = null;

  for (let column = 0; column < columns; column += 1) {
    const along = FROM - column * STEP;
    const centre = riverAt(along);
    // Sections are cut square to the flow so the channel keeps its width
    // through bends.
    const slope = riverSlope(along);
    const scale = 1 / Math.hypot(1, slope);
    const half = bankReach(along);

    if (previous) arc += Math.hypot(along - previous[0], centre - previous[1]);
    previous = [along, centre];

    for (let row = 0; row < ACROSS; row += 1) {
      const across = ((row / (ACROSS - 1)) * 2 - 1) * half;
      const x = along - across * slope * scale;
      const z = centre + across * scale;
      const surface = riverSurface(x);

      positions.push(x, surface, z);
      uvs.push(arc * 0.25, across * 0.25);
      depths.push(Math.max(0, surface - surfaceAt(x, z)));
      // Stream share of the outlet handover. The lake uses the same function.
      mouths.push(streamShare(x, z));
      channel.push(arc, across);
    }
  }

  for (let column = 0; column < columns - 1; column += 1) {
    for (let row = 0; row < ACROSS - 1; row += 1) {
      const a = column * ACROSS + row;
      const b = a + ACROSS;
      indices.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('aDepth', new BufferAttribute(new Float32Array(depths), 1));
  geometry.setAttribute('aMouth', new BufferAttribute(new Float32Array(mouths), 1));
  geometry.setAttribute('aChannel', new BufferAttribute(new Float32Array(channel), 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  const ripples = createRippleTexture();

  const material = new MeshStandardMaterial({
    // Water colour, blended over the bed by depth. Peat-dark because a narrow
    // channel reflects its banks more than the sky.
    color: 0x22362d,
    roughness: 0.12,
    metalness: 0,
    envMapIntensity: 0.65,
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
         attribute float aDepth;
         attribute float aMouth;
         attribute vec2 aChannel;
         varying float vDepth;
         varying float vMouth;
         varying vec2 vChannel;`,
      )
      .replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nvDepth = aDepth;\nvMouth = aMouth;\nvChannel = aChannel;',
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
         uniform float uTime;
         varying float vDepth;
         varying float vMouth;
         varying vec2 vChannel;
         ${RIPPLE_GLSL}`,
      )
      .replace(
        '#include <normal_fragment_begin>',
        `#include <normal_fragment_begin>
         // Sampled in channel coordinates so ripples follow the meander, advected
         // downstream and scaled down for the narrow channel.
         vec2 flow = rippleAt(vec2(vChannel.x - uTime * 1.7, vChannel.y) * ${CHANNEL_SCALE.toFixed(2)}, uTime);
         // Stronger ripples in shallow water.
         float shallow = 1.0 - smoothstep(0.05, 0.55, vDepth);
         normal = normalize(normal + vec3(flow.x, 0.0, flow.y) * (0.20 + shallow * 0.55));

         // Water column opacity by Beer's law. The bed is the terrain, with
         // gravel texture below the waterline.
         float column = 1.0 - exp(-vDepth / ${EXTINCTION.toFixed(3)});

         // Fresnel: reflective at grazing angles, transparent from above.
         float facing = saturate(dot(normal, normalize(vViewPosition)));
         float glance = pow(1.0 - facing, 5.0);

         // Feather the waterline. The bank is finer than the mesh resolution.
         float wetted = smoothstep(0.0, 0.06, vDepth);

         // Fade out at the outlet, where the lake takes over at the same level.
         diffuseColor.a =
           saturate(mix(column, 1.0, glance * ${SHEEN.toFixed(2)})) * wetted * vMouth;

         // Discard dry fragments. The mesh writes depth, so a transparent
         // fragment would still occlude the bank.
         if (diffuseColor.a < 0.01) discard;`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
         // Shallow water is rougher. The channel stays sharp enough to reflect.
         roughnessFactor = mix(roughnessFactor, 0.55, 1.0 - smoothstep(0.04, 0.34, vDepth));

         // Rougher at grazing angles to avoid banding in reflections. Same as
         // the lake, slightly rougher. Left-multiplying by mat3(viewMatrix)
         // applies the transpose, giving the world-space direction to the eye.
         vec3 toEye = normalize(vViewPosition) * mat3(viewMatrix);
         roughnessFactor = mix(roughnessFactor, 0.42, pow(1.0 - abs(toEye.y), 3.0));`,
      );
  };

  const object = new Mesh(geometry, material);
  object.name = 'river';
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
