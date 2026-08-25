import {
  DoubleSide,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  Quaternion,
  Vector3,
  type BufferGeometry,
  type Material,
  type MeshStandardMaterial,
  type Object3D,
  type PerspectiveCamera,
} from 'three';
import type { CanopyField } from './canopy';
import { chunkInstances, type Chunked } from './chunking';
import {
  drawableTree,
  impostorCard,
  renderImpostorsFor,
  type ImpostorLight,
} from './impostors';
import {
  avenueAt,
  CROSSING,
  inReviewShot,
  plantable,
  riverAt,
  riverSlope,
  riversideAt,
  SPAN,
} from './paths';
import { AVENUE, LAND, PARK, REALM, RIVERSIDE } from './site';
import { seatAt } from './terrain';
import { findTrees, type TreeTemplate } from './trees';
import { applyWind, type Wind } from './wind';

export interface Parkland {
  readonly object: Group;
  update(dt: number): void;
  dispose(): void;
}

export interface ParklandInputs {
  /** Every tree planted here registers, so the ground can shade under it. */
  readonly canopy: CanopyField;
  /** Read each frame to decide which rank of trees is modelled — see `FAR`. */
  readonly camera: PerspectiveCamera;
  /** Photographs the templates for the far rank's cards. */
  readonly renderer: import('three').WebGLRenderer;
}

/**
 * Metres beyond which a tree is a card rather than a model.
 *
 * The park is the most expensive thing in Act I and chunking could not touch
 * it where it hurt most: the establishing poses look at the whole site, so 98%
 * of the field is genuinely in frame and there is nothing for a frustum to
 * reject. What is wrong there is not how many trees are drawn but what each one
 * costs — 43,500 triangles for something forty metres wide on a 1080p frame.
 *
 * Ninety metres is set from the poses rather than from a quality judgement. The
 * closest the camera comes to a tree it is *discussing* is the avenue at
 * `objectives` and `contributions`, where the rows framing the entrance are
 * inside sixty metres and stay modelled. Everything past ninety is scenery in
 * an establishing shot, seen at under fourteen degrees of depression from every
 * Act I pose, which is well inside what a cross of quads carries.
 */
const FAR = 90;

/**
 * Metres across a park cell, smaller than the site's default.
 *
 * The park's cells do two jobs rather than one: they are what the frustum
 * rejects, and they are the unit the card swap decides on. The second job wants
 * them small. A cell is kept modelled whenever its *nearest* tree is inside
 * `FAR`, so at the default 80 m — cells reaching 46 m from their middle — one
 * tree near the camera holds eighty metres of park at full detail, and the poses
 * that stand in the park kept all 408 trees modelled.
 *
 * Affordable here in a way it is not for the planting: the park is 408 instances
 * in nine buckets, so halving the cell costs a few dozen draw calls rather than
 * the hundreds it would cost across the planting's eighty-three.
 */
const LOD_CELL = 40;

/**
 * Daylight for the park's cards, which is not the belt's daylight.
 *
 * Set against the measurement rather than by eye: with the belt's rig the cards
 * rendered at 49% of the luminance of the same tree modelled, so they read as
 * silhouettes cut out of a lit park. The levels here are the exterior
 * atmosphere's own — `skyColor`, `groundColor` and `keyColor` from
 * `ExteriorZone` — lifted until a card and a model of one tree measure the same.
 *
 * Flat in the same proportion the belt is, and for the belt's reason: a card is
 * a cross of quads at a random yaw, so the level is what must match and the
 * modelling is what cannot.
 */
const CARD_LIGHT: ImpostorLight = {
  sky: 0x9fc4ea,
  ground: 0x6a7a4e,
  // Far above the belt's 2.1 and 1.7, and the gap is ACES rather than taste.
  // The photograph is tone-mapped when it is taken, so the curve is already
  // compressing hard by the time these levels matter: doubling the belt's rig
  // moved a card from 55% of the luminance of the same tree modelled to only
  // 63%. Swept against that measurement across five Act I poses, these land the
  // ratio between 0.81 and 1.23 — the flattest the pair gets.
  ambient: 10.5,
  key: 0xfff4e4,
  keyIntensity: 8.1,
};

/**
 * The trees, lamps and benches that make the park a designed place.
 *
 * **Trees are the ones already on the site** — see `trees.ts`. What lives here
 * is a plan: where a tree stands, how big it is, and what it must not stand in.
 *
 * The last of those is one question asked of the path network. Every placement
 * clears every route by its own crown radius, so a canopy overhangs a walk —
 * which is what an avenue is for — while no trunk ever stands in one.
 */
export function createParkland(
  planting: Object3D,
  props: Object3D,
  { canopy, camera, renderer }: ParklandInputs,
): Parkland {
  const object = new Group();
  object.name = 'parkland';

  const trees = findTrees(planting).filter((tree) => tree.triangles <= PARK.budget);
  const furniture = collectProps(props);

  const placements = new Map<string, Matrix4[]>();
  const parts = new Map<string, { geometry: BufferGeometry; material: Material }>();
  const heights = new Map<string, number>();

  /**
   * The far rank's plan, kept beside the near rank's rather than derived later.
   *
   * A card is one unit tall and the model is in the template's own units, so the
   * two ranks cannot share an instance matrix — the model's scale is
   * `metres / template.height` and the card's is `metres`. Everything else is
   * shared deliberately: same position, same yaw, same seed, so a tree does not
   * move or turn when it swaps.
   */
  const cards = new Map<string, { template: TreeTemplate; matrices: Matrix4[] }>();

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
    const crown = species.radius * unit;
    if (!standable(x, z, crown)) {
      refused += 1;
      return false;
    }
    planted += 1;

    spin.setFromAxisAngle(up, random() * Math.PI * 2);
    // Slightly narrower or broader than nominal, and never taller than it is
    // wide by the same factor, so a row of one species is not one tree printed
    // eight times.
    scale.set(unit * (0.9 + random() * 0.22), unit, unit * (0.9 + random() * 0.22));
    // Seated on the lowest ground a trunk of this girth covers, not on the
    // height under its origin. A tree is the one thing on the site whose base
    // the camera comes close enough to check.
    seat.set(x, seatAt(x, z, Math.min(crown * 0.22, 1.4)), z);
    matrix.compose(seat, spin, scale);

    canopy.add(x, z, crown);
    species.parts.forEach((part, index) => emit(`${species.name}#${index}`, part, species.height));

    const card = cards.get(species.name) ?? { template: species, matrices: [] };
    // Uniform in metres: the card carries its own width through `aspect`, so
    // giving it the model's x/z jitter would stretch the photograph instead.
    card.matrices.push(new Matrix4().compose(seat, spin, new Vector3(metres, metres, metres)));
    cards.set(species.name, card);

    return true;
  };

  const prop = (kind: string, x: number, z: number, metres: number): void => {
    const template = furniture.get(kind);
    if (!template) return;
    spin.setFromAxisAngle(up, random() * Math.PI * 2);
    scale.setScalar(metres / template.height);
    // A bench has feet at its corners and a lamp post has a base plate, so both
    // are seated on the lowest ground under their own footprint.
    seat.set(x, seatAt(x, z, 0.7) + 0.02, z);
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

  const chunks: Chunked[] = [];
  /** Near and far versions of one cell, toggled together. See `Rank`. */
  const ranks = new Map<string, Rank>();

  const rankFor = (key: string): Rank => {
    const existing = ranks.get(key);
    if (existing) return existing;
    const rank: Rank = { near: [], far: [], centre: new Vector3(), radius: 0, modelled: true };
    ranks.set(key, rank);
    return rank;
  };

  for (const [key, list] of placements) {
    const part = parts.get(key)!;
    // Split by position. As one field per species it was submitted whole to both
    // the camera and the shadow camera from every pose — see `chunking.ts`.
    const chunked = chunkInstances(
      { geometry: part.geometry, material: part.material, matrices: list },
      key,
      { plantHeight: heights.get(key)! },
      LOD_CELL,
    );
    chunks.push(chunked);

    const tree = !furniture.has(key);

    for (const chunk of chunked.chunks) {
      const { mesh } = chunk;
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      object.add(mesh);
      meshes.push(mesh);
      // Furniture does not move in wind, and a lamp post that did would be the
      // most distracting object in the act.
      if (tree) {
        swaying.push(mesh);
        rankFor(chunk.key).near.push(mesh);
      }
    }
  }

  const wind: Wind = applyWind(swaying);

  // The far rank. Built after the near one because it is photographed from the
  // same templates and has to agree with them exactly.
  const impostors = buildCards(renderer, cards);
  const time = { value: 0 };

  for (const { key, mesh } of impostors.chunks) {
    mesh.castShadow = false;
    // A card has no normal worth lighting, and at ninety metres the shadow it
    // would cast is outside the shadow frustum in any case.
    mesh.receiveShadow = false;
    mesh.visible = false;
    object.add(mesh);
    rankFor(key).far.push(mesh);
  }

  sway(impostors.materials, time);

  // Where each cell is and how far it reaches, so the swap is one test per cell
  // per frame rather than one per tree. Taken off the chunk's own bounding
  // sphere, which `chunkInstances` has already computed from the instances that
  // landed in it.
  for (const rank of ranks.values()) {
    const source = rank.near[0] ?? rank.far[0];
    if (!source?.boundingSphere) continue;
    rank.centre.copy(source.boundingSphere.center);
    for (const mesh of [...rank.near, ...rank.far]) {
      if (mesh.boundingSphere) rank.radius = Math.max(rank.radius, mesh.boundingSphere.radius);
    }
  }

  const eye = new Vector3();

  /**
   * Which rank each cell draws, decided **only from where the camera is now**.
   *
   * Stateless on purpose. The obvious refinements — a hysteresis band, or
   * holding a downgrade until the cell leaves the frame — both make the rank a
   * function of the route taken to get here, and a defence is not walked in a
   * straight line. A presenter who jumps back to `park` to answer a question
   * would get a different picture from the one they rehearsed, which is the
   * same failure `setProgress` exists to prevent: world state is derived from
   * where the deck is, never from how it arrived. Holding the downgrade also
   * simply does not work here — the park is in frame in every establishing
   * shot, so the condition never comes true and the cells stay modelled for the
   * whole act.
   *
   * Nothing flickers, because a parked camera gives a constant distance. A cell
   * can change rank while a transition is flying past it, and that is the
   * accepted cost of the two properties above.
   */
  const swap = (): void => {
    /*
     * **In the park's own space, not the world's.**
     *
     * A chunk's bounding sphere is in the mesh's local space and the camera's
     * position is in the world's, and the exterior zone stands at
     * `ZONE_ORIGIN.exterior` — 200 m down +Z. Comparing the two directly made
     * every distance wrong by up to that much, which carded the avenue rows the
     * camera walks straight down while it was standing among them. Bringing the
     * camera into the park's space is one transform a frame and cannot drift the
     * way a remembered offset would.
     */
    object.updateWorldMatrix(true, false);
    eye.copy(camera.position);
    object.worldToLocal(eye);

    for (const rank of ranks.values()) {
      if (rank.far.length === 0) continue;

      /*
       * The **near edge** of the cell, never its centre.
       *
       * A cell is `LOD_CELL` metres across and holds trees well out toward its
       * corners, so measuring to the centre says a cell is far away while part
       * of it is standing next to the camera — which is exactly how the avenue
       * rows ended up as cards at the two poses that walk down them. Taking the
       * radius off asks the question that actually matters: is *all* of this
       * beyond the distance a card holds up at. It errs toward drawing the
       * model, which is the side to err on, because a card too close is the one
       * failure the audience can see.
       */
      const modelled = rank.centre.distanceTo(eye) - rank.radius < FAR;
      if (modelled === rank.modelled) continue;

      rank.modelled = modelled;
      for (const mesh of rank.near) mesh.visible = modelled;
      for (const mesh of rank.far) mesh.visible = !modelled;
    }
  };

  swap();

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

  const far = [...ranks.values()].filter((rank) => rank.far.length > 0).length;
  console.info(
    `[parkland] ${ranks.size} tree cells, ${far} with a card rank, ` +
      `swapping beyond ${FAR} m.`,
  );

  return {
    object,
    update(dt: number) {
      wind.update(dt);
      time.value += dt;
      swap();
    },
    dispose() {
      wind.dispose();
      for (const chunk of chunks) chunk.dispose();
      impostors.dispose();
      for (const part of parts.values()) part.geometry.dispose();
    },
  };
}

/**
 * One cell of park, in both of the ways it can be drawn.
 *
 * The unit of the swap is the cell rather than the tree, and that is what keeps
 * it free: a distance test per cell per frame instead of per trunk, and no
 * instance buffer is ever rewritten. The cost is that a cell changes rank all at
 * once, which is why `FAR` is set well beyond anything the act looks at closely.
 */
interface Rank {
  readonly near: InstancedMesh[];
  readonly far: InstancedMesh[];
  readonly centre: Vector3;
  /** How far the cell reaches, so the test can ask about its nearest tree. */
  radius: number;
  modelled: boolean;
}

interface Cards {
  readonly chunks: readonly { key: string; mesh: InstancedMesh }[];
  readonly materials: readonly MeshBasicMaterial[];
  dispose(): void;
}

/**
 * The far rank: one photograph per species, instanced onto the same plan.
 *
 * Cut rather than blended, exactly as the belt is. Hundreds of overlapping
 * transparent cards would need sorting every frame and would still be wrong; a
 * hard cut needs neither and writes depth, so the park occludes itself.
 */
function buildCards(
  renderer: import('three').WebGLRenderer,
  plan: Map<string, { template: TreeTemplate; matrices: Matrix4[] }>,
): Cards {
  const entries = [...plan.values()];
  const impostors = renderImpostorsFor(
    renderer,
    entries.map((entry) => drawableTree(entry.template)),
    {
      // One tree, not the belt's clump: this card stands where a single
      // modelled tree stood a frame earlier, and a clump would triple it.
      clumped: false,
      light: CARD_LIGHT,
    },
  );

  const chunks: { key: string; mesh: InstancedMesh }[] = [];
  const materials: MeshBasicMaterial[] = [];
  const geometries: BufferGeometry[] = [];
  const built: Chunked[] = [];

  impostors.forEach((impostor, index) => {
    const entry = entries[index];
    if (!entry) return;

    const geometry = impostorCard(impostor);
    const material = new MeshBasicMaterial({
      map: impostor.texture,
      transparent: false,
      alphaTest: 0.45,
      side: DoubleSide,
      fog: true,
    });

    const chunked = chunkInstances(
      { geometry, material, matrices: entry.matrices },
      `${entry.template.name}:card`,
      {},
      LOD_CELL,
    );
    built.push(chunked);
    chunks.push(...chunked.chunks);
    materials.push(material);
    geometries.push(geometry);
  });

  return {
    chunks,
    materials,
    dispose() {
      for (const chunk of built) chunk.dispose();
      for (const material of materials) material.dispose();
      for (const geometry of geometries) geometry.dispose();
      for (const impostor of impostors) impostor.dispose();
    },
  };
}

/**
 * The same slow lean the belt has, for the same reason.
 *
 * A card that stands still beside a modelled tree that is swaying is the swap
 * announcing itself. Amplitude is deliberately under the modelled wind's: at
 * ninety metres the sway that reads is the top of the canopy drifting, and
 * matching the near rank's throw would make the far rank the livelier one.
 */
function sway(materials: readonly MeshBasicMaterial[], time: { value: number }): void {
  for (const material of materials) {
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = time;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>
         uniform float uTime;`)
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
           float lean = position.y * position.y;
           float phase = uTime * 0.42 + instanceMatrix[3][0] * 0.06 + instanceMatrix[3][2] * 0.04;
           transformed.x += sin(phase) * lean * 0.030;
           transformed.z += cos(phase * 0.83) * lean * 0.022;`,
        );
    };
  }
}

type Plant = (species: TreeTemplate, x: number, z: number, metres: number) => boolean;
type Prop = (kind: string, x: number, z: number, metres: number) => void;
type Pick = (metres: number) => TreeTemplate | undefined;

/**
 * Whether a tree of this crown radius can stand here.
 *
 * Both questions belong to the path network and are asked there, so every
 * scatter gets the same answer: paving, the building's plate, the playground
 * and water from `plantable`, the review row's sightline from `inReviewShot`.
 */
function standable(x: number, z: number, radius: number): boolean {
  return plantable(x, z, radius * 0.55) && !inReviewShot(x, z);
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
 * Furniture is the one thing the planting asset does not contain, and it is the
 * strongest "this is designed" signal in `work/act1_photo_ideas/` — rhythm is
 * what the eye reads as intent.
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
