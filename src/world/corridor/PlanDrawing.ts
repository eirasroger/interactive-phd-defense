import { BufferAttribute, BufferGeometry, Color, Group, Mesh, ShaderMaterial } from 'three';
import { CELLS, SECTION, SWEEP, WALL, sweepFront, type Cell } from '@/config/corridor';

const INK = 0xe4e9f0;

/**
 * One tone for every floor, and the foundation edge is not drawn.
 *
 * Giving the members before C2 a darker ground was an attempt at the C2 → C5
 * foundation edge — `world_design.md` §3's *after C2 the abstract frame becomes
 * populated ground* — and it fails for a reason that has nothing to do with the
 * colours chosen. The split falls where the audience has been given no reason to
 * expect one, so it does not read as two grounds; it reads as **C1's room being
 * darker than the others**, which is a lighting fault, not a claim. A drawing
 * cannot carry a distinction the viewer has no key for.
 *
 * So the edge is unexpressed here, and that is the honest state: the floor's two
 * layers are `world_design.md` §8.1, still open, and the place to solve them is
 * Act II's floor at eye level, where the presenter is standing on the change and
 * can say what it is.
 */
const GROUND = 0x2f4152;

const FILL = { opacity: 0.9, lift: 0.005 } as const;

/**
 * The whole drawing lies on the floor, walls included.
 *
 * Standing each band at the height of the wall it describes is the truthful
 * version and it is the wrong one: from a steep pose a band 4.5 m up projects a
 * metre off the plate it belongs to, so every room reads as a fill that has
 * come loose from its outline. Nobody is reading storey heights off a plan.
 */
const HEAD = 0.02;

const PLAN_VERTEX = `
varying float vRun;
varying float vAcross;
void main() {
  vRun = -position.z;
  vAcross = position.x;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const PLAN_FRAGMENT = `
uniform vec3 uColor;
uniform float uOpacity;
uniform float uFront;
uniform float uSoft;
uniform float uGrain;
varying float vRun;
varying float vAcross;
void main() {
  float grain = sin(vAcross * 0.31) * cos(vRun * 0.17 + 1.7);
  float front = uFront + grain * uSoft * uGrain;
  float alpha = uOpacity * smoothstep(front, front + uSoft, vRun);
  if (alpha < 0.004) discard;
  gl_FragColor = vec4(uColor, alpha);
}
`;

const ink = (color: number): ShaderMaterial =>
  new ShaderMaterial({
    uniforms: {
      uColor: { value: new Color(color) },
      uOpacity: { value: 0 },
      uFront: { value: sweepFront(0) },
      uSoft: { value: SWEEP.soft },
      uGrain: { value: SWEEP.grain },
    },
    vertexShader: PLAN_VERTEX,
    fragmentShader: PLAN_FRAGMENT,
    transparent: true,
    depthWrite: false,
    fog: false,
  });

interface Rect {
  readonly x0: number;
  readonly x1: number;
  readonly z0: number;
  readonly z1: number;
  readonly y: number;
}

export interface PlanDrawing {
  readonly object: Group;
  /** 0 the building, 1 the drawing. */
  setDrawn(level: number): void;
  /**
   * 0 the whole figure, 1 an empty field. Independent of `setDrawn`, because
   * the two answer different questions: whether the drawing has replaced the
   * building, and whether the drawing is still being read.
   */
  setCleared(level: number): void;
  dispose(): void;
}

/**
 * The corridor as a plan drawn in light.
 *
 * Seen from sixty metres the built shell has nothing left to give: its bake was
 * lit and exposed for standing inside it, its parquet is a 3.4 m tile viewed
 * from forty times that, and an interior with its ceiling off is a dollhouse.
 * None of that is fixable by relighting — the pose is outside what the asset
 * was authored for, and re-authoring it for one shot would cost the sixteen
 * scenes played at eye level.
 *
 * So the building stops being a building on the way up. What replaces it is the
 * drawing it was extruded from: walls as bands at their own height, floors as a
 * dim ground, and the flow — unchanged, still running — as the only colour in
 * the frame. The shell drains to black underneath rather than being removed, so
 * the drawing is standing in the space it describes and the move back down
 * finds the building where it was left.
 *
 * Two draw calls: every band is one merged geometry and every floor another.
 */
export function createPlanDrawing(): PlanDrawing {
  const object = new Group();
  object.name = 'plan';
  object.visible = false;

  const walls = ink(INK);
  const ground = ink(GROUND);
  const bands = new Mesh(plate(wallBands()), walls);
  bands.renderOrder = 1;
  const floors = new Mesh(plate(floorPlates()), ground);
  floors.renderOrder = 0;

  object.add(floors, bands);

  let drawn = 0;
  let cleared = 0;

  const apply = (): void => {
    object.visible = drawn > 0.002 && cleared < 0.999;
    walls.uniforms['uOpacity']!.value = drawn;
    ground.uniforms['uOpacity']!.value = drawn * FILL.opacity;

    const front = sweepFront(cleared);
    walls.uniforms['uFront']!.value = front;
    ground.uniforms['uFront']!.value = front;
  };

  apply();

  return {
    object,

    setDrawn(level) {
      drawn = level;
      apply();
    },

    setCleared(level) {
      cleared = level;
      apply();
    },

    dispose() {
      bands.geometry.dispose();
      floors.geometry.dispose();
      walls.dispose();
      ground.dispose();
    },
  };
}

/** Every wall the enfilade actually has, at the height it stands. */
function wallBands(): Rect[] {
  const rects: Rect[] = [];
  const reach = WALL / 2;

  const y = SECTION.floor + HEAD;

  for (const cell of CELLS) {

    for (const side of [-1, 1]) {
      if (cell.opens.includes(side)) continue;
      const inner = cell.centre + side * cell.half;

      // A wing is a pocket in the gallery's own wall, not a replacement for it.
      // The wall carries on past both ends of the opening — the Blender script
      // skips the whole face because it is deciding where *fittings* hang, and
      // reading that rule as geometry left every winged gallery drawn as an
      // outline with two holes in it.
      for (const [from, to] of clear(cell, side)) {
        rects.push(span(inner, inner + side * WALL, from - reach, to + reach, y));
      }
    }

    for (const wing of cell.wings) {
      rects.push(
        span(wing.far, wing.far + wing.side * WALL, wing.y0 - reach, wing.y1 + reach, y),
        span(wing.near, wing.far + wing.side * WALL, wing.y0 - reach, wing.y0 + reach, y),
        span(wing.near, wing.far + wing.side * WALL, wing.y1 - reach, wing.y1 + reach, y),
      );
    }
  }

  // Each end reaches out to meet the wall it turns into, and only the end that
  // is furthest from the axis has one: the other is the narrower member's own
  // face, whose band already runs back inside the jamb.
  for (const { z, from, to } of jambs()) {
    const out = (edge: number, other: number): number =>
      Math.abs(edge) >= Math.abs(other) ? edge + Math.sign(edge || 1) * WALL : edge;
    rects.push(span(out(from, to), out(to, from), z - reach, z + reach, y));
  }

  return rects;
}

/** The stretches of a gallery's own wall a wing does not open through. */
function clear(cell: Cell, side: number): Array<[number, number]> {
  const wing = cell.wings.find((entry) => entry.side === side);
  if (!wing) return [[cell.y0, cell.y1]];
  return ([
    [cell.y0, wing.y0],
    [wing.y1, cell.y1],
  ] as Array<[number, number]>).filter(([from, to]) => to - from > 0.01);
}

/**
 * The walls across the run, found rather than listed.
 *
 * At any station on the run, some members end and some begin, and what is solid
 * is whatever exactly one of them covers: where a link meets a gallery that is
 * the two jambs of the opening, where the last gallery ends it is the terminal
 * wall, and across the cross — where three members share one station and none
 * of them is sequential with another — it is nothing at all in the middle and
 * the front and back walls of C3 and C4 either side.
 *
 * Listing them by hand gets the cross wrong, which is the one place in the
 * building where getting it wrong closes a route the figure depends on.
 */
function jambs(): Array<{ z: number; from: number; to: number }> {
  const stations = [...new Set(CELLS.flatMap((cell) => [cell.y0, cell.y1]))].sort((a, b) => a - b);
  const found: Array<{ z: number; from: number; to: number }> = [];

  for (const z of stations) {
    // The mouth is an opening into the vestibule, not a wall.
    if (z === 0) continue;

    const ending = CELLS.filter((cell) => cell.y1 === z);
    const starting = CELLS.filter((cell) => cell.y0 === z);

    for (const [from, to] of exactlyOne(ending, starting)) {
      found.push({ z, from, to });
    }
  }

  return found;
}

/** Where one side of a station is covered and the other is not. */
function exactlyOne(ending: readonly Cell[], starting: readonly Cell[]): Array<[number, number]> {
  const edges = [...ending, ...starting].flatMap((cell) => [
    cell.centre - cell.half,
    cell.centre + cell.half,
  ]);
  const marks = [...new Set(edges)].sort((a, b) => a - b);
  const covers = (cells: readonly Cell[], at: number): boolean =>
    cells.some((cell) => at > cell.centre - cell.half && at < cell.centre + cell.half);

  const solid: Array<[number, number]> = [];
  for (let index = 0; index + 1 < marks.length; index += 1) {
    const [from, to] = [marks[index] as number, marks[index + 1] as number];
    const middle = (from + to) / 2;
    if (covers(ending, middle) === covers(starting, middle)) continue;
    const previous = solid[solid.length - 1];
    if (previous && previous[1] === from) solid[solid.length - 1] = [previous[0], to];
    else solid.push([from, to]);
  }
  return solid;
}

/** The ground each member stands on. */
function floorPlates(): Rect[] {
  const y = SECTION.floor + FILL.lift;
  return CELLS.flatMap((cell) => [
    span(cell.centre - cell.half, cell.centre + cell.half, cell.y0, cell.y1, y),
    ...cell.wings.map((wing) => span(wing.near, wing.far, wing.y0, wing.y1, y)),
  ]);
}

const span = (a: number, b: number, c: number, d: number, y: number): Rect => ({
  x0: Math.min(a, b),
  x1: Math.max(a, b),
  z0: Math.min(c, d),
  z1: Math.max(c, d),
  y,
});

/** The plan is authored with z running into the corridor; the world runs back. */
function plate(rects: readonly Rect[]): BufferGeometry {
  const positions = new Float32Array(rects.length * 12);
  const indices: number[] = [];

  rects.forEach((rect, index) => {
    const corners = [
      [rect.x0, rect.z0],
      [rect.x1, rect.z0],
      [rect.x0, rect.z1],
      [rect.x1, rect.z1],
    ];
    corners.forEach(([x, z], corner) => {
      const at = (index * 4 + corner) * 3;
      positions[at] = x as number;
      positions[at + 1] = rect.y;
      positions[at + 2] = -(z as number);
    });
    const base = index * 4;
    indices.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
  });

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
}
