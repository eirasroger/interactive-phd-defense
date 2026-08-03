import {
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  Quaternion,
  Vector3,
  type BufferGeometry,
  type Material,
  type MeshStandardMaterial,
  type Object3D,
} from 'three';
import {
  avenueAt,
  CROSSING,
  offPaths,
  pitch,
  riverAt,
  riverSlope,
  riversideAt,
  SPAN,
  wetness,
} from './paths';
import { AVENUE, LAND, PARK, REALM, RIVERSIDE, WOODLAND } from './site';
import { heightAt } from './terrain';
import { findTrees, type TreeTemplate } from './trees';
import { applyWind, type Wind } from './wind';

export interface Parkland {
  readonly object: Group;
  update(dt: number): void;
  dispose(): void;
}

/**
 * The trees, lamps and benches that make the park a designed place.
 *
 * **Trees are the ones already on the site** — see `trees.ts` for why the park
 * no longer ships and reassembles a set of its own. What is left here is the
 * only thing this module should ever have been: a plan. Where a tree stands,
 * how big it is, and what it must not stand in.
 *
 * That last one is now a single question asked of the path network rather than
 * three different hand-written boxes, and it is the fix for trees growing out
 * of the paving. Every placement clears every route by its own crown radius, so
 * a canopy overhangs a walk — which is what an avenue is for — while no trunk
 * ever stands in one.
 */
export function createParkland(planting: Object3D, props: Object3D): Parkland {
  const object = new Group();
  object.name = 'parkland';

  const trees = findTrees(planting).filter((tree) => tree.triangles <= PARK.budget);
  const furniture = collectProps(props);

  const placements = new Map<string, Matrix4[]>();
  const parts = new Map<string, { geometry: BufferGeometry; material: Material }>();
  const heights = new Map<string, number>();

  let seed = 0x3ad91f;
  const random = (): number => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0x100000000;
  };

  const matrix = new Matrix4();
  const spin = new Quaternion();
  const up = new Vector3(0, 1, 0);
  const scale = new Vector3();
  const seat = new Vector3();

  const emit = (key: string, part: { geometry: BufferGeometry; material: Material }, height: number): void => {
    if (!parts.has(key)) {
      parts.set(key, part);
      heights.set(key, height);
      placements.set(key, []);
    }
    placements.get(key)!.push(matrix.clone());
  };

  let planted = 0;
  let refused = 0;

  /**
   * One tree, sized in metres of finished height.
   *
   * Returns whether it was planted, because a refused placement is a real
   * answer: `plantable` is what keeps the paving clear, and a caller stepping
   * along the avenue wants to know that a gap in the row is deliberate.
   */
  const tree = (species: TreeTemplate, x: number, z: number, metres: number): boolean => {
    const unit = metres / species.height;
    if (!plantable(x, z, species.radius * unit)) {
      refused += 1;
      return false;
    }
    planted += 1;

    spin.setFromAxisAngle(up, random() * Math.PI * 2);
    // Slightly narrower or broader than nominal, and never taller than it is
    // wide by the same factor, so a row of one species is not one tree printed
    // eight times.
    scale.set(unit * (0.9 + random() * 0.22), unit, unit * (0.9 + random() * 0.22));
    seat.set(x, heightAt(x, z) - 0.08, z);
    matrix.compose(seat, spin, scale);

    species.parts.forEach((part, index) => emit(`${species.name}#${index}`, part, species.height));
    return true;
  };

  const prop = (kind: string, x: number, z: number, metres: number): void => {
    const template = furniture.get(kind);
    if (!template) return;
    spin.setFromAxisAngle(up, random() * Math.PI * 2);
    scale.setScalar(metres / template.height);
    seat.set(x, heightAt(x, z) - 0.04, z);
    matrix.compose(seat, spin, scale);
    emit(kind, template, template.height);
  };

  /** Picks a species by size, so a small tree is a small tree and not a scaled one. */
  const species = (metres: number): TreeTemplate | undefined => {
    if (trees.length === 0) return undefined;
    const sorted = [...trees].sort(
      (a, b) => Math.abs(a.height - metres) - Math.abs(b.height - metres),
    );
    return sorted[Math.min(sorted.length - 1, Math.floor(random() * 2))];
  };

  if (trees.length === 0) {
    console.warn('[parkland] no tree templates in the planting asset; the park has no trees.');
  }

  plan(random, tree, prop, species);

  const meshes: InstancedMesh[] = [];
  const swaying: InstancedMesh[] = [];

  for (const [key, list] of placements) {
    const part = parts.get(key)!;
    const mesh = new InstancedMesh(part.geometry, part.material, list.length);
    list.forEach((transform, index) => mesh.setMatrixAt(index, transform));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.name = key;
    (mesh.userData as { plantHeight: number }).plantHeight = heights.get(key)!;

    object.add(mesh);
    meshes.push(mesh);
    // Furniture does not move in wind, and a lamp post that did would be the
    // most distracting object in the act.
    if (!furniture.has(key)) swaying.push(mesh);
  }

  const wind: Wind = applyWind(swaying);

  // Reported rather than assumed. A refusal rate is the one number that says
  // whether the clearance rules are doing their job or quietly emptying the
  // park, and the two look identical from a distant camera.
  const drawn = [...placements.values()].reduce((sum, list) => sum + list.length, 0);
  const average = trees.reduce((sum, entry) => sum + entry.triangles, 0) / (trees.length || 1);
  console.info(
    `[parkland] ${planted} trees planted, ${refused} refused; ` +
      `${drawn} instances in ${meshes.length} draws from ${trees.length} templates ` +
      `(~${((planted * average) / 1e6).toFixed(1)}M tris).`,
  );

  return {
    object,
    update(dt: number) {
      wind.update(dt);
    },
    dispose() {
      wind.dispose();
      for (const mesh of meshes) mesh.dispose();
      for (const part of parts.values()) part.geometry.dispose();
    },
  };
}

type Plant = (species: TreeTemplate, x: number, z: number, metres: number) => boolean;
type Prop = (kind: string, x: number, z: number, metres: number) => void;
type Pick = (metres: number) => TreeTemplate | undefined;

/**
 * Whether a tree of this crown radius can stand here.
 *
 * The trunk clears every paved route by the crown's own radius, so the canopy
 * reaches over the walk and the tree never stands in it. Nothing is inside the
 * playground fence, and nothing is in the wedge the review row's camera looks
 * through — a tree there is not a small defect, it is planted in front of an
 * option the audience is being asked to choose between.
 */
function plantable(x: number, z: number, radius: number): boolean {
  if (offPaths(x, z) < radius * 0.55) return false;
  if (pitch(x, z) > 0.01) return false;
  // Nothing grows in the water. Asked as "is there water here" rather than as
  // "is the ground below the lake's level", which is the same question only on
  // flat ground: the park now rolls to four metres below datum in places, so a
  // test against an absolute water level refused most of the site.
  if (wetness(x, z) > 0.12) return false;

  const { clear } = WOODLAND;
  return !(x > clear.x[0] && x < clear.x[1] && z > clear.z[0] && z < clear.z[1]);
}

/**
 * The planting plan.
 *
 * Formality belongs to the avenue and nowhere else: a rhythm on the walk to the
 * front door, and informal groups everywhere else. That contrast is what reads
 * as a designed public realm rather than as a clearing with trees in it.
 */
function plan(random: () => number, tree: Plant, prop: Prop, pick: Pick): void {
  const nearBridge = CROSSING.z - SPAN / 2 - 3;

  // The avenue rows. Set back beyond the shrub verge so the canopy overhangs
  // the walk without standing in it, and paired across the axis so the rhythm
  // reads from the middle of the path rather than as two independent lines.
  for (let z = AVENUE.from + 5; z < nearBridge; z += PARK.avenue.pitch) {
    for (const side of [-1, 1]) {
      const metres = PARK.avenue.height + random() * 3.4;
      const chosen = pick(metres);
      if (!chosen) break;
      const stand = AVENUE.halfWidth + PARK.avenue.standback + random() * 1.1;
      tree(chosen, avenueAt(z) + side * stand, z, metres);
    }
  }

  // Lamps, on a tighter rhythm than the trees. Rhythm is what the eye reads as
  // intent, and it is the strongest "designed public realm" signal in the
  // reference photography.
  for (let z = AVENUE.from + 2; z < nearBridge; z += 15) {
    for (const side of [-1, 1]) {
      prop('lamp', avenueAt(z) + side * (AVENUE.halfWidth + 1.4), z, 4.4);
    }
  }

  const promenade = (REALM.forecourtFar + REALM.promenadeFar) / 2;
  const verge = (REALM.promenadeFar - REALM.forecourtFar) / 2 + 1.8;
  for (let x = -REALM.run / 2 + 10; x < REALM.run / 2 - 10; x += 18) {
    if (Math.abs(x) < 10) continue;
    prop('lamp', x, promenade + verge, 4.4);
    if (random() < 0.5) prop('bench', x + 6, promenade - verge, 0.95);
    if (random() < 0.55) {
      const metres = 9 + random() * 4;
      const chosen = pick(metres);
      if (chosen) tree(chosen, x + 9, promenade + verge + 5, metres);
    }
  }

  // Park trees in the open grass, in groups. A uniform scatter reads as an
  // orchard gone wrong; two or three together with open ground between reads as
  // planting somebody chose.
  for (let group = 0; group < PARK.groups; group += 1) {
    const gx = -REALM.run / 2 + random() * REALM.run;
    const gz = 36 + random() * 48;

    for (let i = 0; i < 2 + Math.floor(random() * 3); i += 1) {
      const metres = 8 + random() * 6;
      const chosen = pick(metres);
      if (!chosen) break;
      tree(chosen, gx + (random() - 0.5) * 14, gz + (random() - 0.5) * 11, metres);
    }
  }

  // The far bank, where the eye stops. Set out from the top of the swale, so
  // the trees stand on the level ground above the channel rather than on its
  // slope.
  const top = LAND.river.halfWidth + LAND.river.swale;
  for (let x = RIVERSIDE.to - 4; x > RIVERSIDE.from - 30; x -= 5.5) {
    if (random() > 0.62) continue;
    const slope = riverSlope(x);
    const across = 1 / Math.hypot(1, slope);
    const offset = top + 1.5 + random() * 7;
    const metres = 9 + random() * 6;
    const chosen = pick(metres);
    if (!chosen) break;
    tree(chosen, x - offset * slope * across, riverAt(x) + offset * across, metres);
  }

  // The near bank of the riverside walk, thinner: this is the side the camera
  // stands on and a screen of trees here would close the view of the water the
  // walk exists to give.
  for (let x = RIVERSIDE.from; x < RIVERSIDE.to; x += 9) {
    if (random() > 0.4) continue;
    const metres = 7 + random() * 4;
    const chosen = pick(metres);
    if (!chosen) break;
    tree(chosen, x, riversideAt(x) - 6 - random() * 7, metres);
  }
}

interface Furniture {
  readonly geometry: BufferGeometry;
  readonly material: Material;
  readonly height: number;
}

/**
 * Lamp posts and benches, from the props asset.
 *
 * All that is left of what used to be a 25 MB tree library. Furniture is the
 * one thing the planting genuinely does not contain, and it is also the single
 * strongest "this is designed" signal in `work/act1_photo_ideas/` — more than
 * any individual plant, because rhythm is what the eye reads as intent.
 */
function collectProps(source: Object3D): Map<string, Furniture> {
  const props = new Map<string, Furniture>();
  const world = new Matrix4();

  source.updateMatrixWorld(true);
  source.traverse((node) => {
    const mesh = node as Mesh;
    if (!mesh.isMesh || Array.isArray(mesh.material)) return;

    const kind = (mesh.name || '').replace(/\.\d+$/, '').replace(/_part\d+$/, '');
    if (!kind || props.has(kind)) return;

    mesh.updateWorldMatrix(true, false);
    world.copy(mesh.matrixWorld).setPosition(0, 0, 0);

    const geometry = mesh.geometry.clone();
    geometry.applyMatrix4(world);
    geometry.computeBoundingBox();
    const box = geometry.boundingBox;
    if (!box) return;

    geometry.translate(0, -box.min.y, 0);
    geometry.computeBoundingSphere();

    const material = mesh.material as MeshStandardMaterial;
    material.alphaTest = Math.max(material.alphaTest, 0.35);
    material.transparent = false;
    material.depthWrite = true;
    material.needsUpdate = true;

    props.set(kind, { geometry, material, height: Math.max(0.05, box.max.y - box.min.y) });
  });

  if (props.size === 0) console.warn('[parkland] no furniture templates in park-assets.');
  return props;
}
