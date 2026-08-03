import {
  BufferAttribute,
  BufferGeometry,
  Float32BufferAttribute,
  Mesh,
  MeshStandardMaterial,
} from 'three';
import { lakeDepth } from './paths';
import { LAND } from './site';

export interface Lake {
  readonly object: Mesh;
  update(dt: number): void;
  dispose(): void;
}

/**
 * Margin past the nominal rectangle, sized to the shoreline noise in
 * `lakeDepth`, which bends the shore by up to 43 m in either direction.
 */
const OVERLAP = 40;

/** Metres per cell. Only has to resolve the shoreline, which is the shortest form here. */
const CELL = 7;

/**
 * The lake, east of the site, on the sightline the bridge looks down.
 *
 * Water earns its place here three times over. It is a boundary that **cannot
 * be crossed or walked around**, so it justifies open ground rather than
 * apologising for it — the one thing a lawn of the same size cannot do. It
 * **moves**, which no amount of static landscape does. And it **reflects**,
 * which means the sky arrives twice in every frame that holds it, doubling the
 * light in a composition that was previously one flat green value.
 *
 * **A clipped grid, not a plane.** It was a single quad, on the reasoning that
 * terrain above the water line would hide the parts that were not lake. That is
 * true only where the terrain is higher — and the river valley is not. Its bed
 * runs at −2.9 while the lake sits at −1.15, so a plane generous enough to
 * cover the lake's irregular shore also flooded the entire stream corridor and
 * drowned the bridge. Every vertex now carries how much lake is at that point
 * and the shore is cut in the fragment shader, so the water exists exactly
 * where the plan says it does and nowhere else.
 *
 * **No planar reflection pass.** A second render of the scene from a mirrored
 * camera is the textbook answer and it would cost roughly a second full frame
 * for a surface the camera only ever sees at a grazing angle. At grazing angles
 * the Fresnel term is near one, which means what the water shows is almost
 * entirely sky — and the sky is already in the environment map driving every
 * other material in the zone.
 *
 * The ripples are the normal, not the geometry. Displacing vertices would need
 * a tessellated surface to carry waves whose whole visible effect at 80 m is
 * how they break up the reflection.
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
  const indices: number[] = [];

  for (let column = 0; column < columns; column += 1) {
    const x = west + column * CELL;
    for (let row = 0; row < rows; row += 1) {
      const z = far + row * CELL;
      positions.push(x, lake.surface, z);
      wet.push(lakeDepth(x, z));
    }
  }

  for (let column = 0; column < columns - 1; column += 1) {
    for (let row = 0; row < rows - 1; row += 1) {
      const a = column * rows + row;
      const b = a + rows;
      indices.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('aWet', new BufferAttribute(new Float32Array(wet), 1));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();

  const material = new MeshStandardMaterial({
    // What the water is where it is not reflecting.
    //
    // This was 0x1e2f2c, chosen against a warm evening sky on the reasoning
    // that a blue lake under a low sun reads as a swimming pool. Under a midday
    // sky it read as a hole: Act I's poses look *down* at maybe 20–25°, which
    // is a 65° incidence and a Fresnel term around 0.15 — so 85% of what the
    // audience sees is this colour, not the reflection, and near-black is not
    // what 85% of a sunlit lake looks like.
    //
    // Still green rather than blue. A Nordic lake carries peat, and the blue in
    // it should arrive from the sky it is reflecting rather than be painted in.
    color: 0x2f4b46,
    roughness: 0.055,
    metalness: 0,
    envMapIntensity: 1.5,
    transparent: true,
  });

  const time = { value: 0 };

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = time;

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nattribute float aWet;\nvarying float vWet;\nvarying vec2 vRipple;',
      )
      .replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nvWet = aWet;\nvRipple = position.xz;',
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nuniform float uTime;\nvarying float vWet;\nvarying vec2 vRipple;',
      )
      .replace(
        '#include <normal_fragment_begin>',
        `#include <normal_fragment_begin>
         // Four ripple trains at incommensurable directions and rates. Fewer
         // reads as corduroy; more is invisible at this distance and costs
         // fragment time on the largest surface in the zone.
         vec2 ripple = vec2(0.0);
         ripple += vec2( 0.94,  0.34) * cos(dot(vRipple, vec2( 0.94,  0.34)) * 0.85 + uTime * 1.55) * 0.055;
         ripple += vec2(-0.42,  0.91) * cos(dot(vRipple, vec2(-0.42,  0.91)) * 1.37 + uTime * 2.10) * 0.038;
         ripple += vec2( 0.71, -0.70) * cos(dot(vRipple, vec2( 0.71, -0.70)) * 2.63 + uTime * 3.05) * 0.021;
         ripple += vec2( 0.20,  0.98) * cos(dot(vRipple, vec2( 0.20,  0.98)) * 4.11 + uTime * 4.40) * 0.011;
         normal = normalize(normal + vec3(ripple.x, 0.0, ripple.y));`,
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
         // The shore, cut here rather than left for the terrain to hide. Cut
         // hard, because a lake edge fading over metres of open water reads as
         // mist rather than as a bank.
         if (vWet < 0.02) discard;
         diffuseColor.a *= smoothstep(0.02, 0.09, vWet);`,
      );
  };

  const object = new Mesh(geometry, material);
  object.name = 'lake';
  // Water takes light but casts nothing, and receiving a shadow map on a
  // mirror surface only ever produces a hard-edged stain across the reflection.
  object.receiveShadow = false;
  object.castShadow = false;

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
