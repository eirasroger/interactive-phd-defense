import {
  BoxGeometry,
  BufferGeometry,
  CircleGeometry,
  CylinderGeometry,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
} from 'three';
import { PLAYGROUND } from './site';
import { surfaceAt } from './terrain';

export interface Playground {
  readonly object: Group;
  dispose(): void;
}

/**
 * Children's playground in the west park, based on
 * `park_pathway_river_general_idea_fromabove.jpeg`. Built from primitives
 * because no Act I pose sees it closer than about 40 m. Must stay out of the
 * review row's camera view.
 */
export function createPlayground(): Playground {
  const object = new Group();
  object.name = 'playground';

  const [cx, cz] = PLAYGROUND.centre;
  const ground = surfaceAt(cx, cz);
  object.position.set(cx, ground, cz);

  const materials = {
    sand: new MeshStandardMaterial({ color: 0xa89a7c, roughness: 0.96, metalness: 0 }),
    mound: new MeshStandardMaterial({ color: 0xb08d5e, roughness: 0.95, metalness: 0 }),
    // Slate green so the oval is not mistaken for water from the overview pose.
    rubber: new MeshStandardMaterial({ color: 0x4a5b52, roughness: 0.86, metalness: 0 }),
    timber: new MeshStandardMaterial({ color: 0x8f6f47, roughness: 0.88, metalness: 0 }),
    steel: new MeshStandardMaterial({ color: 0x3a4038, roughness: 0.5, metalness: 0.55 }),
  };

  const geometries: BufferGeometry[] = [];
  const put = (
    geometry: BufferGeometry,
    material: MeshStandardMaterial,
    x: number,
    y: number,
    z: number,
  ): Mesh => {
    geometries.push(geometry);
    const mesh = new Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    object.add(mesh);
    return mesh;
  };

  let seed = 0x5c31a7;
  const random = (): number => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0x100000000;
  };

  // Oval sand surface, matching the reference photo.
  const surface = put(new CircleGeometry(PLAYGROUND.radius, 40), materials.sand, 0, 0.04, 0);
  surface.rotation.x = -Math.PI / 2;
  surface.scale.set(1, PLAYGROUND.oval, 1);
  surface.castShadow = false;

  // Five irregular rubber safety patches.
  for (let i = 0; i < 5; i += 1) {
    const angle = (i / 5) * Math.PI * 2 + random() * 0.8;
    const reach = PLAYGROUND.radius * (0.34 + random() * 0.44);
    const blob = put(
      new CircleGeometry(1.9 + random() * 2.4, 12),
      materials.rubber,
      Math.cos(angle) * reach,
      0.05,
      Math.sin(angle) * reach * PLAYGROUND.oval,
    );
    blob.rotation.x = -Math.PI / 2;
    blob.rotation.z = random() * Math.PI;
    blob.scale.set(1, 0.55 + random() * 0.5, 1);
    blob.castShadow = false;
  }

  // Sand mound with two slanted slide poles.
  const mound = put(new SphereGeometry(3.4, 20, 10), materials.mound, 6.2, -2.2, -1.4);
  mound.scale.set(1, 0.42, 1);

  for (const lean of [-0.5, 0.34]) {
    const pole = put(
      new CylinderGeometry(0.07, 0.07, 6.4, 8),
      materials.steel,
      6.2 + Math.sin(lean) * 3.1,
      -0.9,
      -1.4 + Math.cos(lean) * 3.1,
    );
    pole.rotation.x = lean;
  }

  // Two tall slanted masts, visible above the skyline from the promenade.
  for (const side of [-1, 1]) {
    const mast = put(
      new CylinderGeometry(0.1, 0.14, PLAYGROUND.mast, 8),
      materials.steel,
      side * 9.5,
      PLAYGROUND.mast * 0.42,
      side * 3.5,
    );
    mast.rotation.z = side * 0.26;
  }

  // Hexagonal sandpit, timber-edged.
  for (let i = 0; i < 6; i += 1) {
    const angle = (i / 6) * Math.PI * 2;
    const edge = put(
      new BoxGeometry(2.5, 0.28, 0.22),
      materials.timber,
      -5.4 + Math.cos(angle) * 2.1,
      0.14,
      3.6 + Math.sin(angle) * 2.1,
    );
    edge.rotation.y = -angle + Math.PI / 2;
  }

  // Low climbing frames: four posts and two rails each.
  for (const [fx, fz, turn] of [
    [-8.5, -3.2, 0.3],
    [2.4, 6.1, -0.9],
  ] as const) {
    const frame = new Group();
    frame.position.set(fx, 0, fz);
    frame.rotation.y = turn;
    object.add(frame);

    for (const dx of [-1.7, 1.7]) {
      for (const dz of [-0.9, 0.9]) {
        const post = new Mesh(new CylinderGeometry(0.09, 0.09, 2.1, 6), materials.timber);
        geometries.push(post.geometry);
        post.position.set(dx, 1.05, dz);
        post.castShadow = true;
        frame.add(post);
      }
    }
    for (const height of [1.05, 1.95]) {
      for (const dz of [-0.9, 0.9]) {
        const rail = new Mesh(new BoxGeometry(3.4, 0.1, 0.1), materials.timber);
        geometries.push(rail.geometry);
        rail.position.set(0, height, dz);
        rail.castShadow = true;
        frame.add(rail);
      }
    }
  }

  // Fence: slim posts plus one semi-transparent ring for the mesh panels.
  const ring = fenceRing(PLAYGROUND.radius + 1.6, PLAYGROUND.oval, PLAYGROUND.fence);
  geometries.push(ring);
  const mesh = new Mesh(
    ring,
    new MeshStandardMaterial({
      color: 0x242c24,
      roughness: 0.9,
      metalness: 0.2,
      transparent: true,
      opacity: 0.62,
      depthWrite: false,
    }),
  );
  mesh.name = 'fence';
  object.add(mesh);

  const posts = 26;
  for (let i = 0; i < posts; i += 1) {
    const angle = (i / posts) * Math.PI * 2;
    const reach = PLAYGROUND.radius + 1.6;
    put(
      new CylinderGeometry(0.045, 0.045, PLAYGROUND.fence, 6),
      materials.steel,
      Math.cos(angle) * reach,
      PLAYGROUND.fence / 2,
      Math.sin(angle) * reach * PLAYGROUND.oval,
    );
  }

  return {
    object,
    dispose() {
      for (const geometry of geometries) geometry.dispose();
      for (const material of Object.values(materials)) material.dispose();
      (mesh.material as MeshStandardMaterial).dispose();
    },
  };
}

/** Vertical band around the enclosure, open at the entrance. */
function fenceRing(radius: number, oval: number, height: number): BufferGeometry {
  const segments = 52;
  const positions: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i <= segments; i += 1) {
    const angle = (i / segments) * Math.PI * 2;
    positions.push(
      Math.cos(angle) * radius,
      0,
      Math.sin(angle) * radius * oval,
      Math.cos(angle) * radius,
      height,
      Math.sin(angle) * radius * oval,
    );
  }

  for (let i = 0; i < segments; i += 1) {
    // Entrance gap where the path enters.
    if (i > segments * 0.44 && i < segments * 0.54) continue;
    const a = i * 2;
    indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
