import {
  Color,
  FrontSide,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
} from 'three';
import { HILL_PLOTS, outcropAt } from './paths';
import { OUTCROP } from './site';
import { surfaceAt } from './terrain';

export interface StoneField {
  readonly object: InstancedMesh;
  dispose(): void;
}

/**
 * Where one stone goes.
 *
 * `squat` flattens it and `sit` says how far its centre stands above the ground
 * as a fraction of its size — negative to bury it. A boulder lying on a bank and
 * a slab of bedrock breaking the surface of a hill are the same object with
 * different values of those two.
 */
export type PlaceStone = (
  x: number,
  z: number,
  size: number,
  squat: number,
  sit: number,
) => void;

/**
 * A field of granite, instanced.
 *
 * Procedural rather than scanned. A stone is a convex lump, and a jittered
 * icosahedron at 20 triangles is indistinguishable from a 40 000-triangle
 * photogrammetry scan at every distance either of these is seen from — while the
 * scan that was rejected for the asset list was 96 MB on its own.
 *
 * The caller owns the scatter and this owns the object, so the bank's boulders
 * and the knoll's outcrop are one piece of code and two plans.
 */
export function createStones(
  name: string,
  tone: string,
  random: () => number,
  scatter: (place: PlaceStone) => void,
): StoneField {
  const geometry = new IcosahedronGeometry(1, 1);
  const position = geometry.getAttribute('position');
  const lump = new Vector3();

  for (let i = 0; i < position.count; i += 1) {
    lump.fromBufferAttribute(position, i);
    lump.multiplyScalar(0.74 + random() * 0.5);
    lump.y *= 0.72;
    position.setXYZ(i, lump.x, lump.y, lump.z);
  }
  geometry.computeVertexNormals();

  // Warm-neutral rather than a true grey, and darker than granite looks in the
  // hand. A neutral albedo under a blue sky takes the sky's colour straight to
  // the eye, and against ground whose own albedo the terrain shader has already
  // multiplied down to a fraction of it, stone at its nominal value does not
  // read as stone — it reads as ice.
  const material = new MeshStandardMaterial({
    color: new Color(tone),
    roughness: 0.92,
    metalness: 0,
    side: FrontSide,
  });

  const transforms: Matrix4[] = [];
  const matrix = new Matrix4();
  const spin = new Quaternion();
  const axis = new Vector3();
  const scale = new Vector3();
  const seat = new Vector3();

  scatter((x, z, size, squat, sit) => {
    axis.set(random() - 0.5, random() - 0.5, random() - 0.5).normalize();
    spin.setFromAxisAngle(axis, random() * Math.PI);
    scale.set(
      size,
      size * squat * (0.6 + random() * 0.5),
      size * (0.8 + random() * 0.5),
    );
    seat.set(x, surfaceAt(x, z) + size * sit, z);
    transforms.push(matrix.clone().compose(seat, spin, scale));
  });

  const mesh = new InstancedMesh(geometry, material, transforms.length);
  transforms.forEach((transform, i) => mesh.setMatrixAt(i, transform));
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.name = name;

  return {
    object: mesh,
    dispose() {
      geometry.dispose();
      material.dispose();
      mesh.dispose();
    },
  };
}

/**
 * The hills' bedrock, where it breaks the surface.
 *
 * Scattered by `outcropAt`, which is the same function the ground shades from —
 * so a slab can only stand where the turf has already given way, and the two
 * agree because they read one number rather than because they were tuned to
 * match. Retune the hill and both follow it.
 *
 * Squat and sunk: what is being drawn is the top of the rock the hill is made
 * of, and a boulder shape standing proud reads as something that rolled there.
 */
export function createOutcrop(): StoneField {
  let seed = 0x5cd21b;
  const random = (): number => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0x100000000;
  };

  return createStones('outcrop', OUTCROP.tone, random, (place) => {
    for (const plot of HILL_PLOTS) {
      const [cx, cz] = plot.centre;
      const attempts = Math.round((plot.area / 10000) * OUTCROP.perHectare);

      for (let attempt = 0; attempt < attempts; attempt += 1) {
        const x = cx + (random() * 2 - 1) * plot.reach;
        const z = cz + (random() * 2 - 1) * plot.reach;

        if (random() > outcropAt(x, z)) continue;

        const [min, max] = OUTCROP.size;
        const size = min + random() ** 2 * (max - min);
        place(x, z, size, OUTCROP.squat, -OUTCROP.sink);
      }
    }
  });
}
