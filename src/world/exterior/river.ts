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

export interface River {
  readonly object: Mesh;
  update(dt: number): void;
  dispose(): void;
}

/**
 * Metres between sections along the stream, and quads across it.
 *
 * `ACROSS` is what the waterline's shape is made of: the ribbon fades out where
 * the terrain rises through it, so the edge can only be as fine as the rows.
 */
const STEP = 1.0;
const ACROSS = 34;

/**
 * How far light gets through the water.
 *
 * A stream is a thin absorbing layer over a bed you can see, and what says so is
 * that the *same* water is clear at the edge and dark in the channel. At the
 * 0.55 m bottom the column absorbs about three quarters.
 */
const EXTINCTION = 0.34;

/**
 * How much of a grazing reflection survives the water being transparent.
 *
 * This stream is read from two opposite geometries — down into from the bridge,
 * along from the bank — and a constant opacity has to pick one. Alpha is what
 * the reflection is multiplied by on the way out, so lifting it with the view
 * angle keeps both.
 */
const SHEEN = 0.82;

/**
 * Where the ribbon starts and stops. The east end reaches well inside the lake:
 * the ribbon is faded out against the basin rather than ending on its own
 * geometry, so it has to exist for the whole of that fade, and the bays bend the
 * shoreline it is measured from by tens of metres.
 */
const FROM = LAND.lake.west + 50;
const TO = -320;

/**
 * The stream, running west out of the lake.
 *
 * Built around depth rather than reflection: every vertex carries how deep the
 * water is above the terrain beneath it, which is what produces the most
 * recognisable thing about a real stream — pale and stony at the edges, dark in
 * the channel. The bed is shaded rather than modelled; a stony bottom under
 * 30 cm of water seen from a bridge is a value and a scatter.
 *
 * Deliberately not the lake's material — see `lake.ts`.
 */
export function createRiver(): River {
  /**
   * The ribbon is cut to `bankReach`, the whole swale, and masked back by its own
   * depth. `halfWidth` describes only the flat part of the section, and the water
   * surface crosses the bank a good way up the climb — a ribbon quoted at the
   * bed's width stops inside its own waterline, on a cut polygon edge with the
   * alpha feather never reaching zero.
   *
   * Reading `bankReach` rather than rebuilding it matters: the swale is not
   * constant. It lays back to twelve metres through the outlet so the bank can
   * meet the lake's beach at the lake's own slope.
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
    // Sections cut square to the flow, not to the x axis: slicing a 50° bend
    // along x lays down a channel half again too wide through the meander and
    // pinched on the crossings.
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
      // The stream's half of the outlet handover; the lake reads the same
      // function for the other half.
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

  const material = new MeshStandardMaterial({
    // The colour of the *water*, not of the stream: what reads as the stream's
    // colour is this laid over the bed at a thickness that varies across the
    // channel. Peat-dark, because a stream in a two-metre channel sees very
    // little sky — it sees its own banks and whatever grows over it.
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
         varying vec2 vChannel;`,
      )
      .replace(
        '#include <normal_fragment_begin>',
        `#include <normal_fragment_begin>
         // Travelling downstream rather than standing. Phased on distance along
         // the channel rather than world x, so the ripples follow the meander
         // round — keyed on x they march due west across a bend running north.
         float run = vChannel.x + uTime * 1.9;
         vec2 flow = vec2(0.0);
         flow += vec2( 0.97,  0.24) * cos(run * 1.15 + vChannel.y * 0.9) * 0.085;
         flow += vec2(-0.31,  0.95) * cos(run * 2.30 - vChannel.y * 2.1) * 0.052;
         flow += vec2( 0.80, -0.60) * cos(run * 4.70 + vChannel.y * 3.4) * 0.026;
         // Broken hardest where it is shallowest, which is where a stream runs
         // over its own bed and the only white water appears.
         float shallow = 1.0 - smoothstep(0.05, 0.55, vDepth);
         normal = normalize(normal + vec3(flow.x, 0.0, flow.y) * (0.55 + shallow * 1.6));

         // How much of the water column is in the way, by Beer's law. What says
         // "shallow" is seeing the actual ground through it; the bed underneath
         // is real terrain, gravel-textured below the water line.
         float column = 1.0 - exp(-vDepth / ${EXTINCTION.toFixed(3)});

         // Fresnel, so the surface is a mirror along the bank and a window from
         // the bridge.
         float facing = saturate(dot(normal, normalize(vViewPosition)));
         float glance = pow(1.0 - facing, 5.0);

         // Feathered at the waterline instead of ending on a cut edge: the bank
         // is uneven at a finer scale than this mesh resolves.
         float wetted = smoothstep(0.0, 0.06, vDepth);

         // Handed over to the lake at the outlet — both bodies are drawn at the
         // same level there, so only one of them may depict the water.
         diffuseColor.a =
           saturate(mix(column, 1.0, glance * ${SHEEN.toFixed(2)})) * wetted * vMouth;

         // The ribbon is cut wider than the water, so the dry swale is covered by
         // fragments that must not exist. Alpha alone will not do it: the mesh
         // writes depth, so a transparent fragment still occludes the bank.
         if (diffuseColor.a < 0.01) discard;`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
         // Water you can see the bottom of is not a mirror: broken shallow water
         // scatters, and the channel stays sharp enough to hold a reflection.
         roughnessFactor = mix(roughnessFactor, 0.55, 1.0 - smoothstep(0.04, 0.34, vDepth));

         // Nor is a grazing reflection — the reflected ray turns by twice the
         // wave slope, so looked along rather than into, the flow trains read as
         // bands. Same fix as the lake's, one notch rougher.
         //
         // vViewPosition is view space, so its y is screen vertical; multiplying
         // on the left by mat3(viewMatrix) applies the transpose and gives the
         // world direction to the eye.
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
    },
  };
}
