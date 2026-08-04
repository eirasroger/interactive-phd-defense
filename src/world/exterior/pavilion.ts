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
 * The park pavilion at the lake end of the riverside walk.
 *
 * It exists to give the walk somewhere to go. A hundred and forty metres of
 * paving that starts nowhere and ends nowhere reads as an unfinished drawing
 * however well it is detailed, and no amount of planting along it fixes that —
 * a route needs a reason, not decoration.
 *
 * `park_additional_small_building_idea` is the model, and it is deliberately a
 * modest one: a single-storey box in horizontal timber louvres with a thin pale
 * fascia and a roof that rakes across the plan. Every Nordic park of this kind
 * has one — a café, a boat store, a public convenience — and none of them is
 * architecture anybody is asked to look at. That is exactly the register this
 * wants. The building the talk is *about* stands at the other end of the site,
 * and a second one competing with it would be a mistake.
 *
 * Built rather than exported, for the same reason the paving and the bridge
 * are: its position and its bearing are the riverside walk's, and the walk
 * follows a meandering river. An exported mesh would be in the wrong place the
 * day the water moves.
 */
export function createPavilion(): Pavilion {
  const object = new Group();
  object.name = 'pavilion';

  const { centre, width, depth, height, rake, louvre, reveal } = PAVILION;
  const [cx, cz] = centre;

  const yaw = pavilionYaw();
  object.rotation.y = -yaw;

  /**
   * Level and depth of the plinth, from the ground under the actual footprint.
   *
   * A plant is seated on the lowest ground it covers, but over seventeen metres
   * the ground here falls more than a metre and dropping the building to its low
   * corner buries its own base. A building takes the level of its high side and
   * digs the rest out: the plinth top is the highest ground under it and the
   * plinth reaches down past the lowest.
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
    // Warm and dark, not orange. The louvres in the photograph are a stained
    // softwood weathered toward brown; at full terracotta this would be the
    // most saturated object on the site, and the clay paving already has that
    // job.
    timber: new MeshStandardMaterial({ color: 0x7d5038, roughness: 0.78, metalness: 0 }),
    // The wall behind the screen. Darker than the boards, because what makes a
    // louvred screen read as one is the shadow line between them — but not
    // black: at 0x231f1b the gaps punched through as hard stripes and the
    // building read as a grille. A shaded wall still catches sky.
    shadow: new MeshStandardMaterial({ color: 0x3b332b, roughness: 0.95, metalness: 0 }),
    // The roof edge, which is what the photograph leads with and the one thing
    // that still reads at fifty metres once the louvres have gone to a texture.
    //
    // A long way off white. This zone's key is set from an 0.078-albedo brick
    // facade, so a surface at the photograph's own value clips to a flat white
    // slab with no edge and no form. Pale *relative to the timber under it* is
    // the job, and that is a ratio rather than a value.
    fascia: new MeshStandardMaterial({ color: 0x74736d, roughness: 0.55, metalness: 0.1 }),
    // Lighter than the wall it is set into, or the opening is indistinguishable
    // from the shadow behind the screen and the whole detail is wasted.
    glass: new MeshStandardMaterial({
      color: 0x46545e,
      roughness: 0.06,
      metalness: 0.1,
      envMapIntensity: 1.6,
    }),
    // The ground falls a metre across this footprint, so on the downhill side
    // the base is a metre of exposed concrete whatever is done about it — which
    // is what a real building here would have. At 0x77736c that metre was the
    // palest thing in the frame and the pavilion read as a shed on a podium.
    plinth: new MeshStandardMaterial({ color: 0x4e4a44, roughness: 0.93, metalness: 0 }),
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

  // A base, so the building sits on the ground rather than growing out of it.
  // Barely proud of the walls: at half a metre all round it read as a podium,
  // which is a monument's move and this is a park shed.
  add(new BoxGeometry(width + 0.16, PLINTH + dig, depth + 0.16), materials.plinth, (PLINTH - dig) / 2);

  // The wall the screen hangs off, with its head raked across the plan. That
  // slope is most of the building's character in the reference and it is what
  // stops a box this simple reading as a shed.
  add(raked(width, depth, rake, height, 0, false), materials.shadow, PLINTH);

  // Two glazed bays on the elevation the walk passes, set behind the screen.
  // One glazed bay, at the low end, and one is the point.
  //
  // Two of them punched the screen into three rags of boarding: at forty metres
  // the courses are a couple of pixels each, so a course interrupted twice
  // reads as a broken line rather than as a window, and the elevation came out
  // as static. The photograph has an unbroken screen with a single dark opening
  // near one end, and that is not a stylistic choice — it is the only thing at
  // this scale that survives being small.
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

  // The louvre screen: horizontal boards on all four elevations, stopping under
  // whatever height the raked head has reached at that point along the wall, so
  // the coursing dies into the roof line instead of being cut off square.
  //
  // Instanced, because there are several hundred and they are the entire read
  // of the building. Modelled with depth rather than painted on, for the same
  // reason the bridge's boards are: what the eye is seeing is the shadow each
  // board drops on the one below, and a texture of that points the wrong way
  // for half the day.
  const board = new BoxGeometry(1, louvre - reveal, 0.06);
  const seats: { position: Vector3; scale: Vector3; yaw: number }[] = [];

  const elevations = [
    { yaw: 0, span: width, out: halfDepth, head: (t: number) => t * rake, front: true },
    { yaw: Math.PI, span: width, out: halfDepth, head: (t: number) => (1 - t) * rake, front: false },
    { yaw: Math.PI / 2, span: depth, out: halfWidth, head: () => rake, front: false },
    { yaw: -Math.PI / 2, span: depth, out: halfWidth, head: () => 0, front: false },
  ];

  // Boards are laid in segments across each elevation. That is what lets one
  // instanced course follow a sloping head: a segment stops where the wall
  // under the rake has run out, and the course frays away rather than ending.
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
  // The screen takes the roof's shadow but casts none of its own. A board
  // stands 3 cm proud and the zone's shadow map covers sixty metres, so its
  // cast shadow is a texel wide — what it actually produced was acne, breaking
  // every course into a dashed line and turning the elevation to static. The
  // shadow that matters between boards is the reveal, and that is modelled.
  screen.castShadow = false;
  screen.receiveShadow = true;
  object.add(screen);
  instanced.push(screen);
  geometries.push(board);

  // The roof, oversailing on every side. Thin and pale, and its underside rakes
  // with its top so the oversail reads as a slab rather than as a wedge.
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
 * A box whose head is a plane raked across its width.
 *
 * `follow` decides whether the underside rakes with the head — which is the
 * difference between a wedge of wall standing on level ground and a slab of
 * roof lying on top of it. Two shapes, one construction, because they have to
 * agree about the slope and there is no way for them to disagree if the slope
 * is a single argument.
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
