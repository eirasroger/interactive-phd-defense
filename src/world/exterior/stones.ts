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
 * Places one stone. `squat` flattens it. `sit` is the centre height above the
 * ground as a fraction of its size; negative buries it.
 */
export type PlaceStone = (
  x: number,
  z: number,
  size: number,
  squat: number,
  sit: number,
) => void;

/**
 * Instanced granite stones built from a jittered icosahedron. At viewing
 * distance this matches a scanned rock at a fraction of the cost.
 * The caller supplies the placement through `scatter`.
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

  // `tone` should be warm and darker than real granite. A neutral grey picks
  // up the blue sky and looks like ice against the darkened terrain.
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
 * Bedrock showing through the hills. Scattered by `outcropAt`, the same
 * function the terrain shader uses, so stones only appear on exposed ground.
 * Stones are flattened and sunk to look like bedrock.
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
