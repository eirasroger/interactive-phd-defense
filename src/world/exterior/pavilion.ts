import {
  BoxGeometry,
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
} from 'three';
import { pavilionYaw } from './paths';
import { PAVILION } from './site';
import { surfaceAt } from './terrain';

export interface Pavilion {
  readonly object: Group;
  dispose(): void;
}

/** Height of the plinth the building stands on. */
const PLINTH = 0.34;

/**
 * The park pavilion at the lake end of the riverside walk, so the walk has a
 * destination. A modest single-storey box in timber louvres with a raked roof,
 * based on `park_additional_small_building_idea`. Built in code because its
 * position and bearing follow the river path.
 */
export function createPavilion(): Pavilion {
  const object = new Group();
  object.name = 'pavilion';

  const { centre, width, depth, height, rake, louvre, reveal } = PAVILION;
  const [cx, cz] = centre;

  const yaw = pavilionYaw();
  object.rotation.y = -yaw;

  /**
   * Plinth level and depth from the ground under the footprint. The top sits
   * at the highest ground and the plinth reaches below the lowest, since the
   * ground falls over a metre across the building.
   */
  const under: number[] = [];
  for (const along of [-0.5, 0, 0.5]) {
    for (const across of [-0.5, 0, 0.5]) {
      const x = cx + Math.cos(yaw) * along * width - Math.sin(yaw) * across * depth;
      const z = cz + Math.sin(yaw) * along * width + Math.cos(yaw) * across * depth;
      under.push(surfaceAt(x, z));
    }
  }
  const base = Math.max(...under);
  const dig = base - Math.min(...under) + 0.5;

  object.position.set(cx, base, cz);

  const materials = {
    // Weathered stained softwood. Kept dark so it stays less saturated than the clay paving.
    timber:new MeshStandardMaterial({ color: 0x7d5038, roughness: 0.78, metalness: 0 }),
    // Wall behind the screen. Darker than the boards to show the gaps, but light
    // enough to avoid hard stripes.
    shadow:new MeshStandardMaterial({ color: 0x3b332b, roughness: 0.95, metalness: 0 }),
    // Roof edge, the part still visible at 50 m. Pale relative to the timber.
    // True white would clip, since the zone's exposure is keyed to a 0.078-albedo brick facade.
    fascia:new MeshStandardMaterial({ color: 0x74736d, roughness: 0.55, metalness: 0.1 }),
    // Lighter than the wall so the opening stands out from the shadow behind the screen.
    glass:new MeshStandardMaterial({
      color: 0x46545e,
      roughness: 0.06,
      metalness: 0.1,
      envMapIntensity: 1.6,
    }),
    // Up to a metre of plinth is exposed on the downhill side. Kept dark so it stays unobtrusive.
    plinth:new MeshStandardMaterial({ color: 0x4e4a44, roughness: 0.93, metalness: 0 }),
  };

  const geometries: BufferGeometry[] = [];
  const instanced: InstancedMesh[] = [];

  const add = (geometry: BufferGeometry, material: MeshStandardMaterial, y: number): void => {
    geometries.push(geometry);
    const mesh = new Mesh(geometry, material);
    mesh.position.y = y;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    object.add(mesh);
  };

  const halfWidth = width / 2;
  const halfDepth = depth / 2;

  // Plinth, 8 cm proud of the walls on each side.
  add(new BoxGeometry(width + 0.16, PLINTH + dig, depth + 0.16), materials.plinth, (PLINTH - dig) / 2);

  // Wall behind the screen, with its top raked across the plan.
  add(raked(width, depth, rake, height, 0, false), materials.shadow, PLINTH);

  // One glazed bay near the low end of the front elevation. At 40 m each board
  // course is a couple of pixels, so a single opening keeps the screen legible.
  const openings = [
    {
      at: -width * 0.28,
      span: width * 0.13,
      low: height * 0.24,
      high: height * 0.78,
    },
  ];

  for (const opening of openings) {
    const glass = new Mesh(
      new BoxGeometry(opening.span * 2, opening.high - opening.low, 0.06),
      materials.glass,
    );
    glass.position.set(opening.at, PLINTH + (opening.low + opening.high) / 2, halfDepth - 0.02);
    glass.castShadow = false;
    glass.receiveShadow = true;
    object.add(glass);
    geometries.push(glass.geometry);
  }

  // Louvre screen: instanced horizontal boards on all four elevations, stopping
  // under the raked roof line. Modelled with depth so the shadow between boards
  // follows the sun.
  const board = new BoxGeometry(1, louvre - reveal, 0.06);
  const seats: { position: Vector3; scale: Vector3; yaw: number }[] = [];

  const elevations = [
    { yaw: 0, span: width, out: halfDepth, head: (t: number) => t * rake, front: true },
    { yaw: Math.PI, span: width, out: halfDepth, head: (t: number) => (1 - t) * rake, front: false },
    { yaw: Math.PI / 2, span: depth, out: halfWidth, head: () => rake, front: false },
    { yaw: -Math.PI / 2, span: depth, out: halfWidth, head: () => 0, front: false },
  ];

  // Each course is split into segments so it can stop under the sloping roof line.
  const SEGMENTS = 14;

  for (const elevation of elevations) {
    for (let course = 0; course * louvre < height; course += 1) {
      const y = (course + 0.5) * louvre;
      for (let segment = 0; segment < SEGMENTS; segment += 1) {
        const t = (segment + 0.5) / SEGMENTS;
        if (y > height + elevation.head(t) - 0.1) continue;

        const along = (t - 0.5) * elevation.span;
        if (
          elevation.front &&
          openings.some(
            (hole) =>
              Math.abs(along - hole.at) < hole.span &&
              y > hole.low - louvre &&
              y < hole.high + louvre,
          )
        ) {
          continue;
        }

        const cos = Math.cos(elevation.yaw);
        const sin = Math.sin(elevation.yaw);
        seats.push({
          position: new Vector3(
            along * cos + elevation.out * sin,
            PLINTH + y,
            -along * sin + elevation.out * cos,
          ),
          scale: new Vector3(elevation.span / SEGMENTS + 0.01, 1, 1),
          yaw: elevation.yaw,
        });
      }
    }
  }

  const screen = new InstancedMesh(board, materials.timber, seats.length);
  const matrix = new Matrix4();
  const rotation = new Quaternion();
  const axis = new Vector3(0, 1, 0);
  seats.forEach((seat, index) => {
    rotation.setFromAxisAngle(axis, seat.yaw);
    screen.setMatrixAt(index, matrix.compose(seat.position, rotation, seat.scale));
  });
  screen.instanceMatrix.needsUpdate = true;
  // Receives shadow only. A 3 cm board casts a texel-wide shadow on a 60 m
  // shadow map, which only produces acne.
  screen.castShadow = false;
  screen.receiveShadow = true;
  object.add(screen);
  instanced.push(screen);
  geometries.push(board);

  // Roof, overhanging on every side. Its underside follows the rake so it forms a thin slab.
  add(raked(width + 1.2, depth + 1.2, rake, height + 0.2, height, true), materials.fascia, PLINTH);

  console.info(`[exterior] pavilion: ${seats.length} louvre boards at (${cx}, ${cz}).`);

  return {
    object,
    dispose() {
      for (const geometry of geometries) geometry.dispose();
      for (const mesh of instanced) mesh.dispose();
      for (const material of Object.values(materials)) material.dispose();
    },
  };
}

/**
 * A box whose top slopes across its width by `rake`. With `follow`, the
 * underside slopes too (roof slab); without it, the base is level (wall).
 */
function raked(
  width: number,
  depth: number,
  rake: number,
  head: number,
  base: number,
  follow: boolean,
): BufferGeometry {
  const w = width / 2;
  const d = depth / 2;
  const climb = (x: number): number => ((x + w) / width) * rake;

  const corners: readonly (readonly [number, number])[] = [
    [-w, -d],
    [w, -d],
    [w, d],
    [-w, d],
  ];

  const positions: number[] = [];
  for (const [x, z] of corners) positions.push(x, head + climb(x), z);
  for (const [x, z] of corners) positions.push(x, base + (follow ? climb(x) : 0), z);

  const indices = [0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7];
  for (let side = 0; side < 4; side += 1) {
    const a = side;
    const b = (side + 1) % 4;
    indices.push(a, b, b + 4, a, b + 4, a + 4);
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
