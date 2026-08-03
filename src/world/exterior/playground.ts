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
 * The children's playground in the west park.
 *
 * Built from `park_pathway_river_general_idea_fromabove.jpeg` rather than
 * invented, and that photograph is unusually specific: a wide oval of pale
 * sand-gravel, irregular blue rubber blobs laid into it, a tan sand mound with
 * slide poles off it, a hexagonal timber sandpit, low timber climbing frames,
 * two tall raking masts, and a dark green mesh fence on slim posts around the
 * lot. Almost none of that is guessable, and all of it is what makes a
 * playground read as a playground rather than as some equipment on grass.
 *
 * Geometry rather than assets throughout. Every piece is a primitive, the whole
 * thing is four materials, and it never appears closer than about 40 m from any
 * Act I pose — which is exactly the range where a scanned asset's detail is
 * wasted and its silhouette is all that survives.
 *
 * It stands where the review row's camera cannot see it. That constraint is not
 * negotiable: the row argues about four facade options, and a climbing frame in
 * that frame is not a small defect.
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
    // Slate green, not the blue it was. From the overview pose the playground is
    // read in plan across a site that also holds a lake and a stream, and a blue
    // oval among them is a swimming pool — the one thing on the site that has to
    // not be mistaken for water.
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

  // The surface. An oval rather than a circle, because the photograph's is an
  // oval and because a circle in plan reads as a target from the overview pose.
  const surface = put(new CircleGeometry(PLAYGROUND.radius, 40), materials.sand, 0, 0.04, 0);
  surface.rotation.x = -Math.PI / 2;
  surface.scale.set(1, PLAYGROUND.oval, 1);
  surface.castShadow = false;

  // Rubber safety blobs. Irregular and few — five reads as designed, twenty
  // reads as a pattern, and the blue against the sand is the single strongest
  // colour signal that this is a playground and not a car park.
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

  // The sand mound, with two raking slide poles off its crown.
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

  // Two raking masts. The tallest things here by a long way, and the only part
  // of the playground that breaks the skyline from the promenade.
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

  // Low climbing frames: four posts and two rails apiece, which is enough to
  // read as apparatus at the distance this is ever seen from.
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

  // The fence. Slim dark posts with a mesh panel between them, and the mesh is
  // one transparent ring rather than a woven texture — at 40 m the read is a
  // dark haze at knee-to-waist height, which is exactly what a low-opacity band
  // gives for two triangles per bay.
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

/** A vertical band swept round the enclosure, open at the entrance. */
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
    // The gap the path enters through. A closed ring reads as a pen.
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
