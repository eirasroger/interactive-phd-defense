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

export interface Lake {
  readonly object: Mesh;
  update(dt: number): void;
  dispose(): void;
}

/** Margin past the nominal rectangle, sized to the shoreline noise in `lakeReach`. */
const OVERLAP = 40;

/**
 * Metres per cell. Sized by the depth gradient rather than the shoreline: the
 * near margin goes from nothing to half a metre in about ten metres, and the
 * whole read hangs off it.
 */
const CELL = 3.5;

/**
 * How far light gets through the water. Four times the stream's, which is the
 * difference between a body you see a little way into at its margin and a
 * window onto gravel.
 */
const EXTINCTION = 0.7;

/** How much of a grazing reflection survives the water being transparent. */
const SHEEN = 0.9;

/**
 * How hard the ripple trains tilt the surface.
 *
 * At a grazing angle the reflected ray moves by twice the surface tilt, so a few
 * degrees of wave slope sweeps ten or fifteen degrees of sky. Against a
 * panorama with cloud in it, four coherent sinusoids at full amplitude read as
 * corduroy. The honest fix is a broadband spectrum — a normal map and a second
 * texture; damping costs nothing and lands in the same place from every pose in
 * the act, none of which is closer than thirty metres.
 */
const CHOP = 0.6;

/**
 * Where the stream discharges, and how far its current survives.
 *
 * The lake carries the flow because nothing else can: the ribbon hands over
 * across eighteen metres of shoreline, and the two sheets are coplanar and both
 * write depth, so the overlap cannot be lengthened without the sort order
 * deciding which is drawn. The plume is a fan out of the outlet in which the
 * surface is disturbed and rougher, spreading and decaying over `reach`.
 *
 * `mouth` is the half-width at the shoreline and is the *flared* channel's — a
 * plume narrower than the mouth discharging it reads as a jet.
 */
const OUTLET = { x: LAND.lake.west, z: riverAt(LAND.lake.west) } as const;
const PLUME = { reach: 95, mouth: 15, spread: 0.45, tilt: 0.09 } as const;

/** How much of the outlet's current is at this point: 1 in it, 0 clear of it. */
function plumeAt(x: number, z: number): number {
  const along = Math.max(0, x - OUTLET.x);
  const width = PLUME.mouth + along * PLUME.spread;
  const fan = 1 - smoothstep(width * 0.4, width, Math.abs(z - OUTLET.z));
  // Squared, so it goes rather than trailing a faint disturbance across half the
  // basin.
  const carry = 1 - smoothstep(0, PLUME.reach, along);
  return fan * carry * carry;
}

/**
 * The lake, east of the site, on the sightline the bridge looks down.
 *
 * **Depth is the subject.** Every vertex carries how deep the water is above the
 * terrain beneath it, and Beer's law over that is what makes it a body of water
 * rather than a sheet of paint: the margin is clear over the stream's gravel, the
 * middle is closed and mirrors the sky.
 *
 * Deliberately not the stream's material. The two are seen from opposite
 * geometries — the lake at grazing angles across a hundred metres where Fresnel
 * is near one, the stream from directly above where it is near zero — and one
 * material tuned for both reads as neither.
 *
 * **No planar reflection pass.** A second render from a mirrored camera costs
 * roughly a full frame for a surface only ever seen at grazing angles, where
 * what the water shows is almost entirely sky — and the sky is already in the
 * environment map. The ripples are the normal, not the geometry.
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
      // The lake's half of the outlet handover: the stream's share scaled by how
      // much channel section is here, so the ordinary shoreline keeps its hard
      // cut and only the outlet is handed over.
      shares.push(streamShare(x, z) * riverDepth(x, z));
      plumes.push(plumeAt(x, z));
      // Against the *drawn* terrain, not the height function, so the margin is
      // exactly where the bed rises through the surface on screen.
      depths.push(Math.max(0, lake.surface - surfaceAt(x, z)));
    }
  }

  // Wound so the surface faces **up**: columns advance in +X and rows in +Z, so
  // taking them as (a, b, a+1) puts the cross product at −Y and `FrontSide`
  // discards the whole body of water.
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

  // Mean normal is reported because a flipped winding is invisible — what you
  // see instead of the lake is the lake bed, which is where a lake should be.
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

  const material = new MeshStandardMaterial({
    // The colour of the *water*, not of the lake: what reads as the lake's
    // colour is this laid over its own bed at a thickness varying from nothing
    // at the beach to five metres in the middle. Green rather than blue — a
    // Nordic lake carries peat, and the blue arrives from the sky it reflects.
    color: 0x22423c,
    // Not quite a mirror. At 0.055 the reflection samples the sharpest level of
    // the environment, which turns each ripple train into a band once the sky
    // has edges in it. Grazing views widen it much further — see below.
    roughness: 0.09,
    metalness: 0,
    envMapIntensity: 1.2,
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
         varying vec2 vRipple;`,
      )
      .replace(
        '#include <normal_fragment_begin>',
        `#include <normal_fragment_begin>
         // Four ripple trains at incommensurable directions and rates. Fewer
         // reads as corduroy; more is invisible at this distance.
         //
         // Damped in the shallows, because open water is worked by the whole
         // fetch of the lake and a beach is not. Faded with distance too: the
         // wavelength is about seven metres, under a pixel across the far half
         // of the basin, and what a sub-pixel period draws is its own moire.
         float open = smoothstep(0.05, 0.9, vDeep);
         float lively = 1.0 - smoothstep(45.0, 150.0, length(vViewPosition));
         vec2 ripple = vec2(0.0);
         ripple += vec2( 0.94,  0.34) * cos(dot(vRipple, vec2( 0.94,  0.34)) * 0.85 + uTime * 1.55) * 0.055;
         ripple += vec2(-0.42,  0.91) * cos(dot(vRipple, vec2(-0.42,  0.91)) * 1.37 + uTime * 2.10) * 0.038;
         ripple += vec2( 0.71, -0.70) * cos(dot(vRipple, vec2( 0.71, -0.70)) * 2.63 + uTime * 3.05) * 0.021;
         ripple += vec2( 0.20,  0.98) * cos(dot(vRipple, vec2( 0.20,  0.98)) * 4.11 + uTime * 4.40) * 0.011;
         normal = normalize(normal + vec3(ripple.x, 0.0, ripple.y) * (0.25 + open * 0.75) * lively * ${CHOP.toFixed(2)});

         // The outlet's plume, riding on the standing trains. Phase is distance
         // from the mouth, so crests radiate and the wake reads as spreading
         // rather than as a second set of waves pointing east.
         //
         // Not damped by 'open': a current is roughest where it is shallowest,
         // which is the argument for damping the others and against damping this.
         vec2 wake = vRipple - vec2(${OUTLET.x.toFixed(1)}, ${OUTLET.z.toFixed(1)});
         float away = length(wake);
         vec2 push = wake / max(away, 0.001);
         float train =
           cos(away * 0.58 - uTime * 1.35) * 0.60 +
           cos(away * 1.19 - uTime * 2.15) * 0.30;
         normal = normalize(
           normal + vec3(push.x, 0.0, push.y) * train * vPlume * lively * ${PLUME.tilt.toFixed(2)}
         );

         // Everything below wants the rippled normal, so it lives here rather
         // than at the map stage: normal does not exist until this include has
         // run, and asking earlier fails to compile.

         // How much of the water column is in the way, by Beer's law.
         float column = 1.0 - exp(-vDeep / ${EXTINCTION.toFixed(3)});

         // Fresnel, so the margin is a window and the far water is a mirror.
         // Alpha multiplies the reflection on the way out, so lifting it here is
         // what keeps the sky in the lake at grazing angles.
         float facing = saturate(dot(normal, normalize(vViewPosition)));
         float glance = pow(1.0 - facing, 5.0);

         // The shore, feathered over the last handspan of depth rather than over
         // metres of open water — a lake edge that fades across its own surface
         // reads as mist rather than as a bank.
         if (vWet < 0.02) discard;
         float edge = smoothstep(0.0, 0.05, vDeep) * smoothstep(0.02, 0.09, vWet);

         // Handed over to the stream at the outlet, on the same function the
         // stream fades in on.
         //
         // **Not a plain scale by one minus the share.** Alpha does not add: two
         // layers at a and b cover 1 - (1-a)(1-b), so complementary weights leave
         // a gap that widens toward the middle of the band. Solving
         // 1 - (1-a*s)(1-x) = a for the lake's share gives the divide below,
         // exact whenever the stream is about as opaque here as the lake is.
         float water = saturate(mix(column, 1.0, glance * ${SHEEN.toFixed(2)})) * edge;
         diffuseColor.a = water * (1.0 - vShare) / max(1.0 - water * vShare, 0.02);
         if (diffuseColor.a < 0.01) discard;`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
         // Water you can see the bottom of is not a mirror: the shallows scatter
         // off their own bed while open water stays sharp enough to carry sky.
         roughnessFactor = mix(0.45, roughnessFactor, smoothstep(0.05, 1.1, vDeep));

         // Nor is a grazing reflection. At ten degrees above the water a couple
         // of degrees of ripple sweeps a sixth of the sky, so every train comes
         // back as a band. Widening the lobe with the view angle is what the
         // surface physically does — at grazing incidence a microfacet
         // distribution is masked into a much broader one.
         //
         // Read off the geometric view vector, not the rippled normal, and
         // rotated into world space first: vViewPosition is view space, so its y
         // is screen vertical rather than up. Left-multiplying by mat3(viewMatrix)
         // applies the transpose, giving the world direction to the eye.
         vec3 toEye = normalize(vViewPosition) * mat3(viewMatrix);
         float graze = 1.0 - abs(toEye.y);
         roughnessFactor = mix(roughnessFactor, 0.34, pow(graze, 2.5));

         // A current is not a mirror at all. At the distance every pose sees this
         // from, an individual crest is a couple of pixels and the only
         // resolvable thing about the flow is that it is matt.
         roughnessFactor = mix(roughnessFactor, 0.30, vPlume * 0.55);`,
      );
  };

  const object = new Mesh(geometry, material);
  object.name = 'lake';
  // Water takes light but casts nothing, and a shadow map on a mirror surface is
  // a hard-edged stain across the reflection.
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
