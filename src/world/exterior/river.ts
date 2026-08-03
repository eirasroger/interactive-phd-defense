import {
  BufferAttribute,
  BufferGeometry,
  Float32BufferAttribute,
  Mesh,
  MeshStandardMaterial,
} from 'three';
import { riverAt, riverSlope, riverSurface } from './paths';
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
 * `ACROSS` is what the waterline's shape is made of. The ribbon fades out where
 * the terrain rises through it, so the edge can only be as fine as the rows are
 * spaced — at ten rows over a 5.8 m section that is 64 cm, and the waterline
 * came out as a visibly faceted polygon rather than as an edge.
 */
const STEP = 1.0;
const ACROSS = 34;

/**
 * How far light gets through the water, in metres.
 *
 * The whole read now hangs off this. A stream is not a coloured surface, it is
 * a thin absorbing layer over a bed you can see, and the one thing that says so
 * is that the *same* water is clear at the edge and dark in the middle. Beer's
 * law gives that for free from the depth already at every vertex: at the 0.55 m
 * channel bottom the column absorbs about three quarters, and the last handspan
 * against the bank absorbs almost nothing.
 */
const EXTINCTION = 0.34;

/**
 * How much of a grazing reflection survives the water being transparent.
 *
 * The two readings of this stream are from opposite geometries — looked down
 * into from the bridge, where Fresnel is near zero and the bed is the subject,
 * and looked along from the bank, where it is near one and the surface is a
 * mirror. A constant opacity has to pick one and loses the other. Lifting alpha
 * with the view angle keeps both, because alpha is what the reflection is
 * multiplied by on the way out.
 */
const SHEEN = 0.82;

/** Where the ribbon starts and stops. East end reaches into the lake it issues from. */
const FROM = LAND.lake.west + 14;
const TO = -320;

/**
 * The stream, running west out of the lake.
 *
 * Deliberately **not** the lake's material, and that is the whole design. The
 * two are seen from opposite geometries: the lake is read at grazing angles
 * across a hundred metres, where Fresnel is near one and what you see is almost
 * entirely reflected sky; the river is read from a bridge directly above it,
 * where Fresnel is near zero and what you see is the bed *through* the surface.
 * One material tuned for both would land on a compromise that reads as neither.
 *
 * So this one is built around depth rather than around reflection. Every vertex
 * carries how deep the water is above the terrain beneath it, which is what
 * produces the single most recognisable thing about a real stream: it goes pale
 * and stony at the edges and dark in the channel, and the transition is where
 * the eye reads that it is shallow enough to see into.
 *
 * The bed is shaded rather than modelled. A stony bottom under 30 cm of water,
 * seen from a bridge in motion, is a value and a scatter — not a mesh, and
 * certainly not one worth resolving on a terrain grid sized for a 33 m swale.
 */
export function createRiver(): River {
  const { river } = LAND;
  /**
   * The ribbon is cut to the **whole swale**, not to the channel's nominal
   * half-width, and is then masked back by its own depth.
   *
   * `halfWidth` is a statement about the bed, and the bed is only the flat part
   * of the section — past it the ground climbs to the bank top over `swale`
   * metres, and it crosses the water surface a good way up that climb. A ribbon
   * quoted at the bed's width therefore stopped *inside* its own waterline: the
   * water was still 47 cm deep where the mesh ended, so it terminated on a cut
   * polygon edge with the alpha feather never reaching zero, and the real
   * waterline — the line where the terrain rises through the surface — was
   * never drawn anywhere.
   *
   * Cutting wide and masking on depth makes the edge a *measurement of the
   * ground* rather than a claim about it, which is `learnings.md` §9's
   * corollary: a per-vertex mask says where the surface is, a boundary chosen
   * to be hidden by something else says only where that something else happens
   * to be today.
   */
  const half = river.halfWidth + river.swale;

  const columns = Math.ceil((FROM - TO) / STEP) + 1;
  const positions: number[] = [];
  const uvs: number[] = [];
  const depths: number[] = [];
  const channel: number[] = [];
  const indices: number[] = [];

  let arc = 0;
  let previous: [number, number] | null = null;

  for (let column = 0; column < columns; column += 1) {
    const along = FROM - column * STEP;
    const centre = riverAt(along);
    // Sections cut square to the flow, not to the x axis. Slicing a 50° bend
    // along x would lay down a channel half again too wide through the meander
    // and pinched on the crossings — the inverse of a river's actual plan.
    const slope = riverSlope(along);
    const scale = 1 / Math.hypot(1, slope);

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
  geometry.setAttribute('aChannel', new BufferAttribute(new Float32Array(channel), 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  const material = new MeshStandardMaterial({
    // Peat-dark and green, and darker than it looks written down.
    //
    // It was 0x3a5c52 at 0.09 roughness against a full-strength environment,
    // which is a mirror finish on a mid-green — so the ribbon returned the sky
    // almost exactly and came out as a bright turquoise stripe lying on a green
    // park. That reads as poster paint from every distance in the act.
    //
    // A stream in a two-metre channel sees very little sky: it sees its own
    // banks, which are dark green, and the underside of whatever is growing
    // over it. The reflection is therefore both dimmer and duller than an open
    // water surface, and the *ratio* of albedo to environment is the whole read
    // rather than either value on its own.
    //
    // This is now the colour of the *water*, not of the stream. What the eye
    // reads as the stream's colour is this laid over the bed at a thickness
    // that varies across the channel, which is why the flat version could never
    // work however it was graded: an opaque sheet has one colour by
    // construction, and the thing being drawn has a different one everywhere.
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
         attribute vec2 aChannel;
         varying float vDepth;
         varying vec2 vChannel;`,
      )
      .replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nvDepth = aDepth;\nvChannel = aChannel;',
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
         uniform float uTime;
         varying float vDepth;
         varying vec2 vChannel;`,
      )
      .replace(
        '#include <normal_fragment_begin>',
        `#include <normal_fragment_begin>
         // Travelling downstream rather than standing. A stream whose ripples
         // sit still is a puddle, and direction is most of what says which way
         // the water is going without any motion of the mesh itself.
         //
         // Phased on distance along the channel rather than on world x, so the
         // ripples follow the meander round. Keyed on x they would march due
         // west across a bend running north, which reads as wind on a pond.
         float run = vChannel.x + uTime * 1.9;
         vec2 flow = vec2(0.0);
         flow += vec2( 0.97,  0.24) * cos(run * 1.15 + vChannel.y * 0.9) * 0.085;
         flow += vec2(-0.31,  0.95) * cos(run * 2.30 - vChannel.y * 2.1) * 0.052;
         flow += vec2( 0.80, -0.60) * cos(run * 4.70 + vChannel.y * 3.4) * 0.026;
         // Broken hardest where it is shallowest, which is where a real stream
         // runs over its own bed and where the only white water appears.
         float shallow = 1.0 - smoothstep(0.05, 0.55, vDepth);
         normal = normalize(normal + vec3(flow.x, 0.0, flow.y) * (0.55 + shallow * 1.6));

         // How much of the water column is in the way, by Beer's law.
         //
         // This replaces a constant opacity and a painted-on bed, and the two
         // faults it removes are the same fault: a stream drawn as an opaque
         // surface has to *depict* being shallow, and every attempt to do that
         // — a stone colour mixed in near the edge, a paler shading across the
         // channel — reads as a puddle, because what says "shallow" is seeing
         // the actual ground through it and nothing else does.
         //
         // The bed underneath is real terrain, gravel-textured wherever it sits
         // below the water line, so there is nothing left to fake.
         float column = 1.0 - exp(-vDepth / ${EXTINCTION.toFixed(3)});

         // Fresnel, so the surface is a mirror along the bank and a window from
         // the bridge. Alpha multiplies the reflection on the way out, so
         // lifting it here is what keeps the sky in the water at grazing angles
         // without making the channel opaque when looked into.
         float facing = saturate(dot(normal, normalize(vViewPosition)));
         float glance = pow(1.0 - facing, 5.0);

         // Feathered at the waterline instead of ending on a cut edge. The bank
         // is uneven at a finer scale than this mesh resolves, so a hard
         // boundary would read as a sheet laid over the ground.
         float wetted = smoothstep(0.0, 0.06, vDepth);
         diffuseColor.a = saturate(mix(column, 1.0, glance * ${SHEEN.toFixed(2)})) * wetted;

         // The ribbon is cut wider than the water and masked back to it, so the
         // dry part of the swale is covered by fragments that must not exist.
         // Alpha alone will not do it: the mesh writes depth, so a transparent
         // fragment over dry ground still occludes the bank behind it.
         if (diffuseColor.a < 0.01) discard;`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
         // Water you can see the bottom of is not a mirror. Broken shallow
         // water scatters, so it goes rough over the shallows and stays sharp
         // in the channel where it is deep enough to hold a reflection.
         roughnessFactor = mix(roughnessFactor, 0.55, 1.0 - smoothstep(0.04, 0.34, vDepth));`,
      );
  };

  const object = new Mesh(geometry, material);
  object.name = 'river';
  object.receiveShadow = false;
  object.castShadow = false;
  // Shallow water under a canopy takes a shadow map as a hard stain across the
  // reflection, for the same reason the lake refuses one.
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
